/**
 * Lo que comparten la acción que genera la imagen publicitaria, su ruta y la
 * pantalla de «Compartir». Aparte porque la acción es `"use server"` —sólo
 * puede exportar funciones— y `ia-publicidad.ts` usa sharp y el cliente de IA,
 * que no pueden ir al navegador.
 */

export type FormatoPublicidad = "publicacion" | "historia";

/** Con más de tres productos la escena se amontona y la IA los cambia más. */
export const MAXIMO_PRODUCTOS_PUBLICIDAD = 3;

/** Cada escena es una llamada paga al modelo de imagen (unos 4 centavos de dólar). */
export const PUBLICIDADES_POR_DIA = 10;

/**
 * El título partido en palabras, para que la imagen lo corte entre palabras y
 * nunca deje el emoji del final solo en un renglón: va pegado a la última
 * palabra, con un espacio común. (Con un espacio que no corta, el generador
 * de la imagen dejaba de reconocer el emoji y dibujaba un cuadradito.)
 */
export function palabrasDelTitular(texto: string): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const ultima = palabras.at(-1);
  if (
    palabras.length >= 2 &&
    ultima &&
    /^(?:\p{Extended_Pictographic}|️|‍)+$/u.test(ultima)
  ) {
    palabras.splice(-2, 2, `${palabras.at(-2)} ${ultima}`);
  }
  return palabras;
}
