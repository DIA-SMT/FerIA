import { EDICIONES_PUBLICAS } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { proximasFechasComerciales } from "@/lib/fechas-comerciales";
import {
  formatearFechaLarga,
  formatearRangoFechas,
  hoyEnZona,
} from "@/lib/format";
import { lugarDeEdicion, resumenHorario } from "@/lib/horarios";
import { RUBROS } from "@/lib/labels";

/*
  Lo que Migue necesita para ayudar a un feriante a difundir lo suyo: cuándo
  son sus próximas ferias, qué días le miran más la vidriera, qué productos le
  consultan, qué fechas comerciales se vienen y si tiene Instagram. Todo de su
  stand y de nadie más (el id sale de la sesión, ver ia-asistente-feriante).
*/

/** El link a la página que arma la imagen del catálogo para compartir. */
export const COMPARTIR = "/mi-stand/compartir";

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

/** Cuántas aperturas hacen falta para decir algo de los días. */
const APERTURAS_MINIMAS = 30;

/** Cuántas semanas se miran para los días de la semana. */
const SEMANAS = 8;

const UN_DIA = 24 * 60 * 60 * 1000;

export interface DiaDeLaSemana {
  dia: (typeof DIAS)[number];
  aperturas: number;
  consultas: number;
}

/**
 * Las visitas de cada día sumadas por día de la semana, del que más tiene al
 * que menos. `null` si son muy pocas para sacar una conclusión: con diez
 * visitas, que el martes tenga tres no dice nada.
 */
export function interesPorDiaDeLaSemana(
  filas: Array<{ fecha: Date; aperturas: number; consultas: number }>,
): DiaDeLaSemana[] | null {
  const total = filas.reduce((suma, fila) => suma + fila.aperturas, 0);
  if (total < APERTURAS_MINIMAS) return null;

  const porDia = DIAS.map((dia) => ({ dia, aperturas: 0, consultas: 0 }));
  for (const fila of filas) {
    // Las fechas son medianoche UTC del día de Tucumán: el día UTC es el día.
    const delDia = porDia[fila.fecha.getUTCDay()]!;
    delDia.aperturas += fila.aperturas;
    delDia.consultas += fila.consultas;
  }
  return porDia
    .filter((dia) => dia.aperturas > 0)
    .sort(
      (uno, otro) =>
        otro.aperturas - uno.aperturas || otro.consultas - uno.consultas,
    );
}

export async function paraDifundir(vendedorId: string) {
  const hoy = hoyEnZona();
  const desde = new Date(hoy.getTime() - SEMANAS * 7 * UN_DIA);
  const ultimoMes = new Date(hoy.getTime() - 30 * UN_DIA);

  const [vendedor, visitas, consultados, propuestas] = await Promise.all([
    prisma.vendedor.findUnique({
      where: { id: vendedorId },
      select: {
        emprendimiento: true,
        slug: true,
        rubro: true,
        instagram: true,
        postulaciones: {
          where: { estado: "ACEPTADA", feria: { activa: true } },
          select: {
            feria: {
              select: {
                nombre: true,
                slug: true,
                direccion: true,
                ediciones: {
                  where: { ...EDICIONES_PUBLICAS, fechaFin: { gte: hoy } },
                  orderBy: { fechaInicio: "asc" },
                  take: 2,
                  select: {
                    fechaInicio: true,
                    fechaFin: true,
                    diasSemana: true,
                    horaApertura: true,
                    horaCierre: true,
                    horario: true,
                    lugar: true,
                  },
                },
              },
            },
          },
        },
        productos: {
          where: { publicado: true, disponible: true },
          select: { nombre: true, destacado: true, imagenes: true },
        },
      },
    }),
    prisma.interesStand.findMany({
      where: { vendedorId, fecha: { gte: desde } },
      select: { fecha: true, aperturas: true, consultas: true },
    }),
    prisma.interesProducto.groupBy({
      by: ["productoId"],
      where: {
        fecha: { gte: ultimoMes },
        producto: { vendedorId, publicado: true },
      },
      _sum: { consultas: true },
      orderBy: { _sum: { consultas: "desc" } },
      take: 3,
    }),
    prisma.propuestaSelloPropio.findMany({
      where: { vendedorId, publicada: true },
      select: { titulo: true },
    }),
  ]);
  if (!vendedor) return { error: "No se encontró el stand." };

  const nombres = await prisma.producto.findMany({
    where: { id: { in: consultados.map((fila) => fila.productoId) } },
    select: { id: true, nombre: true },
  });
  const nombreDe = new Map(nombres.map((p) => [p.id, p.nombre]));

  const dias = interesPorDiaDeLaSemana(visitas);
  const sinFoto = vendedor.productos.filter((p) => p.imagenes.length === 0);

  return {
    emprendimiento: vendedor.emprendimiento,
    rubro: RUBROS[vendedor.rubro],
    paginaDelStand: `/stands/${vendedor.slug}`,
    imagenDelCatalogo: `Se arma en «Compartir» (${COMPARTIR}): una imagen con sus productos para mandar por WhatsApp o subir a Instagram, o en la pestaña «Publicidad con IA», una imagen publicitaria que arma la IA con sus fotos.`,
    instagram: vendedor.instagram
      ? `@${vendedor.instagram}`
      : "No cargó su Instagram. Lo puede sumar en Mi stand, en la tarjeta «Contacto», y así aparece en su stand y en la imagen del catálogo.",
    proximasFerias: vendedor.postulaciones
      .filter((p) => p.feria.ediciones.length > 0)
      .map(({ feria }) => ({
        feria: feria.nombre,
        fechas: feria.ediciones.map((edicion) => ({
          cuando: formatearRangoFechas(edicion.fechaInicio, edicion.fechaFin),
          empiezaEl: formatearFechaLarga(edicion.fechaInicio),
          horario: resumenHorario(edicion),
          lugar: lugarDeEdicion(edicion, feria) || "a confirmar",
        })),
      })),
    visitasPorDiaDeLaSemana: dias
      ? {
          nota: `Visitas a su página en este sitio en las últimas ${SEMANAS} semanas, sumadas por día de la semana (no son datos de Instagram). «consultas» son los clics en su WhatsApp.`,
          dias,
        }
      : "Todavía hay muy pocas visitas a su página para saber qué días la miran más.",
    productosMasConsultados: consultados
      .map((fila) => ({
        producto: nombreDe.get(fila.productoId) ?? "",
        consultasDelUltimoMes: fila._sum.consultas ?? 0,
      }))
      .filter((fila) => fila.producto && fila.consultasDelUltimoMes > 0),
    productosDestacados: vendedor.productos
      .filter((p) => p.destacado)
      .map((p) => p.nombre),
    productosSinFoto: sinFoto.map((p) => p.nombre),
    modoFeria:
      propuestas.length > 0
        ? propuestas.map((p) => p.titulo)
        : "No tiene propuestas publicadas en Modo Feria.",
    fechasComerciales: proximasFechasComerciales(hoy).map((fecha) => ({
      nombre: fecha.nombre,
      fecha: formatearFechaLarga(fecha.fecha),
      idea: fecha.idea,
    })),
  };
}
