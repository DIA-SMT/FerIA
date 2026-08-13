import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { BarraOcupacion } from "@/components/admin/graficos";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoMas, IconoTienda } from "@/components/ui/iconos";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaFila,
  Td,
  Th,
} from "@/components/ui/tabla";
import { prisma } from "@/lib/db";
import { formatearRangoFechas, hoyUTC } from "@/lib/format";
import {
  CATEGORIAS_FERIA,
  ESTADOS_EDICION,
  TONO_ESTADO_EDICION,
} from "@/lib/labels";

export const metadata = { title: "Ferias y ediciones" };

export default async function PaginaAdminFerias() {
  const hoy = hoyUTC();

  const ferias = await prisma.feria.findMany({
    orderBy: { nombre: "asc" },
    include: {
      ediciones: {
        orderBy: { fechaInicio: "desc" },
        select: {
          id: true,
          nombre: true,
          fechaInicio: true,
          fechaFin: true,
          estado: true,
          _count: {
            select: {
              stands: true,
            },
          },
          stands: { where: { vendedorId: { not: null } }, select: { id: true } },
        },
      },
    },
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Ferias y ediciones"
        descripcion="Alta, edición y baja de las ferias municipales y sus ediciones."
        acciones={
          <BotonLink href="/admin/ferias/nueva">
            <IconoMas className="size-4" />
            Nueva feria
          </BotonLink>
        }
      />

      {ferias.length === 0 ? (
        <EstadoVacio
          icono={IconoTienda}
          titulo="Todavía no hay ferias cargadas"
          descripcion="Creá la primera feria para después definir sus ediciones y stands."
          accion={<BotonLink href="/admin/ferias/nueva">Crear feria</BotonLink>}
        />
      ) : (
        <div className="space-y-4">
          {ferias.map((feria) => {
            const vigentes = feria.ediciones.filter(
              (edicion) => edicion.fechaFin >= hoy,
            );

            return (
              <Tarjeta key={feria.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/ferias/${feria.id}`}
                        className="text-base font-semibold text-slate-900 transition-colors hover:text-municipal-700"
                      >
                        {feria.nombre}
                      </Link>
                      <Badge tono="celeste" tamanio="sm">
                        {CATEGORIAS_FERIA[feria.categoria]}
                      </Badge>
                      {!feria.activa && (
                        <Badge tono="neutro" tamanio="sm">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {feria.direccion}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <BotonLink
                      href={`/admin/ferias/${feria.id}/ediciones/nueva`}
                      variante="contorno"
                      tamanio="sm"
                    >
                      <IconoMas className="size-4" />
                      Edición
                    </BotonLink>
                    <BotonLink
                      href={`/admin/ferias/${feria.id}`}
                      variante="secundario"
                      tamanio="sm"
                    >
                      Gestionar
                    </BotonLink>
                  </div>
                </div>

                {feria.ediciones.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500 sm:px-5">
                    Esta feria todavía no tiene ediciones.{" "}
                    <Link
                      href={`/admin/ferias/${feria.id}/ediciones/nueva`}
                      className="font-medium text-municipal-600 hover:text-municipal-700"
                    >
                      Crear la primera
                    </Link>
                  </p>
                ) : (
                  <Tabla>
                    <TablaCabecera>
                      <tr>
                        <Th>Edición</Th>
                        <Th>Fechas</Th>
                        <Th>Estado</Th>
                        <Th>Ocupación</Th>
                        <Th className="text-right">Acciones</Th>
                      </tr>
                    </TablaCabecera>
                    <TablaCuerpo>
                      {feria.ediciones.map((edicion) => (
                        <TablaFila key={edicion.id}>
                          <Td className="font-medium text-slate-900">
                            {edicion.nombre ?? "Sin nombre"}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {formatearRangoFechas(
                              edicion.fechaInicio,
                              edicion.fechaFin,
                            )}
                          </Td>
                          <Td>
                            <Badge
                              tono={TONO_ESTADO_EDICION[edicion.estado]}
                              tamanio="sm"
                              conPunto={edicion.estado === "EN_CURSO"}
                            >
                              {ESTADOS_EDICION[edicion.estado]}
                            </Badge>
                          </Td>
                          <Td>
                            <BarraOcupacion
                              ocupados={edicion.stands.length}
                              total={edicion._count.stands}
                            />
                          </Td>
                          <Td className="text-right">
                            <Link
                              href={`/admin/ediciones/${edicion.id}`}
                              className="text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                            >
                              Ver stands
                            </Link>
                          </Td>
                        </TablaFila>
                      ))}
                    </TablaCuerpo>
                  </Tabla>
                )}

                {vigentes.length === 0 && feria.ediciones.length > 0 && (
                  <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
                    Sin ediciones vigentes: esta feria no aparece entre las
                    próximas del market.
                  </p>
                )}
              </Tarjeta>
            );
          })}
        </div>
      )}
    </>
  );
}
