import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { IconoEnlaceExterno } from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { prisma } from "@/lib/db";
import {
  diasDeDiferencia,
  formatearFecha,
  formatearNumero,
  formatearRangoFechas,
  hoyEnZona,
} from "@/lib/format";
import {
  ESTADOS_EDICION,
  ESTADOS_POSTULACION,
  ESTADOS_VENDEDOR,
  RUBROS,
  TONO_ESTADO_POSTULACION,
  TONO_ESTADO_VENDEDOR,
} from "@/lib/labels";
import { tipoDelCambio } from "@/lib/revision";
import { requerirAdmin } from "@/lib/session";
import { TIPOS_DE_CAMBIO } from "@/lib/tipos-de-cambio";
import { titularDe } from "@/lib/titular";
import { formatearWhatsapp } from "@/lib/whatsapp";

export const metadata = { title: "Ficha del feriante" };

/**
 * La ficha de un feriante: todo lo suyo en una pantalla.
 *
 * Antes no existía: lo que la Dirección sabía de un feriante estaba repartido
 * entre la lista, las postulaciones, las revisiones y cada edición. Es además
 * adonde manda Migue cuando contesta sobre alguien en el panel, y la única
 * puerta a sus datos de contacto y su documento, que a Migue no le llegan.
 */
export default async function PaginaFichaFeriante({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();
  const { id } = await params;
  const hoy = hoyEnZona();
  const hace30 = new Date(hoy);
  hace30.setUTCDate(hace30.getUTCDate() - 30);

  const feriante = await prisma.vendedor.findUnique({
    where: { id },
    include: {
      usuario: { select: { nombre: true, email: true } },
      postulaciones: {
        orderBy: { creadoEn: "asc" },
        select: {
          id: true,
          estado: true,
          mensaje: true,
          motivoRechazo: true,
          creadoEn: true,
          revisadoEn: true,
          feria: { select: { id: true, nombre: true } },
        },
      },
      stands: {
        where: { edicion: { fechaFin: { gte: hoy } } },
        orderBy: { edicion: { fechaInicio: "asc" } },
        select: {
          id: true,
          numero: true,
          edicion: {
            select: {
              id: true,
              nombre: true,
              fechaInicio: true,
              fechaFin: true,
              estado: true,
              feria: { select: { nombre: true } },
            },
          },
        },
      },
      cambios: {
        where: { estado: "PENDIENTE" },
        orderBy: { creadoEn: "asc" },
        select: {
          id: true,
          seccion: true,
          datos: true,
          creadoEn: true,
          producto: { select: { nombre: true } },
        },
      },
      _count: { select: { productos: true } },
    },
  });

  if (!feriante) notFound();

  const [publicados, sinStock, interes] = await Promise.all([
    prisma.producto.count({ where: { vendedorId: id, publicado: true } }),
    prisma.producto.count({
      where: { vendedorId: id, publicado: true, disponible: false },
    }),
    prisma.interesStand.aggregate({
      where: { vendedorId: id, fecha: { gte: hace30 } },
      _sum: { aperturas: true, consultas: true },
    }),
  ]);

  const titular = titularDe(feriante);
  const padron = feriante.origen === "FERIA_DIGITAL";
  // El correo de la ficha sólo se muestra si dice algo distinto del de la
  // cuenta: si no, es el mismo dato dos veces.
  const correoDeLaFicha =
    feriante.email && feriante.email !== titular.email ? feriante.email : null;

  return (
    <>
      <EncabezadoPagina
        titulo={feriante.emprendimiento}
        descripcion={
          <span className="inline-flex flex-wrap items-center gap-2">
            {RUBROS[feriante.rubro]}
            <Badge tono={TONO_ESTADO_VENDEDOR[feriante.estado]} tamanio="sm">
              {ESTADOS_VENDEDOR[feriante.estado]}
            </Badge>
            {padron && !titular.reclamada && (
              <Badge tono="neutro" tamanio="sm">
                Padrón sin reclamar
              </Badge>
            )}
          </span>
        }
        migas={[
          { href: "/admin/feriantes", texto: "Feriantes" },
          { texto: feriante.emprendimiento },
        ]}
        acciones={
          feriante.estado === "APROBADO" ? (
            <BotonLink
              href={`/stands/${feriante.slug}`}
              externo
              variante="contorno"
              tamanio="sm"
            >
              Ver stand
              <IconoEnlaceExterno className="size-4" />
            </BotonLink>
          ) : (
            <BotonLink
              href="/admin/postulaciones"
              variante="contorno"
              tamanio="sm"
            >
              Ir a Postulaciones
            </BotonLink>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta>
            <TarjetaEncabezado
              titulo="Ferias presenciales"
              descripcion="Las que pidió y cómo quedó cada pedido."
            />
            <TarjetaCuerpo>
              {feriante.postulaciones.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {feriante.estado === "APROBADO"
                    ? "No pidió ninguna: tiene sólo el stand online."
                    : "No pidió ninguna todavía."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {feriante.postulaciones.map((postulacion) => (
                    <li
                      key={postulacion.id}
                      className="py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/admin/ferias/${postulacion.feria.id}`}
                          className="font-medium text-slate-900 hover:text-municipal-700"
                        >
                          {postulacion.feria.nombre}
                        </Link>
                        <Badge
                          tono={TONO_ESTADO_POSTULACION[postulacion.estado]}
                          tamanio="sm"
                        >
                          {ESTADOS_POSTULACION[postulacion.estado]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Pedida el {formatearFecha(postulacion.creadoEn)}
                        {postulacion.revisadoEn &&
                          ` · resuelta el ${formatearFecha(postulacion.revisadoEn)}`}
                      </p>
                      {postulacion.estado === "RECHAZADA" &&
                        postulacion.motivoRechazo && (
                          <p className="mt-1 text-sm text-slate-600">
                            Motivo: {postulacion.motivoRechazo}
                          </p>
                        )}
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaEncabezado
              titulo="Stands en las próximas ediciones"
              descripcion="Los que tiene asignados en ediciones que todavía no terminaron."
            />
            <TarjetaCuerpo>
              {feriante.stands.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No tiene stands asignados en las próximas ediciones.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {feriante.stands.map((stand) => (
                    <li
                      key={stand.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/admin/ediciones/${stand.edicion.id}`}
                          className="font-medium text-slate-900 hover:text-municipal-700"
                        >
                          {stand.edicion.feria.nombre}
                          {stand.edicion.nombre && ` · ${stand.edicion.nombre}`}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {formatearRangoFechas(
                            stand.edicion.fechaInicio,
                            stand.edicion.fechaFin,
                          )}{" "}
                          · {ESTADOS_EDICION[stand.edicion.estado]}
                        </p>
                      </div>
                      <Badge tono="azul" tamanio="sm">
                        Stand {stand.numero}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaCuerpo>
          </Tarjeta>

          {feriante.cambios.length > 0 && (
            <Tarjeta>
              <TarjetaEncabezado
                titulo="Esperando revisión"
                descripcion="Lo que cambió en su stand y todavía no se publicó."
                accion={
                  <BotonLink
                    href="/admin/revisiones"
                    variante="contorno"
                    tamanio="sm"
                  >
                    Ir a Revisiones
                  </BotonLink>
                }
              />
              <TarjetaCuerpo>
                <ul className="divide-y divide-slate-100 text-sm">
                  {feriante.cambios.map((cambio) => (
                    <li
                      key={cambio.id}
                      className="flex flex-wrap justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="text-slate-800">
                        {
                          TIPOS_DE_CAMBIO[
                            tipoDelCambio(cambio.seccion, cambio.datos)
                          ]
                        }
                        {cambio.producto && `: ${cambio.producto.nombre}`}
                      </span>
                      <span className="text-slate-500">
                        hace{" "}
                        {Math.max(0, diasDeDiferencia(cambio.creadoEn, hoy))}{" "}
                        días
                      </span>
                    </li>
                  ))}
                </ul>
              </TarjetaCuerpo>
            </Tarjeta>
          )}
        </div>

        <div className="space-y-5">
          <Tarjeta>
            <TarjetaCuerpo className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar
                  nombre={feriante.emprendimiento}
                  imagen={feriante.logo}
                  tamanio="md"
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{titular.nombre}</p>
                  {/* Sin cuenta ya lo dice la etiqueta «Padrón sin reclamar»
                      de arriba: acá sólo va el correo de la cuenta. */}
                  {titular.reclamada && (
                    <p className="truncate text-sm text-slate-500">
                      {titular.email}
                    </p>
                  )}
                </div>
              </div>

              <dl className="space-y-2.5 border-t border-slate-100 pt-3 text-sm">
                <Dato titulo="DNI">{feriante.dni}</Dato>
                <Dato titulo="WhatsApp">
                  {feriante.whatsapp && formatearWhatsapp(feriante.whatsapp)}
                </Dato>
                <Dato titulo="Teléfono">{feriante.telefono}</Dato>
                <Dato titulo="Correo de la ficha">{correoDeLaFicha}</Dato>
                <Dato titulo="Domicilio">{feriante.direccion}</Dato>
                <Dato titulo="Instagram">
                  {feriante.instagram &&
                    `@${feriante.instagram.replace(/^@/, "")}`}
                </Dato>
                <Dato titulo="Facebook">{feriante.facebook}</Dato>
                <Dato titulo="Sitio web">{feriante.sitioWeb}</Dato>
              </dl>
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCuerpo>
              <dl className="space-y-2.5 text-sm">
                <Dato titulo="Origen">
                  {padron
                    ? `Padrón de Feria Digital${feriante.feriaOrigen ? ` (${feriante.feriaOrigen})` : ""}`
                    : "Se registró en la plataforma"}
                </Dato>
                <Dato titulo="Alta">{formatearFecha(feriante.creadoEn)}</Dato>
                <Dato titulo="Revisada">
                  {feriante.revisadoEn && formatearFecha(feriante.revisadoEn)}
                </Dato>
                <Dato titulo="Motivo del rechazo">
                  {feriante.estado === "RECHAZADO" && feriante.motivoRechazo}
                </Dato>
                <Dato titulo="Productos">
                  {`${formatearNumero(publicados)} publicados`}
                  {feriante._count.productos > publicados &&
                    ` · ${formatearNumero(feriante._count.productos - publicados)} en revisión`}
                  {sinStock > 0 && ` · ${formatearNumero(sinStock)} sin stock`}
                </Dato>
                <Dato titulo="Últimos 30 días">
                  {`${formatearNumero(interes._sum.aperturas ?? 0)} visitas · ${formatearNumero(interes._sum.consultas ?? 0)} consultas por WhatsApp`}
                </Dato>
              </dl>
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

/** Un renglón de la ficha. Sin dato, no se muestra: nada de «—» de relleno. */
function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  if (
    children === null ||
    children === undefined ||
    children === false ||
    children === ""
  )
    return null;
  return (
    // El título arriba y el dato abajo: la columna es angosta, y en dos
    // columnas una dirección o un usuario de Instagram se partían en pedazos.
    <div>
      <dt className="text-xs text-slate-500">{titulo}</dt>
      <dd className="break-words text-slate-800">{children}</dd>
    </div>
  );
}
