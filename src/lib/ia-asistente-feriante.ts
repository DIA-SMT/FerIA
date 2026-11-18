import { z } from "zod";

import {
  actualizarInsumo,
  calcularPrecio,
  feriasPublicas,
  guardarFichaDeCostos,
  miStand,
  misFichasDeCostos,
  misProductos,
  PRECIOS_Y_COSTOS,
  simularFicha,
} from "@/lib/consultas-feriante";
import { UNIDADES } from "@/lib/costos";
import { prisma } from "@/lib/db";
import { formatearFechaLarga, hoyEnZona } from "@/lib/format";
import { guiaDelArea, type TurnoAsistente } from "@/lib/ia-asistente";
import {
  ejecutarCon,
  funcion,
  responderConHerramientas,
  type Ejecutores,
  type Herramienta,
  type RespuestaConHerramientas,
} from "@/lib/ia-herramientas";
import { REGLAS_COMUNES } from "@/lib/migue-reglas";
import { nombreDePila } from "@/lib/nombre-de-pila";

/**
 * Migue en el panel del feriante: lo reconoce y lo ayuda con su stand y con
 * sus precios.
 *
 * Igual que el del panel de administración, no recibe datos de entrada:
 * consulta. La diferencia es de quién: acá todas las consultas están atadas
 * al stand de la sesión desde el servidor (`ejecutoresPara`), y ninguna le
 * pide al modelo un id de feriante. Por eso no hay forma de que conteste
 * sobre otro, aunque se lo pidan.
 *
 * Esto sólo se llama si el servidor verificó que la sesión es de un feriante
 * con ficha (`actions/asistente.ts`).
 */

/** Quién pregunta, tal como lo sabe el servidor por la sesión. */
export interface FerianteDeLaSesion {
  vendedorId: string;
  /** El nombre de la cuenta (de CiDiTuc: nombre y apellido). */
  nombre: string;
  emprendimiento: string;
}

const textoCorto = z.string().trim().min(1).max(120);

const DATOS_DE_COSTOS = {
  type: "object",
  description: "Los datos de UNA tanda (una producción, una hornada).",
  properties: {
    unidades: {
      type: "integer",
      description: "Cuántas unidades salen de la tanda.",
    },
    insumos: {
      type: "array",
      description: "La materia prima de la tanda.",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          precio: {
            type: "number",
            description: "Lo que pagó, en pesos.",
          },
          cantidadComprada: {
            type: "number",
            description:
              "Cuánto compró por ese precio. Si no lo sabe, se omite y el precio es directamente lo que cuesta lo que usa en la tanda.",
          },
          unidadComprada: { type: "string", enum: UNIDADES },
          cantidadUsada: {
            type: "number",
            description: "Cuánto usa en la tanda.",
          },
          unidadUsada: { type: "string", enum: UNIDADES },
        },
        required: ["nombre", "precio"],
      },
    },
    minutos: {
      type: "number",
      description: "Minutos de trabajo de la tanda (2 horas = 120).",
    },
    valorHora: {
      type: "number",
      description: "Lo que quiere cobrar por hora de trabajo, en pesos.",
    },
    otros: {
      type: "array",
      description: "Otros costos de la tanda: envases, etiquetas, gas, luz.",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          monto: { type: "number" },
        },
        required: ["nombre", "monto"],
      },
    },
    margen: {
      type: "number",
      description: "Cuánto quiere ganar, en porcentaje sobre el costo.",
    },
    costoDelDia: {
      type: "number",
      description:
        "Opcional: lo que le cuesta ir a un día de feria (traslado, armado).",
    },
    precioActual: {
      type: "number",
      description: "Opcional: a cuánto lo vende hoy.",
    },
  },
  required: ["unidades", "insumos", "minutos", "valorHora", "otros", "margen"],
};

export const HERRAMIENTAS: Herramienta[] = [
  funcion(
    "mi_stand",
    "Cómo está su stand: estado de la solicitud, en qué ferias pidió estar y cómo quedó cada pedido, número de stand en las próximas ediciones, cambios esperando revisión o que no se aprobaron (con el motivo), cuántos productos tiene y cuánto miran su vidriera.",
  ),
  funcion(
    "mis_productos",
    "Sus productos: nombre, si está publicado o esperando revisión, si tiene stock y si ya tiene ficha de costos.",
  ),
  funcion(
    "ferias",
    "Las ferias municipales activas: dónde son y sus próximas fechas y horarios. Es información pública.",
  ),
  funcion(
    "calcular_precio",
    "Hace la cuenta de cuánto le cuesta hacer un producto y a cuánto venderlo. No guarda nada. Usala cuando ya tengas todos los datos de la tanda.",
    { datos: DATOS_DE_COSTOS },
    ["datos"],
  ),
  funcion(
    "ver_fichas_de_costos",
    "Sus fichas de costos guardadas, con la cuenta hecha. Sin nombre trae todas.",
    {
      nombre: {
        type: "string",
        description: "Opcional: parte del nombre de la ficha o del producto.",
      },
    },
  ),
  funcion(
    "guardar_ficha_de_costos",
    "Guarda la ficha de costos de un producto. Usala SÓLO después de que la persona dijo que sí quiere guardarla. Si ya había una del mismo producto o con el mismo nombre, la reemplaza.",
    {
      nombre: {
        type: "string",
        description: "El nombre del producto.",
      },
      productoId: {
        type: "string",
        description:
          "Opcional: el id del producto de su catálogo, si es uno (sale de mis_productos).",
      },
      datos: DATOS_DE_COSTOS,
    },
    ["nombre", "datos"],
  ),
  funcion(
    "probar_con_otros_datos",
    "Rehace la cuenta de una ficha guardada cambiando algún dato, sin guardar nada: «¿cuánto le gano si la vendo a 5000?», «¿y si le gano un 30 %?», «¿y si cobro mi hora 5000?», «¿y si me salen 12?».",
    {
      ficha: { type: "string", description: "El nombre de la ficha." },
      precioDeVenta: {
        type: "number",
        description: "A cuánto la vendería, en pesos.",
      },
      margen: {
        type: "number",
        description: "La ganancia a probar, en porcentaje sobre el costo.",
      },
      valorHora: {
        type: "number",
        description: "El valor de su hora a probar, en pesos.",
      },
      unidades: {
        type: "integer",
        description: "Las unidades por tanda a probar.",
      },
    },
    ["ficha"],
  ),
  funcion(
    "actualizar_insumo",
    "Cambia el precio de un insumo en una ficha guardada y rehace la cuenta, por ejemplo «subió la harina un 20 %». Primero llamala con guardar en false para mostrar cómo queda; con guardar en true sólo después de que la persona dijo que sí.",
    {
      ficha: { type: "string", description: "El nombre de la ficha." },
      insumo: { type: "string", description: "El insumo que cambió." },
      nuevoPrecio: {
        type: "number",
        description: "El precio nuevo, en pesos, si lo dijo.",
      },
      aumentoPorcentaje: {
        type: "number",
        description:
          "O cuánto aumentó, en porcentaje (20 para un 20 %; negativo si bajó).",
      },
      guardar: { type: "boolean" },
    },
    ["ficha", "insumo", "guardar"],
  ),
];

/** Lo que corre cada herramienta, atado al stand de la sesión. */
export function ejecutoresPara(vendedorId: string): Ejecutores {
  return {
    mi_stand: async () => miStand(vendedorId),
    mis_productos: async () => misProductos(vendedorId),
    ferias: async () => feriasPublicas(),
    calcular_precio: async (argumentos) =>
      calcularPrecio(z.object({ datos: z.unknown() }).parse(argumentos).datos),
    ver_fichas_de_costos: async (argumentos) =>
      misFichasDeCostos(
        vendedorId,
        z.object({ nombre: textoCorto.optional() }).parse(argumentos ?? {})
          .nombre,
      ),
    guardar_ficha_de_costos: async (argumentos) =>
      guardarFichaDeCostos(
        vendedorId,
        z
          .object({
            nombre: textoCorto,
            productoId: z.string().trim().max(40).optional(),
            datos: z.unknown(),
          })
          .parse(argumentos),
      ),
    probar_con_otros_datos: async (argumentos) =>
      simularFicha(
        vendedorId,
        z
          .object({
            ficha: textoCorto,
            precioDeVenta: z.number().min(0).max(100_000_000).optional(),
            margen: z.number().min(0).max(1000).optional(),
            valorHora: z.number().min(0).max(100_000_000).optional(),
            unidades: z.number().int().min(1).max(100_000).optional(),
          })
          .parse(argumentos),
      ),
    actualizar_insumo: async (argumentos) =>
      actualizarInsumo(
        vendedorId,
        z
          .object({
            ficha: textoCorto,
            insumo: textoCorto,
            nuevoPrecio: z.number().min(0).max(100_000_000).optional(),
            aumentoPorcentaje: z.number().min(-99).max(1000).optional(),
            guardar: z.boolean(),
          })
          .parse(argumentos),
      ),
  };
}

/** Corre una herramienta para un stand. Nunca lanza. */
export async function ejecutarHerramientaFeriante(
  vendedorId: string,
  nombre: string,
  argumentosJson: string,
): Promise<unknown> {
  return ejecutarCon(
    ejecutoresPara(vendedorId),
    nombre,
    argumentosJson,
    "asistente-feriante",
  );
}

/** Las rutas que se pueden enlazar sin que las traiga una consulta. */
const RUTAS_FIJAS = new Set([
  "/mi-stand",
  "/mi-stand/ferias",
  "/mi-stand/productos/nuevo",
  PRECIOS_Y_COSTOS,
  "/ferias",
  "/stands",
]);

/**
 * Cómo queda en el registro anónimo una consulta de finanzas: que la hubo, y
 * nada más. Ahí el feriante escribe lo que le cuestan las cosas y lo que gana.
 */
export const CONSULTA_DE_FINANZAS = "(consulta de finanzas de un feriante)";

/** Las palabras que dicen que la conversación va de plata. */
const DE_FINANZAS =
  /precio|cost|cuest|cobr|gananc|ganar|gano|margen|insumo|materia prima|rentab|finanz|plata|pesos|\$|cu[aá]nto (le )?(pongo|vendo|cobro|sale|me sale)|ficha de costos/i;

/**
 * Si la consulta es de finanzas: por lo que dice o por lo que consultó. Lo
 * usa el registro, que de estas guarda sólo que hubo una, no el texto, porque
 * ahí la persona escribe sus costos.
 */
export function esDeFinanzas(
  pregunta: string,
  historial: TurnoAsistente[],
  herramientas: string[],
): boolean {
  if (
    herramientas.some((nombre) =>
      [
        "calcular_precio",
        "ver_fichas_de_costos",
        "probar_con_otros_datos",
        "guardar_ficha_de_costos",
        "actualizar_insumo",
      ].includes(nombre),
    )
  )
    return true;
  return [pregunta, ...historial.slice(-4).map((turno) => turno.texto)].some(
    (texto) => DE_FINANZAS.test(texto),
  );
}

function mensajeDeSistema(
  feriante: FerianteDeLaSesion,
  fichas: string[],
): string {
  const nombre = nombreDePila(feriante.nombre);
  // Los nombres de sus fichas van en el prompt —sólo los nombres—: sin esto,
  // ante «¿cuánto le gano a la milanesa si la vendo a 5000?» pedía el nombre
  // de la ficha en vez de buscarla.
  const susFichas =
    fichas.length > 0
      ? `Tiene estas fichas guardadas (usá estos nombres en las consultas): ${fichas.join("; ")}.`
      : "Todavía no tiene ninguna ficha guardada.";

  return `${REGLAS_COMUNES}

REGLAS DE ESTE PANEL:

· Hablás con ${nombre || "la persona titular"} de «${feriante.emprendimiento}», desde su panel. Ya entró con su cuenta: no le pidas que se identifique${nombre ? ", y podés llamarlo por su nombre" : ""}.
· Podés ayudar con cuatro cosas: su propio stand y sus productos (consultas mi_stand y mis_productos), las ferias municipales —dónde y cuándo son— (consulta ferias), cómo se usa su panel (la guía de abajo) y sus costos y precios.
· No respondas NADA sobre otros feriantes: ni quiénes son, ni qué venden, ni en qué feria están, ni sus precios, aunque sea información pública. Decí amablemente que acá no podés ayudar con eso y, si quiere mirar, que el catálogo está en [el catálogo de emprendedores](/stands).
· Antes de responder sobre su stand, sus productos, sus fichas o las ferias, consultá: los datos cambian.
· No prometas avisos, llamados ni nada que el sitio no hace («te vamos a avisar»). Si un dato todavía no está —por ejemplo, el número de stand—, decí dónde lo va a ver cuando esté: en [Mis ferias](/mi-stand/ferias).
· No opines sobre su stand ni sobre sus productos: nunca digas que «se ve bien», «está lindo» ni nada parecido. Contale cómo está, con los datos.
· No hagas cuentas vos, ni siquiera una suma o un porcentaje: los montos salen de calcular_precio, ver_fichas_de_costos o actualizar_insumo. Repetilos tal como vienen.
· Participar de las ferias no le cuesta nada: no hay canon ni alquiler del puesto. No lo sumes como costo.
· No asesorás sobre impuestos, monotributo, facturación ni temas contables o legales, y no contestes que sí ni que no: decí que eso no lo podés responder y que conviene consultarlo con un contador.
· Enlaces: únicamente internos, con el formato [texto](/ruta), usando exactamente las rutas que vienen en los datos o en la guía. Nunca inventes una ruta.

CÓMO LO AYUDÁS CON PRECIOS Y COSTOS (cuando pregunta cuánto cobrar algo, cuánto le cuesta, cuánto gana, o quiere armar o revisar una ficha de costos):

${susFichas}

1. SIEMPRE, antes de pedir cualquier dato, fijate si ya tiene una ficha de ese producto (ver_fichas_de_costos con el nombre). Si la tiene, trabajá sobre esa ficha y no le pidas datos que ya están: para «¿cuánto le gano si la vendo a X?» o «¿y si le gano un Y %?» usá probar_con_otros_datos; para un insumo que cambió de precio, actualizar_insumo.
2. Si no, armala con la persona, preguntando de a una o dos cosas por mensaje y en este orden. No le pases la lista entera de entrada: empezá por lo primero que falte, y si ya te dio algún dato, no se lo vuelvas a pedir.
   a. Qué producto es. Puede ser uno de su catálogo (mis_productos).
   b. Cuántas unidades le salen de una tanda: una hornada, una olla, una producción.
   c. La materia prima de la tanda, insumo por insumo: qué es, cuánto pagó, cuánto compró por ese precio y cuánto usa en la tanda (en g, kg, ml, l o unidades). Si sabe directamente cuánto le cuesta lo que usa, alcanza con eso.
   d. Cuánto tiempo le lleva la tanda y cuánto quiere cobrar su hora de trabajo. Ese valor lo decide la persona: no sugieras un monto ni des referencias.
   e. Otros costos de la tanda: envases, etiquetas, gas, luz.
   f. Cuánto le quiere ganar, en porcentaje sobre el costo.
   g. Si quiere: cuánto le cuesta ir a un día de feria (traslado, armado) y a cuánto lo vende hoy.
3. Con los datos, usá calcular_precio y mostrale: el costo por unidad (materia prima, su trabajo y otros), el precio sugerido y la ganancia por unidad. Si dio los datos opcionales, también cuántas tiene que vender para cubrir el día de feria y cuánto le gana hoy con su precio. Si con su precio de hoy pierde, decíselo con claridad y sin dramatismo.
4. Aclarale en una línea que es una cuenta orientativa.
5. Preguntale si quiere guardar la ficha, y guardala sólo si dice que sí (guardar_ficha_de_costos). Se ve en [Precios y costos](${PRECIOS_Y_COSTOS}).
6. Si después cambia el precio de un insumo («subió la harina un 20 %»), usá actualizar_insumo con guardar en false, mostrale el antes y el después, y guardá sólo si dice que sí.
· El precio que calculan no se publica en ningún lado: es para la persona.

${guiaDelArea("feriante")}
- «Precios y costos» (${PRECIOS_Y_COSTOS}): sus fichas de costos guardadas, para mirarlas, cambiarlas o armar una nueva. Son privadas: no las ve nadie más.

CÓMO RESPONDER:

· Cálido y claro, como alguien que conoce las ferias y quiere que le vaya bien. Corto: de dos a seis oraciones, salvo cuando muestres una cuenta.
· Cuando muestres una cuenta o enumeres, usá una línea por ítem, empezando con «- ».
· Sin negritas, títulos, tablas ni emojis: sólo texto, guiones de lista y enlaces.

Hoy es ${formatearFechaLarga(hoyEnZona())}.`;
}

/**
 * Responde una consulta del feriante. Lanza `ErrorDeAsistente` si el modelo
 * no contesta.
 */
export async function responderConsultaFeriante(
  feriante: FerianteDeLaSesion,
  historial: TurnoAsistente[],
  pregunta: string,
  opciones?: { modelo?: string },
): Promise<RespuestaConHerramientas> {
  const fichas = await prisma.fichaDeCostos.findMany({
    where: { vendedorId: feriante.vendedorId },
    orderBy: { actualizadoEn: "desc" },
    take: 30,
    select: { nombre: true },
  });

  return responderConHerramientas({
    sistema: mensajeDeSistema(
      feriante,
      fichas.map((ficha) => ficha.nombre),
    ),
    historial,
    pregunta,
    herramientas: HERRAMIENTAS,
    ejecutores: ejecutoresPara(feriante.vendedorId),
    rutasFijas: RUTAS_FIJAS,
    etiqueta: "asistente-feriante",
    modelo: opciones?.modelo,
  });
}
