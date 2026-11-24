import Link from "next/link";
import { notFound } from "next/navigation";

import {
  actualizarPropuestaSelloPropio,
  buscarFeriantesElegibles,
  eliminarPropuestaSelloPropio,
} from "@/actions/sello-propio";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioPropuesta } from "@/components/admin/formulario-propuesta";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { IconoTacho } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { titularDe } from "@/lib/titular";

export const metadata = { title: "Editar propuesta" };

export default async function PaginaEditarPropuesta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const propuesta = await prisma.propuestaSelloPropio.findUnique({
    where: { id },
    include: {
      cambios: {
        where: { estado: "PENDIENTE" },
        take: 1,
        select: { id: true },
      },
      vendedor: {
        select: {
          id: true,
          emprendimiento: true,
          nombreResponsable: true,
          email: true,
          usuario: { select: { nombre: true, email: true } },
          postulaciones: {
            where: { estado: "ACEPTADA" },
            select: { feria: { select: { nombre: true } } },
          },
        },
      },
    },
  });

  if (!propuesta) notFound();
  const { vendedor, cambios, ...valores } = propuesta;

  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Editar propuesta"
        descripcion={propuesta.titulo}
        migas={[
          { href: "/admin/modo-feria", texto: "Modo Feria" },
          { texto: propuesta.titulo },
        ]}
        acciones={
          <BotonConfirmar
            accion={eliminarPropuestaSelloPropio}
            campos={{ propuestaId: propuesta.id }}
            confirmacion={`¿Eliminar «${propuesta.titulo}»? Deja de verse en el sitio y no se puede deshacer.`}
            variante="contorno"
          >
            <IconoTacho className="size-4" />
            Eliminar
          </BotonConfirmar>
        }
      />
      {cambios.length > 0 && (
        <p className="mb-5 rounded-lg bg-acento-50 px-4 py-3 text-sm text-acento-900 ring-1 ring-acento-300">
          El feriante mandó esta propuesta a revisión.{" "}
          <Link
            href="/admin/revisiones"
            className="font-semibold underline underline-offset-2"
          >
            Revisarla
          </Link>{" "}
          es aprobar o rechazar lo que propuso; lo que guardes acá se aplica
          directo.
        </p>
      )}
      <FormularioPropuesta
        accion={actualizarPropuestaSelloPropio}
        buscarFeriantes={buscarFeriantesElegibles}
        volver="/admin/modo-feria"
        propuesta={{
          ...valores,
          feriante: {
            id: vendedor.id,
            emprendimiento: vendedor.emprendimiento,
            responsable: titularDe(vendedor).nombre,
            ferias: vendedor.postulaciones.map(
              (postulacion) => postulacion.feria.nombre,
            ),
          },
        }}
      />
    </div>
  );
}
