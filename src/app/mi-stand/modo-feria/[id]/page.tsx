import Link from "next/link";
import { notFound } from "next/navigation";

import {
  actualizarPropuestaPropia,
  eliminarPropuestaPropia,
} from "@/actions/sello-propio";
import { FormularioPropuesta } from "@/components/admin/formulario-propuesta";
import { EstadoDeRevision } from "@/components/vendedor/estado-de-revision";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { IconoFlechaIzquierda, IconoTacho } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { cambiosAbiertos, propuestaDelDueno } from "@/lib/revision";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Editar propuesta de Modo Feria" };

export default async function PaginaEditarPropuestaPropia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { vendedor } = await requerirVendedorAprobado();
  const { id } = await params;

  const [propuesta, cambios] = await Promise.all([
    prisma.propuestaSelloPropio.findUnique({
      where: { id },
      select: {
        id: true,
        vendedorId: true,
        modalidad: true,
        titulo: true,
        descripcion: true,
        imagen: true,
        precio: true,
        precioUnidad: true,
        minimo: true,
        capacidad: true,
        anticipacion: true,
        publicada: true,
      },
    }),
    cambiosAbiertos(vendedor.id),
  ]);
  if (!propuesta || propuesta.vendedorId !== vendedor.id) notFound();

  // Lo que ve es lo último que guardó, aunque todavía no esté aprobado.
  const {
    propuesta: vista,
    revision,
    nueva,
  } = propuestaDelDueno(propuesta, cambios);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/mi-stand/modo-feria"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver a Modo Feria
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Editar propuesta
          </h1>
          <BotonConfirmar
            accion={eliminarPropuestaPropia}
            campos={{ propuestaId: propuesta.id }}
            confirmacion={`¿Eliminar «${vista.titulo}»? Deja de verse en Modo Feria y no se puede deshacer.`}
            variante="contorno"
          >
            <IconoTacho className="size-4" />
            Eliminar
          </BotonConfirmar>
        </div>
        {revision && (
          <EstadoDeRevision
            revision={revision}
            // Descartar el alta sería eliminarla: para eso está el botón.
            sinDescartar={nueva}
            className="mt-3"
          />
        )}
      </header>

      <FormularioPropuesta
        accion={actualizarPropuestaPropia}
        propuesta={vista}
        volver="/mi-stand/modo-feria"
      />
    </div>
  );
}
