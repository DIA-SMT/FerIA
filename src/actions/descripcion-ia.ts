"use server";

import { Rubro } from "@prisma/client";
import { z } from "zod";

import { esControlDeFlujoDeNext } from "@/lib/errores";
import {
  ErrorDeRedaccion,
  generarPreguntasConIA,
  redactarDescripcionConIA,
  type ContextoEmprendimiento,
  type TareaRedaccion,
} from "@/lib/ia-texto";
import { RUBROS } from "@/lib/labels";
import { crearLimiteDeRitmo } from "@/lib/limite-de-ritmo";
import {
  alcanzaParaMejorar,
  MAXIMO_DESCRIPCION,
  MAXIMO_PREGUNTA,
  MAXIMO_PREGUNTAS,
  MAXIMO_RESPUESTA,
  respuestasContestadas,
  type EstadoPreguntas,
  type EstadoRedaccion,
  type PedidoRedaccion,
  type RespuestaEntrevista,
} from "@/lib/redaccion";
import { requerirSesion, requerirVendedorAprobado } from "@/lib/session";

/**
 * Redacción asistida de la descripción del emprendimiento.
 *
 * Devuelve una propuesta y nada más: no toca la base. El feriante la acepta, la
 * descarta o pide otra, y si la acepta puede volver a su texto anterior. Guardar
 * sigue siendo cosa del formulario donde está el campo.
 *
 * Con poco escrito, primero se le hacen unas preguntas (`prepararEntrevista`) y
 * el texto sale de lo que contesta. Con bastante escrito, se pule eso.
 *
 * Hay dos puertas, una por pantalla: el perfil del feriante aprobado y la
 * encuesta del alta, donde todavía no hay ficha. Las dos acciones las aceptan
 * y cada una exige lo suyo.
 *
 * Los tipos están en `@/lib/redaccion` porque este módulo es `"use server"` y
 * sólo puede exportar funciones async.
 */

/** Las preguntas de la entrevista, adaptadas al rubro. */
export async function prepararEntrevista(
  pedido: PedidoRedaccion,
): Promise<EstadoPreguntas> {
  try {
    const entrada = await abrir(pedido);
    if (!entrada.ok) return entrada;

    if (superaElLimite(entrada.clave)) return LIMITE_SUPERADO;

    return { ok: true, preguntas: await generarPreguntasConIA(entrada.contexto) };
  } catch (error) {
    return comoError(error, "No se pudieron preparar las preguntas.");
  }
}

/**
 * La propuesta de texto: con las respuestas de la entrevista si vienen, o
 * puliendo lo escrito si no.
 */
export async function redactarDescripcion(
  pedido: PedidoRedaccion,
  respuestas?: RespuestaEntrevista[],
): Promise<EstadoRedaccion> {
  try {
    const entrada = await abrir(pedido);
    if (!entrada.ok) return entrada;

    const { contexto } = entrada;
    const tarea = elegirTarea(contexto, respuestas);
    if ("mensaje" in tarea) return { ok: false, mensaje: tarea.mensaje };

    if (superaElLimite(entrada.clave)) return LIMITE_SUPERADO;

    const sugerencia = await redactarDescripcionConIA(tarea, contexto);

    return { ok: true, sugerencia, modo: tarea.modo };
  } catch (error) {
    return comoError(error, "No se pudo redactar la descripción. Probá de nuevo.");
  }
}

// --- Entrada ----------------------------------------------------------------

/** Lo que llega del navegador no se cree: se recorta y se valida. */
const PEDIDO = z.object({
  puerta: z.enum(["perfil", "alta"]),
  emprendimiento: z.string().max(500),
  rubro: z.string().max(50),
  descripcion: z.string().max(MAXIMO_DESCRIPCION * 2),
});

const RESPUESTAS = z
  .array(
    z.object({
      pregunta: z.string().max(MAXIMO_PREGUNTA),
      respuesta: z.string().max(MAXIMO_RESPUESTA),
    }),
  )
  .max(MAXIMO_PREGUNTAS);

const PEDIDO_INVALIDO = {
  ok: false,
  mensaje: "El pedido llegó incompleto. Recargá la página y probá de nuevo.",
} as const;

type Entrada =
  | {
      ok: true;
      contexto: ContextoEmprendimiento;
      /** A quién se le cuentan las llamadas; `null` si no tiene límite. */
      clave: string | null;
    }
  | { ok: false; mensaje: string };

/**
 * Valida el pedido, exige lo que pide cada puerta y arma el contexto.
 *
 * En el perfil el nombre y el rubro se leen del formulario porque el feriante
 * puede estar editándolos en esa misma pantalla; si vienen inservibles, se cae
 * a lo que hay guardado. En el alta no hay ficha a qué caer: tienen que venir,
 * y el botón no se ofrece hasta que estén.
 */
async function abrir(pedido: PedidoRedaccion): Promise<Entrada> {
  const lectura = PEDIDO.safeParse(pedido);
  if (!lectura.success) return PEDIDO_INVALIDO;

  const { puerta, emprendimiento, rubro, descripcion } = lectura.data;
  const nombreEnviado = emprendimiento.trim().slice(0, 120);
  const rubroEnviado = rubro in Rubro ? (rubro as Rubro) : null;
  const escrito = descripcion.slice(0, MAXIMO_DESCRIPCION);

  if (puerta === "perfil") {
    const { vendedor } = await requerirVendedorAprobado();
    return {
      ok: true,
      clave: null,
      contexto: {
        nombre: nombreEnviado || vendedor.emprendimiento,
        categoria: RUBROS[rubroEnviado ?? vendedor.rubro],
        descripcion: escrito,
      },
    };
  }

  const sesion = await requerirSesion();
  if (!nombreEnviado || !rubroEnviado) {
    return {
      ok: false,
      mensaje: "Completá el nombre y el rubro, así la IA sabe de qué escribir.",
    };
  }

  return {
    ok: true,
    clave: sesion.id,
    contexto: {
      nombre: nombreEnviado,
      categoria: RUBROS[rubroEnviado],
      descripcion: escrito,
    },
  };
}

/**
 * Sin respuestas, se pule lo escrito, y para eso tiene que haber bastante. Con
 * respuestas, se escribe con ellas, y alcanza con que haya algo: una contestada
 * o lo poco que ya estaba en el campo.
 */
function elegirTarea(
  contexto: ContextoEmprendimiento,
  respuestas: RespuestaEntrevista[] | undefined,
): TareaRedaccion | { mensaje: string } {
  if (respuestas === undefined) {
    return alcanzaParaMejorar(contexto.descripcion ?? "")
      ? { modo: "mejorar" }
      : { mensaje: "Hay muy poco escrito para mejorarlo. Probá con las preguntas." };
  }

  const lista = RESPUESTAS.safeParse(respuestas);
  if (!lista.success) return { mensaje: PEDIDO_INVALIDO.mensaje };

  const contestadas = respuestasContestadas(lista.data);
  if (contestadas.length === 0 && !contexto.descripcion?.trim()) {
    return {
      mensaje: "No contestaste ninguna pregunta, así que no hay de qué escribir.",
    };
  }

  return { modo: "entrevista", respuestas: contestadas };
}

/**
 * Veinte llamadas cada diez minutos por cuenta, en el alta.
 *
 * El perfil no lo necesita: ahí entra sólo quien la Dirección ya aprobó. En la
 * encuesta alcanza con haber entrado por CiDiTuc, y cada llamada al modelo se
 * paga. Una entrevista son dos (las preguntas y el texto) y cada «Probar otra»
 * una más, así que veinte da para varias vueltas de sobra.
 */
const superaElLimiteDelAlta = crearLimiteDeRitmo({
  ventanaMs: 10 * 60 * 1000,
  maximo: 20,
});

function superaElLimite(clave: string | null): boolean {
  return clave !== null && superaElLimiteDelAlta(clave);
}

const LIMITE_SUPERADO = {
  ok: false,
  mensaje: "Pediste muchas redacciones seguidas. Esperá unos minutos y probá de nuevo.",
} as const;

function comoError(
  error: unknown,
  porDefecto: string,
): { ok: false; mensaje: string } {
  if (esControlDeFlujoDeNext(error)) throw error;

  return {
    ok: false,
    mensaje:
      error instanceof ErrorDeRedaccion || error instanceof Error
        ? error.message
        : porDefecto,
  };
}
