import Link from "next/link";
import { notFound } from "next/navigation";

import { FormularioCostos } from "@/components/vendedor/formulario-costos";
import { datosDeCostosSchema } from "@/lib/costos";
import { prisma } from "@/lib/db";
import { obtenerVendedorActual } from "@/lib/session";

export const metadata = { title: "Ficha de costos" };

export default async function PaginaEditarFicha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { vendedor } = await obtenerVendedorActual();
  const { id } = await params;

  // Por id y por stand: una ficha ajena es una que no existe.
  const [ficha, productos] = await Promise.all([
    prisma.fichaDeCostos.findFirst({
      where: { id, vendedorId: vendedor.id },
      select: { id: true, nombre: true, productoId: true, datos: true },
    }),
    prisma.producto.findMany({
      where: { vendedorId: vendedor.id, borrador: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);
  if (!ficha) notFound();

  const datos = datosDeCostosSchema.safeParse(ficha.datos);

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
          {ficha.nombre}
        </h1>
        <p className="mt-1 text-slate-600">
          Cambiá lo que haya cambiado: la cuenta se rehace sola.
        </p>
      </header>

      <FormularioCostos
        ficha={{
          id: ficha.id,
          nombre: ficha.nombre,
          productoId: ficha.productoId,
          datos: datos.success ? datos.data : null,
        }}
        productos={productos}
      />
    </>
  );
}
