import type OpenAI from "openai";
import { z } from "zod";

import { obtenerClienteIA } from "@/lib/ai";
import { sinMarkdown, sinSaludoRepetido } from "@/lib/migue-reglas";
import {
  ErrorDeAsistente,
  MODELO_ASISTENTE_POR_DEFECTO,
  type TurnoAsistente,
} from "@/lib/ia-asistente";

/**
 * Migue con consultas: lo que comparten el del panel de administración y el
 * del feriante.
 *
 * En los dos el modelo no recibe los datos de entrada: tiene un juego de
 * consultas escritas de antemano, elige cuál correr según la pregunta, el
 * servidor la corre y él redacta con el resultado. Acá vive ese ciclo, más las
 * dos defensas que valen para cualquiera de los dos: los argumentos se validan
 * antes de tocar la base, y los enlaces que no salieron de una consulta se
 * sacan antes de mostrar la respuesta.
 */

/** Tope de vueltas consulta → respuesta. En la última se le pide contestar. */
const MAXIMO_VUELTAS = 5;
/** Tope de consultas por vuelta, por si el modelo pide de más. */
const MAXIMO_LLAMADAS_POR_VUELTA = 6;

export type Herramienta = OpenAI.Chat.Completions.ChatCompletionTool;

/** Una consulta que se le ofrece al modelo, con sus parámetros. */
export const funcion = (
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): Herramienta => ({
  type: "function",
  function: {
    name,
    description,
    parameters: { type: "object", properties, required },
  },
});

export type Ejecutores = Record<
  string,
  (argumentos: unknown) => Promise<unknown>
>;

/**
 * Corre una herramienta. Nunca lanza: lo que falla vuelve como `{ error }`,
 * que el modelo puede leer y explicar, en vez de tirar abajo la respuesta.
 */
export async function ejecutarCon(
  ejecutores: Ejecutores,
  nombre: string,
  argumentosJson: string,
  etiqueta = "asistente",
): Promise<unknown> {
  const ejecutor = ejecutores[nombre];
  if (!ejecutor) return { error: `No existe la consulta «${nombre}».` };

  let argumentos: unknown;
  try {
    argumentos = argumentosJson.trim() ? JSON.parse(argumentosJson) : {};
  } catch {
    return { error: "Los argumentos no son JSON válido." };
  }

  try {
    return await ejecutor(argumentos);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: "Argumentos inválidos.",
        detalle: error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    console.error(`[${etiqueta}] falló ${nombre}`, error);
    return { error: "La consulta falló. Probá de nuevo en un rato." };
  }
}

/** Junta todas las rutas internas que aparecen en un resultado. */
function juntarRutas(valor: unknown, rutas: Set<string>): void {
  if (typeof valor === "string") {
    if (valor.startsWith("/")) rutas.add(valor);
  } else if (Array.isArray(valor)) {
    for (const item of valor) juntarRutas(item, rutas);
  } else if (valor && typeof valor === "object") {
    for (const item of Object.values(valor)) juntarRutas(item, rutas);
  }
}

/**
 * Saca los enlaces que no salieron de los datos y deja su texto.
 *
 * Las reglas le piden no inventar rutas, y aun así, en las pruebas, armó una
 * vez `/admin/ferias/<id>` con un id que no existe. Un enlace roto es peor que
 * ninguno: parece un dato. Así que no se confía en la regla sola: se enlaza
 * únicamente lo que trajo una consulta o una sección fija.
 */
export function limpiarEnlaces(
  texto: string,
  permitidas: Set<string>,
  fijas: Set<string>,
): string {
  return texto.replace(
    /\[([^\]]+)\]\((\/[^\s)]*)\)/g,
    (entero, etiqueta: string, ruta: string) => {
      const sinConsulta = ruta.split(/[?#]/)[0]!;
      return permitidas.has(ruta) ||
        permitidas.has(sinConsulta) ||
        fijas.has(sinConsulta)
        ? entero
        : etiqueta;
    },
  );
}

export interface RespuestaConHerramientas {
  texto: string;
  /** Las consultas que corrió, en orden: van al registro. */
  herramientas: string[];
}

/**
 * El ciclo: pregunta → consultas → respuesta. Lanza `ErrorDeAsistente` si el
 * modelo no contesta.
 */
export async function responderConHerramientas({
  sistema,
  historial,
  pregunta,
  herramientas,
  ejecutores,
  rutasFijas,
  etiqueta,
  modelo,
}: {
  sistema: string;
  historial: TurnoAsistente[];
  pregunta: string;
  herramientas: Herramienta[];
  ejecutores: Ejecutores;
  /** Las rutas que se pueden enlazar sin que las traiga una consulta. */
  rutasFijas: Set<string>;
  /** Para los registros de error: de qué Migue es. */
  etiqueta: string;
  modelo?: string;
}): Promise<RespuestaConHerramientas> {
  const cliente = obtenerClienteIA();
  const mensajes: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: sistema },
    ...historial.map((turno) => ({
      role:
        turno.rol === "usuario" ? ("user" as const) : ("assistant" as const),
      content: turno.texto,
    })),
    { role: "user", content: pregunta },
  ];
  const usadas: string[] = [];
  const rutas = new Set<string>();

  for (let vuelta = 0; vuelta < MAXIMO_VUELTAS; vuelta++) {
    const ultima = vuelta === MAXIMO_VUELTAS - 1;

    let respuesta;
    try {
      respuesta = await cliente.chat.completions.create({
        model: modelo ?? MODELO_ASISTENTE_POR_DEFECTO,
        // Las respuestas pueden traer una lista o un desglose: más aire que
        // las del público, igual con tope por costo.
        max_tokens: 1400,
        temperature: 0.2,
        messages: mensajes,
        tools: herramientas,
        // En la última vuelta ya no se le deja consultar: tiene que contestar
        // con lo que juntó.
        tool_choice: ultima ? "none" : "auto",
      });
    } catch (error) {
      throw new ErrorDeAsistente(
        `No se pudo contactar al asistente: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      );
    }

    const mensaje = respuesta.choices?.[0]?.message;
    const llamadas = (mensaje?.tool_calls ?? []).slice(
      0,
      MAXIMO_LLAMADAS_POR_VUELTA,
    );

    if (llamadas.length === 0 || ultima) {
      let texto = mensaje?.content?.trim();
      if (!texto)
        throw new ErrorDeAsistente(
          "El asistente no devolvió ninguna respuesta.",
        );
      // Si se cortó por largo, el último renglón quedó a medias —a veces con
      // un enlace sin cerrar, que se ve como texto roto—: se saca entero.
      if (respuesta.choices?.[0]?.finish_reason === "length") {
        const corte = texto.lastIndexOf("\n");
        texto = `${corte > 0 ? texto.slice(0, corte).trimEnd() : texto}\n…`;
      }
      return {
        texto: sinSaludoRepetido(
          sinMarkdown(limpiarEnlaces(texto, rutas, rutasFijas)),
          pregunta,
        ),
        herramientas: usadas,
      };
    }

    mensajes.push({
      role: "assistant",
      content: mensaje?.content ?? null,
      tool_calls: llamadas,
    });

    // Una por vez y en el orden en que las pidió: alguna puede guardar algo
    // que la siguiente lee.
    for (const llamada of llamadas) {
      usadas.push(llamada.function.name);
      const resultado = await ejecutarCon(
        ejecutores,
        llamada.function.name,
        llamada.function.arguments,
        etiqueta,
      );
      juntarRutas(resultado, rutas);
      mensajes.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: JSON.stringify(resultado),
      });
    }
  }

  throw new ErrorDeAsistente("El asistente no llegó a una respuesta.");
}
