import { notFound } from "next/navigation";

import { actualizarEdicion } from "@/actions/ediciones";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioEdicion } from "@/components/admin/formulario-edicion";
import { prisma } from "@/lib/db";
import { aNumero, aValorInputFecha } from "@/lib/format";

export const metadata = { title: "Editar edición" };

export default async function PaginaEditarEdicion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const edicion = await prisma.edicionFeria.findUnique({
    where: { id },
    include: { feria: { select: { id: true, nombre: true } } },
  });

  if (!edicion) notFound();

  const titulo = edicion.nombre ?? "Edición sin nombre";

  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Editar edición"
        descripcion={`${edicion.feria.nombre} — ${titulo}`}
        migas={[
          { href: "/admin/ferias", texto: "Ferias" },
          {
            href: `/admin/ferias/${edicion.feria.id}`,
            texto: edicion.feria.nombre,
          },
          { href: `/admin/ediciones/${edicion.id}`, texto: titulo },
          { texto: "Editar" },
        ]}
      />

      <FormularioEdicion
        accion={actualizarEdicion}
        feriaId={edicion.feria.id}
        edicion={{
          id: edicion.id,
          nombre: edicion.nombre,
          fechaInicio: aValorInputFecha(edicion.fechaInicio),
          fechaFin: aValorInputFecha(edicion.fechaFin),
          horario: edicion.horario,
          estado: edicion.estado,
          cantidadStands: edicion.cantidadStands,
          montoCanon: aNumero(edicion.montoCanon),
          vencimientoCanon: aValorInputFecha(edicion.vencimientoCanon),
        }}
      />
    </div>
  );
}
