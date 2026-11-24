import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { GrillaPropuestas } from "@/components/admin/grilla-propuestas";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoEnlaceExterno,
  IconoMas,
  IconoRegalo,
} from "@/components/ui/iconos";
import { prisma } from "@/lib/db";

export const metadata = { title: "Modo Feria" };

/**
 * Todas las propuestas de Modo Feria, las que cargaron los feriantes y las que
 * cargó el equipo. Las de los feriantes se aprueban en «Revisiones», con el
 * resto de lo que cambian en su stand; acá se ven todas juntas, con su estado,
 * y se pueden editar, publicar o eliminar.
 */
export default async function PaginaAdminModoFeria() {
  const propuestas = await prisma.propuestaSelloPropio.findMany({
    orderBy: { creadoEn: "desc" },
    select: {
      id: true,
      modalidad: true,
      titulo: true,
      imagen: true,
      precio: true,
      precioUnidad: true,
      publicada: true,
      vendedor: { select: { emprendimiento: true } },
      cambios: {
        where: { estado: { in: ["PENDIENTE", "RECHAZADO"] } },
        orderBy: { actualizadoEn: "desc" },
        take: 1,
        select: { id: true, estado: true, motivoRechazo: true },
      },
    },
  });

  const hayPublicadas = propuestas.some((propuesta) => propuesta.publicada);
  const paraRevisar = propuestas.filter(
    (propuesta) => propuesta.cambios[0]?.estado === "PENDIENTE",
  ).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Modo Feria"
        descripcion="Regalos y servicios con sello propio que los feriantes ofrecen a empresas e instituciones. Los cargan desde Mi stand y se aprueban en Revisiones; para quien no tiene cuenta, los podés cargar acá."
        acciones={
          <>
            {hayPublicadas && (
              <BotonLink href="/modo-feria/regalos" variante="contorno" externo>
                Ver en el sitio
                <IconoEnlaceExterno className="size-4" />
              </BotonLink>
            )}
            <BotonLink href="/admin/modo-feria/nueva">
              <IconoMas className="size-4" />
              Nueva propuesta
            </BotonLink>
          </>
        }
      />

      {paraRevisar > 0 && (
        <p className="mb-6 rounded-lg bg-acento-50 px-4 py-3 text-sm text-acento-900 ring-1 ring-acento-300">
          {paraRevisar === 1
            ? "Hay 1 propuesta esperando revisión."
            : `Hay ${paraRevisar} propuestas esperando revisión.`}{" "}
          <Link
            href="/admin/revisiones"
            className="font-semibold underline underline-offset-2"
          >
            Revisar
          </Link>
        </p>
      )}

      {propuestas.length === 0 ? (
        <EstadoVacio
          icono={IconoRegalo}
          titulo="Todavía no hay propuestas"
          descripcion="Los feriantes las cargan desde Mi stand, en «Modo Feria», y te llegan a Revisiones. También podés cargar una acá."
          accion={
            <BotonLink href="/admin/modo-feria/nueva">Cargar una</BotonLink>
          }
        />
      ) : (
        <GrillaPropuestas
          editarEn="/admin/modo-feria"
          propuestas={propuestas.map(({ vendedor, cambios, ...propuesta }) => {
            const cambio = cambios[0];
            return {
              ...propuesta,
              emprendimiento: vendedor.emprendimiento,
              revision: cambio
                ? {
                    id: cambio.id,
                    estado:
                      cambio.estado === "RECHAZADO" ? "RECHAZADO" : "PENDIENTE",
                    motivo: cambio.motivoRechazo,
                  }
                : null,
            };
          })}
        />
      )}
    </>
  );
}
