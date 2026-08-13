import Link from "next/link";

import { crearProducto } from "@/actions/productos";
import { FormularioProducto } from "@/components/vendedor/formulario-producto";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Nuevo producto" };

export default async function PaginaNuevoProducto() {
  await requerirVendedorAprobado();

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
          Agregar producto
        </h1>
      </header>

      <FormularioProducto accion={crearProducto} />
    </div>
  );
}
