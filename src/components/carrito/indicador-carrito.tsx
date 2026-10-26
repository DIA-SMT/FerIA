"use client";

import Link from "next/link";

import {
  unidadesTotales,
  useCarrito,
} from "@/components/carrito/estado-carrito";
import { IconoCarrito } from "@/components/ui/iconos";

/**
 * El carrito en el encabezado.
 *
 * Mientras esté vacío no aparece: un carrito siempre visible en un sitio donde
 * la mayoría de las visitas vienen a mirar fechas de ferias es ruido.
 */
export function IndicadorCarrito() {
  const { carritos, listo } = useCarrito();

  if (!listo) return null;

  const unidades = unidadesTotales(carritos);
  if (unidades === 0) return null;

  const stands = Object.keys(carritos).length;

  return (
    <Link
      href="/carrito"
      className="relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-municipal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
    >
      <IconoCarrito className="size-5" />
      <span className="sr-only">
        Mi pedido: {unidades} {unidades === 1 ? "unidad" : "unidades"}
        {stands > 1 ? ` en ${stands} stands` : ""}
      </span>
      <span
        aria-hidden="true"
        className="inline-flex min-w-5 items-center justify-center rounded-full bg-municipal-500 px-1.5 text-xs font-semibold text-white"
      >
        {unidades}
      </span>
    </Link>
  );
}
