import Link from "next/link";

import { FormularioCostos } from "@/components/vendedor/formulario-costos";
import { prisma } from "@/lib/db";
import { obtenerVendedorActual } from "@/lib/session";

export const metadata = { title: "Nueva ficha de costos" };

export default async function PaginaNuevaFicha({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  const { vendedor } = await obtenerVendedorActual();
  const { producto: productoElegido } = await searchParams;

  const productos = await prisma.producto.findMany({
    where: { vendedorId: vendedor.id, borrador: false },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
  // Desde un producto del catálogo, la ficha arranca con ese producto.
  const desde = productos.find((producto) => producto.id === productoElegido);

  return (
    <>
      <header className="mb-6">
        <Link
          href="/mi-stand/costos"
          className="text-sm font-medium text-municipal-600 hover:text-municipal-700"
        >
          ← Precios y costos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Nueva ficha de costos
        </h1>
        <p className="mt-1 text-slate-600">
          Cuánto te cuesta hacerlo y a cuánto te conviene venderlo.
        </p>
      </header>

      <FormularioCostos
        ficha={{
          nombre: desde?.nombre ?? "",
          productoId: desde?.id ?? null,
          datos: null,
        }}
        productos={productos}
      />
    </>
  );
}
