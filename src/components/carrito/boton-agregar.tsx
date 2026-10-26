"use client";

import { IconoCarrito, IconoMas, IconoMenos } from "@/components/ui/iconos";
import { useCarrito } from "@/components/carrito/estado-carrito";

/**
 * Agrega un producto al carrito de su stand.
 *
 * Una vez agregado se convierte en el control de cantidad, en el mismo lugar:
 * así la persona ve enseguida que la acción hizo algo, sin un cartel que
 * aparezca y desaparezca. Bajar de 1 saca el producto del carrito.
 */
export function BotonAgregar({
  stand,
  producto,
}: {
  stand: { slug: string; emprendimiento: string };
  producto: {
    id: string;
    nombre: string;
    precio: number;
    imagen: string | null;
  };
}) {
  const { carritos, listo, agregar, cambiarCantidad } = useCarrito();

  const enCarrito = carritos[stand.slug]?.items.find(
    (item) => item.productoId === producto.id,
  );

  // Mientras no se leyó el almacenamiento mostramos el botón de agregar y no
  // un hueco: es lo que corresponde al caso más común (carrito vacío) y evita
  // que la tarjeta cambie de alto al terminar de cargar.
  if (!listo || !enCarrito) {
    return (
      <button
        type="button"
        onClick={() =>
          agregar(stand, {
            productoId: producto.id,
            nombre: producto.nombre,
            precioUnitario: producto.precio,
            imagen: producto.imagen,
          })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-municipal-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
      >
        <IconoCarrito className="size-4" />
        Agregar
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-municipal-200 bg-municipal-50 px-2 py-1.5">
      <button
        type="button"
        onClick={() =>
          cambiarCantidad(stand.slug, producto.id, enCarrito.cantidad - 1)
        }
        aria-label={
          enCarrito.cantidad === 1
            ? `Quitar ${producto.nombre} del carrito`
            : `Quitar una unidad de ${producto.nombre}`
        }
        className="inline-flex size-7 items-center justify-center rounded-md text-municipal-800 transition-colors hover:bg-municipal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
      >
        <IconoMenos className="size-4" />
      </button>

      <span className="text-sm font-medium text-municipal-900">
        <span aria-live="polite">{enCarrito.cantidad}</span>
        <span className="sr-only"> en el carrito</span>
      </span>

      <button
        type="button"
        onClick={() =>
          cambiarCantidad(stand.slug, producto.id, enCarrito.cantidad + 1)
        }
        aria-label={`Agregar otra unidad de ${producto.nombre}`}
        className="inline-flex size-7 items-center justify-center rounded-md text-municipal-800 transition-colors hover:bg-municipal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
      >
        <IconoMas className="size-4" />
      </button>
    </div>
  );
}
