/**
 * Interruptor del marketplace.
 *
 * El precio del producto salió del sistema en `20260814000000_quitar_precio_
 * productos` por decisión de la Dirección de Ferias y Mercados: la plataforma
 * es vidriera, el municipio no interviene en la venta y los términos
 * publicados dicen textualmente «La plataforma no publica precios».
 *
 * El pedido de convertir esto en marketplace revierte esa decisión, y eso no
 * lo puede firmar el equipo de desarrollo: cambia la naturaleza jurídica de la
 * plataforma —de quien publica a quien intermedia— y arrastra los términos,
 * la Ley 24.240 y a quién le reclama el vecino cuando algo sale mal.
 *
 * Así que la columna existe y el código la soporta, pero mientras este flag
 * esté apagado la vidriera se comporta exactamente como hoy. Encenderlo es
 * una decisión de la Dirección y de Legales, no un deploy.
 *
 * Antes de prenderlo hay que actualizar `src/components/public/
 * terminos-contenido.tsx`, que hoy afirma lo contrario.
 */
export function hayPreciosPublicos(): boolean {
  return process.env.PERMITIR_PRECIOS === "true";
}
