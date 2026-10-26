"use client";

import { useEffect } from "react";

import { useCarrito } from "@/components/carrito/estado-carrito";

/**
 * Vacía el carrito del stand una vez que el pedido salió.
 *
 * Se hace acá y no al enviar el formulario porque el envío termina en un
 * `redirect` del servidor: si se vaciara antes, un error de validación dejaría
 * a la persona de vuelta en el formulario y sin carrito.
 *
 * `reciente` lo decide el servidor comparando contra la fecha del pedido. Sin
 * eso, abrir el enlace de un pedido viejo —queda en el historial y en el chat
 * de WhatsApp— borraría un carrito nuevo del mismo stand.
 */
export function LimpiarCarrito({
  slug,
  reciente,
}: {
  slug: string;
  reciente: boolean;
}) {
  const { vaciar } = useCarrito();

  useEffect(() => {
    if (reciente) vaciar(slug);
  }, [reciente, slug, vaciar]);

  return null;
}
