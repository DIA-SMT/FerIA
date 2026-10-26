"use client";

import Link from "next/link";

import { useCarrito } from "@/components/carrito/estado-carrito";
import { estilosBoton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCarrito,
  IconoMas,
  IconoMenos,
  IconoTacho,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { IconoEtiqueta } from "@/components/ui/iconos";
import { formatearMoneda } from "@/lib/format";
import { subtotalLinea, totalPedido } from "@/lib/pedidos";

/**
 * Lo que hay en el carrito, agrupado por stand.
 *
 * Cada grupo se confirma por separado porque cada uno es un pedido a una
 * persona distinta, que cobra y entrega por su cuenta. Un botón único de
 * «comprar todo» prometería algo que el municipio no hace.
 */
export function ListaCarritos() {
  const { carritos, listo, cambiarCantidad, quitar, vaciar } = useCarrito();

  if (!listo) {
    return (
      <p className="mt-8 text-sm text-slate-500" role="status">
        Cargando tu pedido…
      </p>
    );
  }

  const grupos = Object.values(carritos);

  if (grupos.length === 0) {
    return (
      <EstadoVacio
        icono={IconoCarrito}
        className="mt-8"
        titulo="Todavía no agregaste nada"
        descripcion="Entrá al directorio de stands, mirá los catálogos y agregá lo que quieras pedirle a cada feriante."
        accion={
          <Link href="/stands" className={estilosBoton("primario", "md")}>
            Ver stands
          </Link>
        }
      />
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {grupos.map((carrito) => (
        <section
          key={carrito.slug}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          aria-labelledby={`stand-${carrito.slug}`}
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2
              id={`stand-${carrito.slug}`}
              className="font-semibold text-slate-900"
            >
              <Link
                href={`/stands/${carrito.slug}`}
                className="transition-colors hover:text-municipal-700"
              >
                {carrito.emprendimiento}
              </Link>
            </h2>
            <button
              type="button"
              onClick={() => vaciar(carrito.slug)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              <IconoTacho className="size-3.5" />
              Vaciar
            </button>
          </header>

          <ul className="divide-y divide-slate-100">
            {carrito.items.map((item) => (
              <li
                key={item.productoId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <ImagenPortada
                  src={item.imagen}
                  alt=""
                  icono={IconoEtiqueta}
                  sizes="56px"
                  ajuste="contain"
                  className="size-14 shrink-0 rounded-lg"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {item.nombre}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatearMoneda(item.precioUnitario)} c/u
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      cambiarCantidad(
                        carrito.slug,
                        item.productoId,
                        item.cantidad - 1,
                      )
                    }
                    aria-label={`Quitar una unidad de ${item.nombre}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
                  >
                    <IconoMenos className="size-4" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-medium text-slate-900">
                    {item.cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      cambiarCantidad(
                        carrito.slug,
                        item.productoId,
                        item.cantidad + 1,
                      )
                    }
                    aria-label={`Agregar una unidad de ${item.nombre}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
                  >
                    <IconoMas className="size-4" />
                  </button>
                </div>

                <p className="w-24 shrink-0 text-right font-semibold text-slate-900">
                  {formatearMoneda(subtotalLinea(item))}
                </p>

                <button
                  type="button"
                  onClick={() => quitar(carrito.slug, item.productoId)}
                  aria-label={`Sacar ${item.nombre} del pedido`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                >
                  <IconoTacho className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              Total del pedido a {carrito.emprendimiento}:{" "}
              <span className="text-base font-bold text-slate-900">
                {formatearMoneda(totalPedido(carrito.items))}
              </span>
            </p>
            <Link
              href={`/carrito/${carrito.slug}`}
              className={estilosBoton("primario", "md")}
            >
              Hacer este pedido
            </Link>
          </footer>
        </section>
      ))}
    </div>
  );
}
