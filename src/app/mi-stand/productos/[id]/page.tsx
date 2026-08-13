import Link from "next/link";
import { notFound } from "next/navigation";

import { actualizarProducto } from "@/actions/productos";
import { FormularioProducto } from "@/components/vendedor/formulario-producto";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { aNumero } from "@/lib/format";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Editar producto" };

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
        accion={actualizarProducto}
        producto={{
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: aNumero(producto.precio),
          imagenes: producto.imagenes,
          disponible: producto.disponible,
          destacado: producto.destacado,
        }}
      />
    </div>
  );
}
