import { notFound } from "next/navigation";

import { crearEdicion } from "@/actions/ediciones";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioEdicion } from "@/components/admin/formulario-edicion";
import { prisma } from "@/lib/db";

export const metadata = { title: "Nueva edición" };

export default async function PaginaNuevaEdicion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const feria = await prisma.feria.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  });

  if (!feria) notFound();

  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva edición"
        descripcion={feria.nombre}
        migas={[
          { href: "/admin/ferias", texto: "Ferias" },
          { href: `/admin/ferias/${feria.id}`, texto: feria.nombre },
          { texto: "Nueva edición" },
        ]}
      />
      <FormularioEdicion accion={crearEdicion} feriaId={feria.id} />
    </div>
  );
}
