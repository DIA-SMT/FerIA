import Link from "next/link";

import { AccionesPostulacion } from "@/components/admin/acciones-postulacion";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoTildeCirculo } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { prisma } from "@/lib/db";
import { formatearFechaHora } from "@/lib/format";
import {
  ESTADOS_POSTULACION,
  RUBROS,
  TONO_ESTADO_POSTULACION,
} from "@/lib/labels";
import { titularDe } from "@/lib/titular";
import {
  formatearWhatsapp,
  linkWhatsapp,
  mensajeConsultaStand,
} from "@/lib/whatsapp";

export const metadata = { title: "Postulaciones" };

/**
 * La bandeja de postulaciones a ferias.
 *
 * Es distinta de /admin/solicitudes, que resuelve el alta de una ficha. Acá se
 * decide quién entra a QUÉ feria, que es la decisión que antes no existía en
 * ningún lado: hasta ahora alguien asignaba un stand a mano sin que el feriante
 * hubiera pedido nada.
 *
 * Aceptar no asigna el puesto. Eso se hace en /admin/ediciones, cuando la
 * Dirección arma el mapa de cada edición, y por eso el mensaje de éxito lo
 * recuerda.
 */
export default async function PaginaPostulaciones() {
  const [pendientes, resueltas] = await Promise.all([
    prisma.postulacion.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { creadoEn: "asc" },
      select: {
        id: true,
        mensaje: true,
        creadoEn: true,
        feria: { select: { nombre: true, slug: true } },
        // Sin `slug`: la ficha todavía no está publicada, así que un enlace a
        // /stands/<slug> daría 404 justo cuando se la quiere mirar.
        vendedor: {
          select: {
            emprendimiento: true,
            rubro: true,
            descripcion: true,
            whatsapp: true,
            email: true,
            dni: true,
            nombreResponsable: true,
            estado: true,
            usuario: { select: { nombre: true, email: true } },
          },
        },
      },
    }),
    prisma.postulacion.findMany({
      where: { estado: { not: "PENDIENTE" } },
      orderBy: { revisadoEn: "desc" },
      take: 20,
      select: {
        id: true,
        estado: true,
        motivoRechazo: true,
        revisadoEn: true,
        feria: { select: { nombre: true } },
        vendedor: { select: { emprendimiento: true, slug: true } },
      },
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Postulaciones a ferias"
        descripcion="Quién pidió entrar a qué feria. Aceptar la postulación no asigna el puesto: eso se hace al armar cada edición."
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Esperando respuesta
        </h2>

        {pendientes.length === 0 ? (
          <EstadoVacio
            icono={IconoTildeCirculo}
            titulo="Bandeja al día"
            descripcion="No hay postulaciones esperando revisión."
          />
        ) : (
          <div className="space-y-4">
            {pendientes.map((postulacion) => {
              const titular = titularDe(postulacion.vendedor);

              return (
                <Tarjeta key={postulacion.id}>
                  <TarjetaCuerpo>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {postulacion.vendedor.emprendimiento}
                        </p>
                        {/* El DNI va acá porque es lo que permite verificar a
                            la persona: cuando entró por CiDiTuc lo trae
                            validado contra el padrón municipal, y si falta es
                            señal de que la cuenta se hizo con contraseña. */}
                        <p className="text-sm text-slate-600">
                          {titular.nombre}
                          {postulacion.vendedor.dni
                            ? ` · DNI ${postulacion.vendedor.dni}`
                            : ""}
                          {titular.email ? ` · ${titular.email}` : ""}
                        </p>
                        {/* El WhatsApp es por donde la Dirección resuelve las
                            dudas antes de contestar, así que va a la vista y
                            no a dos clics de distancia. */}
                        <a
                          href={linkWhatsapp(
                            postulacion.vendedor.whatsapp,
                            mensajeConsultaStand(
                              postulacion.vendedor.emprendimiento,
                            ),
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-municipal-600 transition-colors hover:text-municipal-700"
                        >
                          {formatearWhatsapp(postulacion.vendedor.whatsapp)}
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tono="neutro" tamanio="sm">
                          {RUBROS[postulacion.vendedor.rubro]}
                        </Badge>
                        <Badge tono="azul" tamanio="sm">
                          {postulacion.feria.nombre}
                        </Badge>
                      </div>
                    </div>

                    {postulacion.mensaje && (
                      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">
                        {postulacion.mensaje}
                      </p>
                    )}

                    {postulacion.vendedor.descripcion && (
                      <p className="mt-3 text-sm whitespace-pre-line text-slate-600">
                        {postulacion.vendedor.descripcion}
                      </p>
                    )}

                    <p className="mt-3 text-xs text-slate-500">
                      Se postuló el {formatearFechaHora(postulacion.creadoEn)}
                      {postulacion.vendedor.estado !== "APROBADO" &&
                        " · su ficha todavía no está publicada, aceptarla también la publica"}
                    </p>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <AccionesPostulacion
                        postulacionId={postulacion.id}
                        emprendimiento={postulacion.vendedor.emprendimiento}
                      />
                    </div>
                  </TarjetaCuerpo>
                </Tarjeta>
              );
            })}
          </div>
        )}
      </section>

      {resueltas.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Resueltas recientemente
          </h2>

          <Tarjeta>
            <TarjetaCuerpo>
              <ul className="divide-y divide-slate-100">
                {resueltas.map((postulacion) => (
                  <li
                    key={postulacion.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        <Link
                          href={`/stands/${postulacion.vendedor.slug}`}
                          className="transition-colors hover:text-municipal-700"
                        >
                          {postulacion.vendedor.emprendimiento}
                        </Link>{" "}
                        <span className="font-normal text-slate-500">
                          en {postulacion.feria.nombre}
                        </span>
                      </p>
                      {postulacion.motivoRechazo && (
                        <p className="mt-1 text-sm text-red-900">
                          {postulacion.motivoRechazo}
                        </p>
                      )}
                    </div>
                    <Badge
                      tono={TONO_ESTADO_POSTULACION[postulacion.estado]}
                      tamanio="sm"
                    >
                      {ESTADOS_POSTULACION[postulacion.estado]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </TarjetaCuerpo>
          </Tarjeta>
        </section>
      )}

      <Alerta tipo="info" className="mt-8">
        Una postulación aceptada todavía no tiene lugar físico. El número de
        stand se asigna en{" "}
        <Link href="/admin/ediciones" className="font-medium underline">
          las ediciones
        </Link>
        , cuando se arma el mapa de cada una.
      </Alerta>
    </>
  );
}
