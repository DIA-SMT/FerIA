import { notFound } from "next/navigation";

import { actualizarFeria } from "@/actions/ferias";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioFeria } from "@/components/admin/formulario-feria";
import { prisma } from "@/lib/db";

export const metadata = { title: "Editar feria" };

export default async function PaginaEditarFeria({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const feria = await prisma.feria.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      categoria: true,
      direccion: true,
      latitud: true,
      longitud: true,
      imagen: true,
      activa: true,
    },
  });

  if (!feria) notFound();

  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Editar feria"
        descripcion={feria.nombre}
        migas={[
          { href: "/admin/ferias", texto: "Ferias" },
          { href: `/admin/ferias/${feria.id}`, texto: feria.nombre },
          { texto: "Editar" },
        ]}
      />
      <FormularioFeria accion={actualizarFeria} feria={feria} />
    </div>
  );
}
