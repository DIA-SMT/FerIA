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

/**
 * Carrito y pedidos.
 *
 * Son dos permisos y no uno porque son dos decisiones distintas y pueden
 * tomarse por separado: publicar precios es informar, tomar pedidos es
 * intervenir en la operación. Legales puede habilitar lo primero y no lo
 * segundo, y en ese caso la vidriera muestra precios y sigue derivando la
 * consulta por WhatsApp, como hoy.
 *
 * Depende de `hayPreciosPublicos` porque no hay forma de pedir algo sin saber
 * cuánto sale: sin precios el carrito no podría sumar.
 *
 * Lo que el pedido **no** es: el municipio no cobra, no retiene, no garantiza
 * y no es parte. La plataforma arma el pedido y lo pone en manos del feriante,
 * que cobra por donde quiera. Por eso no hay medio de pago en ningún lado, y
 * si alguna vez lo hay, esta función no alcanza: cambia el modelo.
 */
export function hayPedidos(): boolean {
  return hayPreciosPublicos() && process.env.PERMITIR_PEDIDOS === "true";
}
