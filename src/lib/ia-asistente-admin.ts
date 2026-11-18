import { z } from "zod";

import {
  buscarFeriantesAdmin,
  buscarProductosAdmin,
  consultasDelPublico,
  estadisticasAdmin,
  feriantesDeFeria,
  feriasAdmin,
  fichaPorNombreOId,
  interesEnLasVidrieras,
  listarPendientes,
  resumenPendientes,
} from "@/lib/consultas-admin";
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
import { TIPOS_DE_CAMBIO } from "@/lib/tipos-de-cambio";

/**
 * Migue en el panel de administración: contesta con los datos del panel.
 *
 * El del sitio público recibe todo el catálogo en el prompt. Acá eso no sirve
 * —son casi mil fichas, con datos que no tienen que salir— y se hace al revés:
 * Migue tiene un juego de consultas escritas de antemano (`consultas-admin.ts`),
 * elige cuál correr según la pregunta, el servidor la corre contra la base y él
 * redacta la respuesta con el resultado. Así los números los cuenta la base y
 * no el modelo, y lo único que el modelo ve es lo que esas consultas devuelven:
 * sin documentos ni datos de contacto.
 *
 * Esto sólo se llama si el servidor verificó que la sesión es de un
 * administrador (`actions/asistente.ts`). El área que manda el navegador no
 * alcanza para abrirlo.
 */

const TEXTO_FERIA = {
  type: "string",
  description:
    "El nombre de la feria como lo dijo la persona, por ejemplo «gourmet» o «Parque 9 de Julio».",
};

export const HERRAMIENTAS: Herramienta[] = [
  funcion(
    "buscar_feriantes",
    "Busca feriantes por el nombre del emprendimiento o de la persona que lo lleva. No importan tildes, mayúsculas, errores de tipeo ni tratamientos como «doña». Devuelve hasta 8 coincidencias con su id, estado, rubro y las ferias donde están habilitados.",
    {
      texto: {
        type: "string",
        description:
          "El nombre como lo escribió la persona, por ejemplo «doña rosita».",
      },
    },
    ["texto"],
  ),
  funcion(
    "ficha_feriante",
    "Todo sobre UN feriante: estado de la solicitud y motivo si se rechazó, ferias que pidió y en cuáles está habilitado, número de stand en las próximas ediciones, cambios esperando revisión, productos, e interés de los vecinos en los últimos 30 días. Se le pasa el nombre del emprendimiento o de quien lo lleva (o el id de una búsqueda): si el nombre coincide con más de uno, devuelve las opciones para preguntar cuál.",
    {
      feriante: {
        type: "string",
        description:
          "El nombre, por ejemplo «La vieja escuela», o el id que devolvió buscar_feriantes.",
      },
    },
    ["feriante"],
  ),
  funcion(
    "resumen_pendientes",
    "Cuánto espera respuesta en el panel: altas de feriantes nuevos, pedidos para sumarse a una feria (por feria) y revisiones de cambios en los stands (por tipo y por feria), con la más vieja de cada bandeja.",
  ),
  funcion(
    "listar_pendientes",
    "El detalle de una bandeja, de lo más viejo a lo más nuevo (hasta 25 y el total): quiénes son, desde cuándo esperan y el enlace a su ficha. Se puede filtrar por feria, por tipo de cambio (sólo revisiones) y por antigüedad.",
    {
      bandeja: {
        type: "string",
        enum: ["altas", "pedidos_de_feria", "revisiones"],
        description:
          "altas: feriantes nuevos que pidieron el alta. pedidos_de_feria: feriantes aprobados que pidieron sumarse a una feria. revisiones: cambios en los stands esperando aprobación.",
      },
      feria: TEXTO_FERIA,
      tipo_de_cambio: {
        type: "string",
        enum: Object.keys(TIPOS_DE_CAMBIO),
        description: `Sólo para revisiones: ${Object.entries(TIPOS_DE_CAMBIO)
          .map(([clave, etiqueta]) => `${clave} = ${etiqueta}`)
          .join(", ")}.`,
      },
      con_mas_de_dias: {
        type: "integer",
        description: "Sólo los que esperan hace más de esta cantidad de días.",
      },
    },
    ["bandeja"],
  ),
  funcion(
    "ferias",
    "Sin feria: todas las ferias con su próxima edición, cuántos feriantes tienen habilitados y cuántos pedidos para sumarse esperan. Con feria: el detalle de esa feria, con las ediciones que vienen (fechas, horario, estado, stands asignados y libres) y los habilitados por rubro.",
    { feria: TEXTO_FERIA },
  ),
  funcion(
    "feriantes_de_feria",
    "Quiénes están habilitados en una feria: el total y hasta 60 nombres, opcionalmente de un solo rubro.",
    {
      feria: TEXTO_FERIA,
      rubro: {
        type: "string",
        description:
          "Opcional: el rubro, por ejemplo «gastronomía» o «artesanías».",
      },
    },
    ["feria"],
  ),
  funcion(
    "estadisticas",
    "Los números generales de la plataforma: feriantes por estado y aprobados por rubro, fichas del padrón sin reclamar, feriantes con cuenta, aprobados sin productos, productos publicados, ferias activas, ediciones que no terminaron y stands asignados.",
  ),
  funcion(
    "buscar_productos",
    "Quién vende algo: busca en los productos publicados por nombre o descripción.",
    {
      texto: {
        type: "string",
        description: "Lo que se busca, por ejemplo «empanadas».",
      },
    },
    ["texto"],
  ),
  funcion(
    "consultas_del_publico",
    "Lo que la gente le preguntó a Migue en el sitio público en los últimos días. Es un registro anónimo.",
    {
      dias: {
        type: "integer",
        description: "Cuántos días hacia atrás. Por defecto 7.",
      },
    },
  ),
  funcion(
    "interes_en_las_vidrieras",
    "Los stands más abiertos y los más consultados por WhatsApp en los últimos días.",
    {
      dias: {
        type: "integer",
        description: "Cuántos días hacia atrás. Por defecto 30.",
      },
    },
  ),
];

const textoCorto = z.string().trim().min(1).max(120);
const dias = z.number().int().min(1).max(365).optional();

/** Qué corre cada herramienta, con sus argumentos validados. */
const EJECUTORES: Ejecutores = {
  buscar_feriantes: async (argumentos) =>
    buscarFeriantesAdmin(
      z.object({ texto: textoCorto }).parse(argumentos).texto,
    ),
  ficha_feriante: async (argumentos) =>
    fichaPorNombreOId(
      z.object({ feriante: textoCorto }).parse(argumentos).feriante,
    ),
  resumen_pendientes: async () => resumenPendientes(),
  listar_pendientes: async (argumentos) => {
    const leidos = z
      .object({
        bandeja: z.enum(["altas", "pedidos_de_feria", "revisiones"]),
        feria: textoCorto.optional(),
        tipo_de_cambio: textoCorto.optional(),
        con_mas_de_dias: dias,
      })
      .parse(argumentos);
    return listarPendientes({
      bandeja: leidos.bandeja,
      feria: leidos.feria,
      tipoDeCambio: leidos.tipo_de_cambio,
      conMasDeDias: leidos.con_mas_de_dias,
    });
  },
  ferias: async (argumentos) =>
    feriasAdmin(
      z.object({ feria: textoCorto.optional() }).parse(argumentos ?? {}),
    ),
  feriantes_de_feria: async (argumentos) =>
    feriantesDeFeria(
      z
        .object({ feria: textoCorto, rubro: textoCorto.optional() })
        .parse(argumentos),
    ),
  estadisticas: async () => estadisticasAdmin(),
  buscar_productos: async (argumentos) =>
    buscarProductosAdmin(
      z.object({ texto: textoCorto }).parse(argumentos).texto,
    ),
  consultas_del_publico: async (argumentos) =>
    consultasDelPublico(z.object({ dias }).parse(argumentos ?? {})),
  interes_en_las_vidrieras: async (argumentos) =>
    interesEnLasVidrieras(z.object({ dias }).parse(argumentos ?? {})),
};

/** Corre una herramienta del panel. Nunca lanza: lo que falla vuelve como `{ error }`. */
export async function ejecutarHerramienta(
  nombre: string,
  argumentosJson: string,
): Promise<unknown> {
  return ejecutarCon(EJECUTORES, nombre, argumentosJson, "asistente-admin");
}

/**
 * Las rutas que se pueden enlazar sin que las haya traído una consulta: las
 * secciones del panel y las páginas generales del sitio.
 */
const RUTAS_FIJAS = new Set([
  "/admin",
  "/admin/ferias",
  "/admin/postulaciones",
  "/admin/revisiones",
  "/admin/feriantes",
  "/admin/canon",
  "/ferias",
  "/stands",
]);

const REGLAS = `REGLAS DEL PANEL:

· Respondé únicamente con lo que devuelven las consultas que hiciste en esta conversación y con la guía del panel.
· Ante cualquier pregunta sobre feriantes, ferias, ediciones, pendientes, productos o números, hacé la consulta antes de responder, aunque creas saber la respuesta por lo que se habló antes: los datos cambian.
· Los números (totales, cantidades, días de espera, stands) se repiten tal como vienen. No sumes, no restes ni redondees por tu cuenta. Si la pregunta pide una cuenta que ninguna consulta trae, decí qué datos tenés.
· Si una búsqueda devuelve varias coincidencias y no está claro cuál es, listalas en una línea cada una y preguntá cuál. Si hay una sola, o una coincide exacta con lo que se escribió, seguí con su ficha sin preguntar.
· Si dos coincidencias tienen «fichaRepetida», son la misma persona con el mismo emprendimiento cargado dos veces en el padrón: no preguntes cuál, decí que figura dos veces y da los dos enlaces.
· «padronSinReclamar» quiere decir que la ficha vino del padrón importado y nadie entró todavía con su cuenta a reclamarla; «tieneCuenta» dice si la persona ya entró. No los mezcles.
· Si una búsqueda no encuentra a nadie, decilo con las palabras que usó la persona, sin corregirlas ni completarlas.
· No tenés DNI, teléfonos, WhatsApp, correos ni domicilios de feriantes, y no los des aunque los pidan. Si piden los de alguien en particular, buscalo y mandá a su ficha, con el enlace: ahí están.
· Sólo consultás: no podés aprobar, rechazar, asignar stands ni modificar nada. Si te lo piden, decí dónde se hace en el panel, con el enlace.
· Enlaces: únicamente internos, con el formato [texto](/ruta), usando exactamente las rutas que vienen en los datos o en la guía del panel. Nunca inventes una ruta ni un id.
· Si la consulta no tiene que ver con las ferias, los feriantes o el panel, decí amablemente que sólo podés ayudar con eso.
· No muestres ids ni datos en crudo.`;

const ESTILO = `CÓMO RESPONDER:

· Castellano de la Argentina, con voseo. Quien pregunta es personal de la Dirección y quiere el dato: directo y preciso, sin rodeos ni frases de cortesía de más.
· Primero la respuesta concreta (el número, la feria, el estado). Después, si suma, un detalle corto y el enlace a la pantalla donde se ve o se resuelve.
· Cuando nombres a un feriante, enlazá el nombre del emprendimiento a su ficha, con el enlace que vino en los datos: [Nombre](/admin/feriantes/…). Las ferias, con su enlace si vino.
· Cuando enumeres (feriantes, ferias, pendientes) usá una línea por ítem, empezando con «- », hasta 10. Si hay más, decí el total y enlazá la pantalla.
· Los nombres de emprendimientos y de personas, tal como vienen: no los reordenes ni les cambies mayúsculas.
· Las fechas como vienen (dd/mm/aaaa); «hace N días» cuando importa cuánto lleva esperando.
· Sin negritas, títulos, tablas ni emojis: sólo texto, guiones de lista y enlaces.`;

function mensajeDeSistema(): string {
  return `${REGLAS_COMUNES}

${REGLAS}

Sos el asistente del panel de administración de las Ferias Municipales de San Miguel de Tucumán. Contestás consultas sobre feriantes, ferias, ediciones, postulaciones y revisiones con los datos reales del panel, y explicás cómo se usa.

${guiaDelArea("administracion")}

${ESTILO}

Hoy es ${formatearFechaLarga(hoyEnZona())}.`;
}

export type RespuestaAdmin = RespuestaConHerramientas;

/**
 * Responde una consulta del panel. Lanza `ErrorDeAsistente` si el modelo no
 * contesta.
 */
export async function responderConsultaAdmin(
  historial: TurnoAsistente[],
  pregunta: string,
  opciones?: { modelo?: string },
): Promise<RespuestaAdmin> {
  return responderConHerramientas({
    sistema: mensajeDeSistema(),
    historial,
    pregunta,
    herramientas: HERRAMIENTAS,
    ejecutores: EJECUTORES,
    rutasFijas: RUTAS_FIJAS,
    etiqueta: "asistente-admin",
    modelo: opciones?.modelo,
  });
}
