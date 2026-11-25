/**
 * Lo que comparten la acción que genera la imagen publicitaria, su ruta y la
 * pantalla de «Compartir». Aparte porque la acción es `"use server"` —sólo
 * puede exportar funciones— y `ia-publicidad.ts` usa sharp y el cliente de IA,
 * que no pueden ir al navegador.
 */

export type FormatoPublicidad = "publicacion" | "historia";

/** Con más de tres productos la escena se amontona y la IA los cambia más. */
export const MAXIMO_PRODUCTOS_PUBLICIDAD = 3;

/**
 * Tres imágenes cada tres días por feriante: cada escena es una llamada paga
 * al modelo de imagen (unos 4 centavos de dólar). La ventana corre: cada
 * imagen deja lugar para otra tres días después de generada.
 */
export const PUBLICIDADES_POR_PERIODO = 3;
export const DIAS_DEL_PERIODO = 3;

export const UN_PERIODO_MS = DIAS_DEL_PERIODO * 24 * 60 * 60 * 1000;

export interface CupoDePublicidad {
  /** Cuántas puede generar ahora. */
  restantes: number;
  /** Desde cuándo puede generar otra, si ahora no puede. */
  proxima: Date | null;
}

/** El cupo a partir de cuándo generó las del período. */
export function cupoDePublicidad(
  generadas: Date[],
  ahora: Date,
): CupoDePublicidad {
  const recientes = generadas
    .filter((fecha) => ahora.getTime() - fecha.getTime() < UN_PERIODO_MS)
    .sort((una, otra) => una.getTime() - otra.getTime());
  const restantes = Math.max(0, PUBLICIDADES_POR_PERIODO - recientes.length);
  // Si no le quedan, la próxima se libera cuando vence la más vieja de las
  // que cuentan.
  const vence = recientes[recientes.length - PUBLICIDADES_POR_PERIODO];
  return {
    restantes,
    proxima:
      restantes === 0 && vence
        ? new Date(vence.getTime() + UN_PERIODO_MS)
        : null,
  };
}

/** «el jueves 27 de noviembre a las 14:20», en la hora de Tucumán. */
export function cuandoPuedeOtra(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Tucuman",
  }).format(fecha);
  const hora = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Tucuman",
  }).format(fecha);
  return `el ${partes.replace(",", "")} a las ${hora}`;
}

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
