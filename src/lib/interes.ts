import { prisma } from "@/lib/db";
import { hoyEnZona } from "@/lib/format";

/**
 * Interés en la vidriera: qué miran y qué preguntan los vecinos.
 *
 * Dos contadores agregados **por día**, sin identificador de visitante de
 * ningún tipo: no hay cookie, ni IP, ni user agent guardado, ni hora. La fila
 * más detallada que llega a existir es «este producto, este día, 12 consultas».
 *
 * Como no hay página por producto —se muestran todos juntos en la grilla del
 * stand—, contar vistas por producto daría el mismo número para todos los
 * productos de un mismo feriante. Lo que sí distingue a uno de otro es el clic
 * en «Consultar por este producto», y eso es lo que se cuenta. Las aperturas
 * del stand son el denominador.
 *
 * El porqué y lo que se descartó están en docs/interes-en-la-vidriera.md.
 */

/**
 * Cuántos días de datos hacen falta antes de decirle algo al feriante.
 *
 * Una devolución armada sobre tres días es ruido con tono de conclusión, y la
 * primera impresión del feriante es la única que hay. Hasta llegar acá la
 * pantalla avisa que se está contando y no opina.
 */
export const DIAS_PARA_LA_DEVOLUCION = 30;

/**
 * El día de hoy en Tucumán, como `AAAA-MM-DD`.
 *
 * Va a la consulta como texto con un `::date` explícito y no como `Date`: si se
 * mandara el objeto, Postgres recortaría un `timestamptz` a `date` usando el
 * huso de la sesión, y una consulta del sábado a las 22 podía caer en domingo.
 * El sábado es el día de feria; equivocarlo arruina justo el corte que importa.
 */
function diaDeHoy(): string {
  return hoyEnZona().toISOString().slice(0, 10);
}

/**
 * Corre el contador sin dejar que rompa nada.
 *
 * Todos estos incrementos pasan después de que la respuesta salió. Si el
 * contador falla, lo que corresponde es que quede sin contar y que nadie se
 * entere: una vidriera que no abre porque falló una métrica sería ridículo.
 */
async function contar(operacion: Promise<unknown>, que: string): Promise<void> {
  try {
    await operacion;
  } catch (error) {
    console.error(`[interes] no se pudo contar ${que}:`, error);
  }
}

/**
 * Suma uno a una apertura de vidriera.
 *
 * `INSERT ... ON CONFLICT` y no un `upsert` de Prisma porque dos vecinos que
 * abren el mismo stand en el mismo milisegundo son el caso normal, no el raro:
 * leer-y-después-escribir perdería incrementos y a veces chocaría contra la
 * clave primaria.
 */
export async function registrarApertura(vendedorId: string): Promise<void> {
  await contar(
    prisma.$executeRaw`
      INSERT INTO interes_stand ("vendedorId", "fecha", "aperturas")
      VALUES (${vendedorId}, ${diaDeHoy()}::date, 1)
      ON CONFLICT ("vendedorId", "fecha")
      DO UPDATE SET "aperturas" = interes_stand."aperturas" + 1
    `,
    "una apertura",
  );
}

/** Consulta por WhatsApp desde el encabezado, sin producto identificado. */
export async function registrarConsultaDeStand(
  vendedorId: string,
): Promise<void> {
  await contar(
    prisma.$executeRaw`
      INSERT INTO interes_stand ("vendedorId", "fecha", "consultas")
      VALUES (${vendedorId}, ${diaDeHoy()}::date, 1)
      ON CONFLICT ("vendedorId", "fecha")
      DO UPDATE SET "consultas" = interes_stand."consultas" + 1
    `,
    "una consulta de stand",
  );
}

/**
 * Consulta por un producto concreto. La señal fuerte.
 *
 * Si el producto no existe, la clave foránea rechaza la fila y queda en el log:
 * no hay que validar antes, y así un identificador inventado no escribe nada.
 */
export async function registrarConsultaDeProducto(
  productoId: string,
): Promise<void> {
  await contar(
    prisma.$executeRaw`
      INSERT INTO interes_producto ("productoId", "fecha", "consultas")
      VALUES (${productoId}, ${diaDeHoy()}::date, 1)
      ON CONFLICT ("productoId", "fecha")
      DO UPDATE SET "consultas" = interes_producto."consultas" + 1
    `,
    "una consulta de producto",
  );
}

/** Un producto del stand con lo que se le consultó en la ventana. */
export interface InteresDeProducto {
  id: string;
  nombre: string;
  destacado: boolean;
  disponible: boolean;
  consultas: number;
}

export interface ResumenDeInteres {
  /** Días que lleva contando la plataforma, no este stand en particular. */
  diasContando: number;
  /** Cuántos faltan para la primera devolución. Cero cuando ya se puede. */
  diasQueFaltan: number;
  /** Cuándo se puede esperar el primer resumen. */
  fechaDeLaDevolucion: Date | null;
  /** Lo de abajo sólo tiene sentido con `diasQueFaltan === 0`. */
  aperturas: number;
  consultasDelStand: number;
  productos: InteresDeProducto[];
}

const UN_DIA = 24 * 60 * 60 * 1000;

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * UN_DIA);
}

/**
 * Desde cuándo cuenta la plataforma.
 *
 * Es el primer día con algún registro, de cualquier stand, y no el primer día
 * de *este* stand: si no, una vidriera que recibe su primera visita el día 25
 * volvería a empezar el mes desde cero y nunca llegaría a la devolución.
 *
 * Mientras la tabla esté vacía todavía no empezó a contar nada.
 */
async function contandoDesde(): Promise<Date | null> {
  const [fila] = await prisma.$queryRaw<{ desde: Date | null }[]>`
    SELECT min("fecha") AS desde FROM interes_stand
  `;
  return fila?.desde ?? null;
}

/**
 * Lo que se le muestra al feriante sobre su propia vidriera.
 *
 * Sólo lo suyo: estos números son del feriante y de nadie más. El panel
 * municipal, si alguna vez mira esto, mira agregados por feria.
 */
export async function obtenerInteresDelStand(
  vendedorId: string,
): Promise<ResumenDeInteres> {
  const hoy = hoyEnZona();
  const desde = await contandoDesde();

  // El día en que empezó a contar también cuenta, por eso el +1.
  const diasContando = desde
    ? Math.floor((hoy.getTime() - desde.getTime()) / UN_DIA) + 1
    : 0;
  const diasQueFaltan = Math.max(0, DIAS_PARA_LA_DEVOLUCION - diasContando);

  const vacio: ResumenDeInteres = {
    diasContando,
    diasQueFaltan,
    fechaDeLaDevolucion: desde
      ? sumarDias(desde, DIAS_PARA_LA_DEVOLUCION - 1)
      : null,
    aperturas: 0,
    consultasDelStand: 0,
    productos: [],
  };

  if (diasQueFaltan > 0) return vacio;

  // La ventana es el último mes y no todo lo acumulado: lo que le sirve al
  // feriante es cómo viene ahora, no un total que sólo puede crecer.
  const ventana = sumarDias(hoy, -(DIAS_PARA_LA_DEVOLUCION - 1));

  const [stand, productos] = await Promise.all([
    prisma.interesStand.aggregate({
      where: { vendedorId, fecha: { gte: ventana } },
      _sum: { aperturas: true, consultas: true },
    }),
    prisma.producto.findMany({
      where: { vendedorId },
      select: {
        id: true,
        nombre: true,
        destacado: true,
        disponible: true,
        interes: {
          where: { fecha: { gte: ventana } },
          select: { consultas: true },
        },
      },
    }),
  ]);

  return {
    ...vacio,
    aperturas: stand._sum.aperturas ?? 0,
    consultasDelStand: stand._sum.consultas ?? 0,
    productos: productos
      .map(({ interes, ...producto }) => ({
        ...producto,
        consultas: interes.reduce((total, dia) => total + dia.consultas, 0),
      }))
      // De más consultado a menos, y a igual número por nombre, para que la
      // lista no baile entre recargas.
      .sort(
        (uno, otro) =>
          otro.consultas - uno.consultas || uno.nombre.localeCompare(otro.nombre),
      ),
  };
}
