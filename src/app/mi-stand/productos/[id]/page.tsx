import { hayIAConfigurada } from "@/lib/ai";
import Link from "next/link";
import { notFound } from "next/navigation";

import { actualizarProducto } from "@/actions/productos";
import { FormularioProducto } from "@/components/vendedor/formulario-producto";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { aNumero } from "@/lib/format";
import { hayPreciosPublicos } from "@/lib/marketplace";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Editar producto" };

/**
 * Hasta un minuto para esta ruta, por la mejora con IA.
 *
 * `maxDuration` es configuración de segmento de ruta, así que tiene que vivir
 * en la página y no en la acción: un archivo "use server" sólo puede exportar
 * funciones async. Y va acá y no en el layout porque Vercel la lee por ruta,
 * para dimensionar la función que la sirve.
 *
 * El número sale de lo medido: la llamada al modelo mide unos 11 segundos, más
 * el procesamiento con sharp y tres subidas a Storage. El límite por defecto de
 * una función de Vercel es de 10 segundos en el plan Hobby, así que sin esto la
 * foto con IA funciona en localhost y falla en el sitio publicado, que es la
 * peor forma de que falle.
 *
 * 60 es el techo del plan Hobby y entra cómodo en los de arriba, así que sirve
 * sin tener que saber en cuál está la Municipalidad. Si alguna vez se migra a
 * uno con más margen, se puede subir; bajarlo no.
 */
export const maxDuration = 60;

export default async function PaginaEditarProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { vendedor } = await requerirVendedorAprobado();
  const { id } = await params;

  // El filtro por `vendedorId` evita que un feriante abra el producto de otro.
  const producto = await prisma.producto.findFirst({
    where: { id, vendedorId: vendedor.id },
  });

  if (!producto) notFound();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/mi-stand/productos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver al catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Editar producto
        </h1>
      </header>

      <FormularioProducto
        hayIA={hayIAConfigurada()}
        conPrecios={hayPreciosPublicos()}
        accion={actualizarProducto}
        producto={{
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          imagenes: producto.imagenes,
          disponible: producto.disponible,
          destacado: producto.destacado,
          precio: producto.precio === null ? null : aNumero(producto.precio),
          stock: producto.stock,
        }}
      />
    </div>
  );
}
