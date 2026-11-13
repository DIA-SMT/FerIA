/**
 * Tipos de la redacción asistida de la descripción del emprendimiento.
 *
 * Separado de `@/lib/ia-texto` porque ese módulo importa el cliente de
 * OpenRouter: si el componente de cliente importara de ahí, el SDK se iría al
 * bundle del navegador. Acá no hay nada que no pueda cruzar esa frontera.
 */

/**
 * Mejorar lo que el feriante ya escribió, o escribir con lo que contestó en la
 * entrevista.
 *
 * Hubo un tercero, «borrador», que armaba la estructura con huecos entre
 * corchetes para completar. Se sacó: dejaba un texto largo que había que ir
 * borrando y reemplazando pedazo por pedazo, y las preguntas resuelven lo mismo
 * —no inventar lo que no se sabe— sin hacerle ese trabajo a la persona.
 */
export type ModoRedaccion = "mejorar" | "entrevista";

/**
 * Desde qué pantalla se pide: el perfil de un feriante aprobado o la encuesta
 * del alta, donde todavía no hay ficha. Cambia qué se exige para entrar.
 */
export type PuertaRedaccion = "perfil" | "alta";

/** Lo que el formulario tiene en pantalla cuando se pide ayuda. */
export interface PedidoRedaccion {
  puerta: PuertaRedaccion;
  emprendimiento: string;
  rubro: string;
  descripcion: string;
}

/** Una pregunta de la entrevista y lo que contestó la persona. */
export interface RespuestaEntrevista {
  pregunta: string;
  /** Vacía si la salteó: ese tema no va en el texto. */
  respuesta: string;
}

export interface EstadoRedaccion {
  ok?: boolean;
  mensaje?: string;
  /** Texto propuesto. Nunca se aplica solo: lo acepta el feriante. */
  sugerencia?: string;
  /** Con qué modo se generó, para rotular el panel. */
  modo?: ModoRedaccion;
}

export interface EstadoPreguntas {
  ok?: boolean;
  mensaje?: string;
  preguntas?: string[];
}

/** Tope del campo en la base. El prompt apunta bastante más abajo. */
export const MAXIMO_DESCRIPCION = 2000;

/** Tope de cada respuesta: se piden de una o dos líneas. */
export const MAXIMO_RESPUESTA = 500;

/** Tope de cada pregunta, para lo que vuelve del navegador. */
export const MAXIMO_PREGUNTA = 200;

/** Cuántas preguntas se le hacen, como mucho. */
export const MAXIMO_PREGUNTAS = 5;

/**
 * Por debajo de esto no hay nada que mejorar, y pedirlo sale mal.
 *
 * Medido: con «hago tazas» (10 caracteres) en modo mejorar, el modelo devolvió
 * un texto tan corto que no servía —lo correcto, porque se negó a inventar el
 * resto, pero deja al feriante con un error en la cara—. Con tan poco escrito lo
 * útil es preguntarle, que es la entrevista.
 */
export const MINIMO_PARA_MEJORAR = 120;

/** Con cuánto texto alcanza para mejorar en vez de preguntar. */
export function alcanzaParaMejorar(descripcion: string | null): boolean {
  return (descripcion?.trim().length ?? 0) >= MINIMO_PARA_MEJORAR;
}

/** Las respuestas con algo escrito; las salteadas no cuentan. */
export function respuestasContestadas(
  respuestas: RespuestaEntrevista[],
): RespuestaEntrevista[] {
  return respuestas
    .map((r) => ({ pregunta: r.pregunta.trim(), respuesta: r.respuesta.trim() }))
    .filter((r) => r.pregunta && r.respuesta);
}
