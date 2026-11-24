import Image from "next/image";

import { GrillaPropuestas } from "@/components/admin/grilla-propuestas";
import { Alerta } from "@/components/ui/alerta";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoMas, IconoRegalo } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { cambiosAbiertos, propuestaDelDueno } from "@/lib/revision";
import { TIPOS_SELLO_PROPIO } from "@/lib/sello-propio";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Modo Feria" };

/**
 * Las propuestas del feriante para Modo Feria: regalos y servicios con sello
 * propio, para empresas e instituciones. Las ve como él las dejó —con lo que
 * está esperando revisión encima— y con el estado de cada una.
 */
export default async function PaginaModoFeriaDelFeriante({
  searchParams,
}: {
  searchParams: Promise<{ enviada?: string }>;
}) {
  const { vendedor } = await requerirVendedorAprobado();
  const { enviada } = await searchParams;

  const [propuestas, cambios] = await Promise.all([
    prisma.propuestaSelloPropio.findMany({
      where: { vendedorId: vendedor.id },
      orderBy: { creadoEn: "desc" },
      select: {
        id: true,
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

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden shrink-0 sm:flex" aria-hidden="true">
            {(["REGALO", "SERVICIO"] as const).map((tipo, indice) => (
              <Image
                key={tipo}
                src={TIPOS_SELLO_PROPIO[tipo].sello}
                alt=""
                width={64}
                height={64}
                className={
                  indice === 0 ? "size-16 -rotate-6" : "-ml-4 size-16 rotate-6"
                }
              />
            ))}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Modo Feria
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Regalos y servicios con sello propio para empresas e
              instituciones: un producto, una caja, un combo, tu food truck o un
              patio gastronómico. Cuando la Dirección de Relaciones
              Institucionales la aprueba, tu propuesta aparece en Modo Feria y
              en la portada, y te escriben directo por WhatsApp.
            </p>
          </div>
        </div>
        <BotonLink href="/mi-stand/modo-feria/nueva">
          <IconoMas className="size-4" />
          Nueva propuesta
        </BotonLink>
      </header>

      {enviada && (
        <Alerta tipo="exito" className="mt-6">
          Listo: la mandaste a revisión. La vas a ver publicada cuando la
          aprueben.
        </Alerta>
      )}

      <div className="mt-8">
        {propuestas.length === 0 ? (
          <EstadoVacio
            icono={IconoRegalo}
            titulo="Todavía no sumaste ninguna propuesta"
            descripcion="Contá qué ofrecés, con una foto, un precio orientativo y para cuántos podés preparar."
            accion={
              <BotonLink href="/mi-stand/modo-feria/nueva">
                Sumar la primera
              </BotonLink>
            }
          />
        ) : (
          <GrillaPropuestas
            editarEn="/mi-stand/modo-feria"
            propuestas={propuestas.map((propuesta) => {
              const { propuesta: vista, revision } = propuestaDelDueno(
                propuesta,
                cambios,
              );
              return { ...vista, revision };
            })}
          />
        )}
      </div>
    </div>
  );
}
