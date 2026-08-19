/**
 * Tipos de la redacción asistida de la descripción del emprendimiento.
 *
 * Separado de `@/lib/ia-texto` porque ese módulo importa el cliente de
 * OpenRouter: si el componente de cliente importara de ahí, el SDK se iría al
 * bundle del navegador. Acá no hay nada que no pueda cruzar esa frontera.
 */

/** Escribir de cero, o mejorar lo que el feriante ya escribió. */
export type ModoRedaccion = "borrador" | "mejorar";

export interface EstadoRedaccion {
  ok?: boolean;
  mensaje?: string;
  /** Texto propuesto. Nunca se aplica solo: lo acepta el feriante. */
  sugerencia?: string;
  /** Con qué modo se generó, para rotular el panel. */
  modo?: ModoRedaccion;
}

export const ESTADO_REDACCION_INICIAL: EstadoRedaccion = {};

/** Tope del campo en la base. El prompt apunta bastante más abajo. */
export const MAXIMO_DESCRIPCION = 2000;

/**
 * Por debajo de esto no hay nada que mejorar, y pedirlo sale mal.
 *
 * Medido: con «hago tazas» (10 caracteres) en modo mejorar, el modelo devolvió
 * un texto tan corto que no servía —lo correcto, porque se negó a inventar el
 * resto, pero deja al feriante con un error en la cara—. Con tan poco escrito lo
 * útil es armarle la estructura conservando sus palabras, que es el borrador.
 */
export const MINIMO_PARA_MEJORAR = 120;

/** Qué corresponde hacer con lo que el feriante tiene escrito hoy. */
export function modoSegunTexto(descripcion: string | null): ModoRedaccion {
  const escrito = descripcion?.trim() ?? "";
  return escrito.length >= MINIMO_PARA_MEJORAR ? "mejorar" : "borrador";
}
