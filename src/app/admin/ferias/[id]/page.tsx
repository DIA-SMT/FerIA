import Link from "next/link";
import { notFound } from "next/navigation";

import { eliminarFeria } from "@/actions/ferias";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { BarraOcupacion } from "@/components/admin/graficos";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCalendario,
  IconoEnlaceExterno,
  IconoLapiz,
  IconoMas,
  IconoTacho,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { prisma } from "@/lib/db";
import { formatearMoneda, formatearRangoFechas } from "@/lib/format";
import { linkGoogleMaps, linkGoogleMapsPorDireccion } from "@/lib/geo";
import {
  CATEGORIAS_FERIA,
  ESTADOS_EDICION,
  TONO_ESTADO_EDICION,
} from "@/lib/labels";

export const metadata = { title: "Detalle de feria" };

export default async function PaginaDetalleFeria({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const feria = await prisma.feria.findUnique({
    where: { id },
    include: {
      ediciones: {
        orderBy: { fechaInicio: "desc" },
        include: {
          _count: { select: { stands: true } },
          stands: { where: { vendedorId: { not: null } }, select: { id: true } },
        },
      },
    },
  });

  if (!feria) notFound();

  const mapa =
    linkGoogleMaps(feria.latitud, feria.longitud) ??
    linkGoogleMapsPorDireccion(feria.direccion);

  return (
    <>
      <EncabezadoPagina
        titulo={feria.nombre}
        descripcion={feria.direccion}
        migas={[
          { href: "/admin/ferias", texto: "Ferias" },
          { texto: feria.nombre },
        ]}
        acciones={
          <>
            <BotonLink
              href={`/ferias/${feria.slug}`}
              externo
              variante="contorno"
              tamanio="sm"
            >
              Ver pública
              <IconoEnlaceExterno className="size-4" />
            </BotonLink>
            <BotonLink
              href={`/admin/ferias/${feria.id}/editar`}
              variante="secundario"
              tamanio="sm"
            >
              <IconoLapiz className="size-4" />
              Editar
            </BotonLink>
            <BotonLink href={`/admin/ferias/${feria.id}/ediciones/nueva`} tamanio="sm">
              <IconoMas className="size-4" />
              Nueva edición
            </BotonLink>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ----------------------------- Ediciones ---------------------------- */}
        <div className="lg:col-span-2">
          <Tarjeta>
            <TarjetaEncabezado
              titulo="Ediciones"
              descripcion={`${feria.ediciones.length} ${
                feria.ediciones.length === 1 ? "edición" : "ediciones"
              } cargadas`}
            />
            <TarjetaCuerpo>
              {feria.ediciones.length === 0 ? (
                <EstadoVacio
                  icono={IconoCalendario}
                  titulo="Sin ediciones"
                  descripcion="Creá una edición con sus fechas para poder asignar stands."
                  accion={
                    <BotonLink
                      href={`/admin/ferias/${feria.id}/ediciones/nueva`}
                      tamanio="sm"
                    >
                      Crear edición
                    </BotonLink>
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {feria.ediciones.map((edicion) => (
                    <li
                      key={edicion.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/ediciones/${edicion.id}`}
                            className="font-medium text-slate-900 transition-colors hover:text-municipal-700"
                          >
                            {edicion.nombre ?? "Edición sin nombre"}
                          </Link>
                          <Badge
                            tono={TONO_ESTADO_EDICION[edicion.estado]}
                            tamanio="sm"
                            conPunto={edicion.estado === "EN_CURSO"}
                          >
                            {ESTADOS_EDICION[edicion.estado]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {formatearRangoFechas(
                            edicion.fechaInicio,
                            edicion.fechaFin,
                          )}{" "}
                          · {edicion.horario}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Canon: {formatearMoneda(edicion.montoCanon)}
                        </p>
                      </div>

                      <BarraOcupacion
                        ocupados={edicion.stands.length}
                        total={edicion._count.stands}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaCuerpo>
          </Tarjeta>
        </div>

        {/* --------------------------- Datos generales ------------------------ */}
        <div className="space-y-5">
          <Tarjeta className="overflow-hidden">
            <ImagenPortada
              src={feria.imagen}
              alt={feria.nombre}
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="aspect-[16/9] w-full"
            />
            <TarjetaCuerpo className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tono="celeste">
                  {CATEGORIAS_FERIA[feria.categoria]}
                </Badge>
                <Badge tono={feria.activa ? "verde" : "neutro"}>
                  {feria.activa ? "Activa" : "Inactiva"}
                </Badge>
              </div>

              <p className="text-sm whitespace-pre-line text-slate-600">
                {feria.descripcion}
              </p>

              <dl className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                <div>
                  <dt className="text-slate-500">Dirección</dt>
                  <dd className="text-slate-800">{feria.direccion}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Coordenadas</dt>
                  <dd className="text-slate-800">
                    {feria.latitud !== null && feria.longitud !== null ? (
                      <a
                        href={mapa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-municipal-600 hover:text-municipal-700"
                      >
                        {feria.latitud}, {feria.longitud}
                        <IconoEnlaceExterno className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Sin cargar</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">URL pública</dt>
                  <dd className="font-mono text-xs break-all text-slate-800">
                    /ferias/{feria.slug}
                  </dd>
                </div>
              </dl>
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta className="border-red-200">
            <TarjetaEncabezado
              titulo="Eliminar feria"
              descripcion="Se borran también sus ediciones, stands y pagos de canon."
              className="border-red-100"
            />
            <TarjetaCuerpo>
              <BotonConfirmar
                accion={eliminarFeria}
                campos={{ feriaId: feria.id }}
                confirmacion={`¿Eliminar "${feria.nombre}"? Se van a borrar sus ${feria.ediciones.length} ediciones, todos sus stands y los pagos de canon asociados. Esta acción no se puede deshacer.`}
                tamanio="md"
              >
                <IconoTacho className="size-4" />
                Eliminar feria
              </BotonConfirmar>
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
