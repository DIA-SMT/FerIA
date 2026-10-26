import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FormularioPedido,
  type EdicionDeRetiro,
} from "@/components/carrito/formulario-pedido";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { EDICIONES_PUBLICAS } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearRangoFechas } from "@/lib/format";
import { hayPedidos } from "@/lib/marketplace";

export const metadata: Metadata = {
  title: "Confirmar pedido",
  robots: { index: false, follow: false },
};

export default async function PaginaConfirmarPedido({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!hayPedidos()) notFound();

  const { slug } = await params;

  // Igual que en la ficha de stand: el 404 se decide antes del primer byte, y
  // por eso esta ruta no puede tener un `loading.tsx` por encima. Ver el
  // comentario largo en src/components/public/esqueleto-grilla.tsx.
  const vendedor = await prisma.vendedor.findFirst({
    where: { slug, estado: "APROBADO" },
    select: {
      slug: true,
      emprendimiento: true,
      stands: {
        where: { edicion: EDICIONES_PUBLICAS },
        orderBy: { edicion: { fechaInicio: "asc" } },
        select: {
          edicion: {
            select: {
              id: true,
              nombre: true,
              fechaInicio: true,
              fechaFin: true,
              feria: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  if (!vendedor) notFound();

  // Dónde se puede retirar: sólo las ediciones públicas en las que este
  // feriante tiene stand asignado. Si no participa de ninguna, la única opción
  // que queda es arreglar la entrega con él.
  const ediciones: EdicionDeRetiro[] = vendedor.stands.map(({ edicion }) => ({
    id: edicion.id,
    etiqueta: `${edicion.feria.nombre}${
      edicion.nombre ? ` — ${edicion.nombre}` : ""
    } · ${formatearRangoFechas(edicion.fechaInicio, edicion.fechaFin)}`,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/carrito"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
      >
        <IconoFlechaIzquierda className="size-4" />
        Volver al pedido
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Confirmar pedido
        </h1>
        <p className="mt-2 text-slate-600">
          Le estás pidiendo a{" "}
          <Link
            href={`/stands/${vendedor.slug}`}
            className="font-medium text-municipal-600 transition-colors hover:text-municipal-700"
          >
            {vendedor.emprendimiento}
          </Link>
          .
        </p>
      </header>

      <FormularioPedido
        stand={{ slug: vendedor.slug, emprendimiento: vendedor.emprendimiento }}
        ediciones={ediciones}
      />
    </div>
  );
}
