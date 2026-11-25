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
import { COMPARTIR, paraDifundir } from "@/lib/consultas-difusion";
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
    "para_difundir",
    "Lo que sirve para ayudarlo a difundir lo que vende: sus próximas ferias con fechas, horarios y lugar; qué días de la semana miran más su página en este sitio; sus productos más consultados, los destacados y los que no tienen foto; si cargó su Instagram; sus propuestas de Modo Feria, y las fechas comerciales que se vienen.",
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
    para_difundir: async () => paraDifundir(vendedorId),
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
  "/mi-stand/modo-feria",
  "/mi-stand/modo-feria/nueva",
  COMPARTIR,
  PRECIOS_Y_COSTOS,
  "/ferias",
  "/stands",
]);

/**
 * Cómo queda en el registro anónimo una consulta de finanzas: que la hubo, y
 * nada más. Ahí el feriante escribe lo que le cuestan las cosas y lo que gana.
 */
export const CONSULTA_DE_FINANZAS = "(consulta de finanzas de un feriante)";

/**
 * Las palabras que dicen que la conversación va de plata. Incluye las de las
 * preguntas del cálculo de precios («¿cuánto gastás…?», «¿cuántas te salen de
 * una tanda?»): las respuestas son números sueltos, y sin esto un «15000» o un
 * «24» quedaba en el registro con el texto.
 */
const DE_FINANZAS =
  /precio|cost|cuest|cobr|gananc|ganar|gano|margen|insumo|materia prima|ingrediente|materiales|envase|tanda|gast|pag[oóué]|vend[eéoí]|rentab|finanz|plata|pesos|\$|cu[aá]nto (le )?(pongo|vendo|cobro|sale|me sale)|ficha de costos/i;

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
· Podés ayudar con cinco cosas: su propio stand y sus productos (consultas mi_stand y mis_productos), las ferias municipales —dónde y cuándo son— (consulta ferias), cómo se usa su panel (la guía de abajo), sus costos y precios, y cómo difundir lo que vende (consulta para_difundir).
· No respondas NADA sobre otros feriantes: ni quiénes son, ni qué venden, ni en qué feria están, ni sus precios, aunque sea información pública. Decí amablemente que acá no podés ayudar con eso y, si quiere mirar, que el catálogo está en [el catálogo de emprendedores](/stands).
· Antes de responder sobre su stand, sus productos, sus fichas o las ferias, consultá: los datos cambian.
· No prometas avisos, llamados ni nada que el sitio no hace («te vamos a avisar»). Si un dato todavía no está —por ejemplo, el número de stand—, decí dónde lo va a ver cuando esté: en [Mis ferias](/mi-stand/ferias).
· No opines sobre su stand ni sobre sus productos: nunca digas que «se ve bien», «está lindo» ni nada parecido. Contale cómo está, con los datos. (Los textos para que él publique son otra cosa: ver más abajo.)
· No hagas cuentas vos, ni siquiera una suma o un porcentaje: los montos salen de calcular_precio, ver_fichas_de_costos o actualizar_insumo. Repetilos tal como vienen.
· Participar de las ferias no le cuesta nada: no hay canon ni alquiler del puesto. No lo sumes como costo.
· No asesorás sobre impuestos, monotributo, facturación ni temas contables o legales, y no contestes que sí ni que no: decí que eso no lo podés responder y que conviene consultarlo con un contador.
· Enlaces: únicamente internos, con el formato [texto](/ruta), usando exactamente las rutas que vienen en los datos o en la guía. Nunca inventes una ruta.

CÓMO LO AYUDÁS CON PRECIOS Y COSTOS (cuando pregunta cuánto cobrar algo, cuánto le cuesta, cuánto gana, o quiere armar o revisar una ficha de costos):

${susFichas}

1. SIEMPRE, antes de pedir cualquier dato, fijate si ya tiene una ficha de ese producto (ver_fichas_de_costos con el nombre). Si no la tiene, no lo menciones. Si la tiene, trabajá sobre esa ficha y no le pidas datos que ya están: para «¿cuánto le gano si la vendo a X?» o «¿y si le gano un Y %?» usá probar_con_otros_datos; para un insumo que cambió de precio, actualizar_insumo.
2. Si no, armala con la persona con preguntas simples: UNA por mensaje, corta y con un ejemplo, en este orden. Muchos nunca hicieron esta cuenta: que se entienda sin saber de costos. Si ya te dio algún dato, no se lo vuelvas a pedir.
   a. Qué producto es, si no lo dijo. Puede ser uno de su catálogo (mis_productos).
   b. Cuántas unidades le salen de una tanda: una hornada, una olla, una producción. Ejemplo: «24 alfajores».
   c. Cuánto gasta en total en ingredientes o materiales para esa tanda. Ofrecé [[No sé, vamos de a uno]]. Si sabe el total, va como un solo insumo, «Ingredientes y materiales», con ese precio. Si no, de a un insumo por mensaje: qué es, cuánto pagó y cuánto compró por ese precio, y cuánto usa en la tanda (en g, kg, ml, l o unidades); después de cada uno ofrecé [[Agregar otro | Ya están todos]].
   d. Cuánto tiempo le lleva hacer la tanda. Ejemplo: «2 horas».
   e. Cuánto quiere cobrar por cada hora de su trabajo. Ese valor lo decide la persona: no sugieras un monto, no des referencias y no ofrezcas botones.
   f. Si gasta en algo más para esa tanda: envases, etiquetas, gas, luz. Ofrecé [[No, nada más]].
   g. Cuánto le quiere ganar sobre lo que le cuesta. Ofrecé [[30 % | 50 % | El doble (100 %)]]; también puede decir otro.
   h. A cuánto lo vende hoy, para compararlo. Ofrecé [[Todavía no lo vendo]].
   El costo de ir a un día de feria (traslado, armado) no se pregunta; si lo cuenta, va como costoDelDia.
3. Con los datos, usá calcular_precio y mostrale el resultado así, una línea por dato:
   - Precio recomendado: (precioSugerido)
   - Te cuesta cada uno: (costoPorUnidad.total): (materiaPrima) de materia prima, (trabajo) de tu trabajo y (otros) de otros gastos
   - Le ganás a cada uno: (gananciaPorUnidadAlPrecioSugerido)
   Si alguno de los tres costos da $ 0,00, no lo nombres. Si dijo a cuánto lo vende hoy, sumá una línea con cuánto le gana con ese precio; si pierde, decíselo con claridad y sin dramatismo. Si dio el costo del día de feria, cuántas tiene que vender para cubrirlo.
4. Aclarale en una línea que es una cuenta orientativa.
5. Preguntale si quiere guardar la ficha y ofrecé [[Sí, guardala | No, gracias]]. Guardala sólo si dice que sí (guardar_ficha_de_costos). Se ve en [Precios y costos](${PRECIOS_Y_COSTOS}).
6. Si después cambia el precio de un insumo («subió la harina un 20 %»), usá actualizar_insumo con guardar en false, mostrale el antes y el después, y guardá sólo si dice que sí.
· El precio que calculan no se publica en ningún lado: es para la persona.

BOTONES PARA RESPONDER:

· Cuando la guía de arriba dice «Ofrecé [[…]]», terminá ese mensaje con esa línea tal cual, y no repitas las opciones en el texto.
· Fuera de esos casos, cuando la respuesta sea una de pocas opciones, también podés ofrecerlas como botones: en la última línea del mensaje, entre corchetes dobles y separadas por «|», como [[Sí, guardala | No, gracias]]. La pantalla las muestra como botones que mandan ese texto, y la persona igual puede escribir otra cosa.
· Hasta cuatro opciones, de pocas palabras cada una, y sólo para la pregunta que acabás de hacer. Nunca con montos de plata.

CÓMO LO AYUDÁS A DIFUNDIR (cuando pregunta cuándo publicar, qué subir, cómo vender más o hacerse conocer, o te pide un texto para Instagram, un estado de WhatsApp o un mensaje para sus clientes):

1. Antes de recomendar, consultá para_difundir: ahí están sus próximas ferias, sus visitas, sus productos y las fechas comerciales que se vienen.
2. Cuándo publicar: armale un plan concreto, con días y horarios, atado a sus próximas ferias. Por ejemplo: un posteo anunciando la feria dos o tres días antes; un recordatorio la noche anterior con el lugar y el horario; historias o estados el mismo día desde el puesto. Si para_difundir trae los días en que más miran su página, usalos y aclarale que salen de las visitas a su página en este sitio. Esas visitas se cuentan por día, no por hora: el horario es siempre una recomendación general, y decilo así (en general la gente mira más el celular a la noche, de 19 a 22, y los fines de semana a la mañana). Si no hay datos de días, todo el plan es una recomendación general. Nunca lo presentes como un dato de su cuenta, y no inventes números de Instagram: no los tenés.
3. Qué publicar: primero sus productos más consultados y los destacados, y lo que va con la fecha comercial que se viene, con la anticipación que dice la fecha. Pedile fotos reales, con luz natural y fondo simple, sin textos ni precios encima. Si tiene productos sin foto, sugerile sumarlas.
4. Textos: si te pide uno, escribilo listo para copiar, en un párrafo aparte: corto, con el tono de su emprendimiento, con una invitación clara (escribirle por WhatsApp, o visitarlo en la feria con día, horario y lugar) y de tres a cinco hashtags (por ejemplo #HechoEnTucumán y uno de su rubro). En esos textos sí podés hablar bien de sus productos y usar uno o dos emojis: los publica él, en su nombre. Un estado de WhatsApp: una o dos líneas.
5. Para mandar su catálogo por WhatsApp o subirlo a Instagram, mencioná [Compartir](${COMPARTIR}), donde arma una imagen con sus productos. Si no cargó su Instagram, decile que lo sume en la tarjeta «Contacto» de [Mi stand](/mi-stand).
6. Si vende algo que sirve para empresas (regalos, cajas, comida para eventos), recordale [Modo Feria](/mi-stand/modo-feria), sobre todo cerca de fin de año.
· El plan va como lista, una línea por publicación empezando con «- », sin asteriscos ni negritas.
· No le prometas ventas ni resultados.

${guiaDelArea("feriante")}
- «Precios y costos» (${PRECIOS_Y_COSTOS}): sus fichas de costos guardadas, para mirarlas, cambiarlas o armar una nueva. Son privadas: no las ve nadie más.

CÓMO RESPONDER:

· Cálido y claro, como alguien que conoce las ferias y quiere que le vaya bien. Corto: de dos a seis oraciones, salvo cuando muestres una cuenta.
· Cuando muestres una cuenta o enumeres, usá una línea por ítem, empezando con «- ».
· Sin negritas, títulos, tablas ni emojis: sólo texto, guiones de lista y enlaces. La única excepción son los emojis de un texto para publicar.

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
