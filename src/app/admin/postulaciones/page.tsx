import Link from "next/link";

import { reabrirSolicitud } from "@/actions/vendedores";
import { AccionesPostulacion } from "@/components/admin/acciones-postulacion";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { TarjetaSolicitud } from "@/components/admin/tarjeta-solicitud";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoTildeCirculo } from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { edicionesVigentes } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearFecha, formatearFechaHora } from "@/lib/format";
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
 * La única bandeja de gente esperando respuesta.
 *
 * Antes eran dos —/admin/solicitudes resolvía el alta de una ficha y esta, a
 * qué feria entra cada uno— y nadie entendía la diferencia, con razón: aceptar
 * una postulación aprobaba la ficha de rebote, así que para quien venía por el
 * circuito nuevo Solicitudes no se tocaba nunca. Era un resto del circuito
 * anterior.
 *
 * Ahora es una sola pantalla con dos secciones, que son los dos permisos del
 * sistema y en el orden en que se dan:
 *
 * 1. **El alta.** «¿Esta persona es feriante del municipio?» Aprobarla le
 *    habilita el stand virtual: la vidriera y el catálogo.
 * 2. **Las ferias presenciales.** «¿Este feriante va a la Plaza Urquiza?» Se
 *    pide después, feria por feria, y es opcional.
 *
 * Y una tercera que no es un pedido sino un aviso: quién se bajó de una feria
 * teniendo todavía un puesto asignado en una edición que no pasó. Eso no se
 * libera solo a propósito —un click del feriante no modifica un mapa ya
 * publicado— así que hay que verlo en algún lado o queda un puesto fantasma.
 *
 * Las fichas del padrón importado no entran acá: también nacen pendientes, pero
 * nadie las presentó. Se revisan desde /admin/feriantes.
 */
export default async function PaginaPostulaciones() {
  const hoy = new Date();

  const [altas, pedidos, bajasConPuesto, resueltas, altasRechazadas] =
    await Promise.all([
      prisma.vendedor.findMany({
        where: { estado: "PENDIENTE", usuarioId: { not: null } },
        orderBy: { creadoEn: "asc" },
        include: {
          usuario: { select: { nombre: true, email: true } },
          // La feria que eligió en la encuesta, si eligió alguna: es contexto
          // para decidir el alta, no una decisión que se tome en esta tarjeta.
          postulaciones: {
            where: { estado: "PENDIENTE" },
            take: 1,
            select: { feria: { select: { nombre: true } } },
          },
        },
      }),

      prisma.postulacion.findMany({
        // Sólo de fichas ya aprobadas. Un pedido de feria de alguien cuya alta
        // todavía está en revisión no es una decisión que se pueda tomar: el
        // primer permiso es ser feriante, y hasta que no esté, este pedido no
        // existe para la Dirección.
        where: { estado: "PENDIENTE", vendedor: { estado: "APROBADO" } },
        orderBy: { creadoEn: "asc" },
        select: {
          id: true,
          mensaje: true,
          creadoEn: true,
          feria: { select: { nombre: true } },
          vendedor: {
            select: {
              emprendimiento: true,
              slug: true,
              rubro: true,
              descripcion: true,
              whatsapp: true,
              email: true,
              dni: true,
              nombreResponsable: true,
              usuario: { select: { nombre: true, email: true } },
            },
          },
        },
      }),

      prisma.postulacion.findMany({
        where: {
          estado: "RETIRADA",
          vendedor: {
            stands: { some: { edicion: edicionesVigentes(hoy) } },
          },
        },
        orderBy: { actualizadoEn: "desc" },
        select: {
          id: true,
          actualizadoEn: true,
          feria: { select: { nombre: true, slug: true } },
          vendedor: {
            select: {
              emprendimiento: true,
              slug: true,
              whatsapp: true,
              stands: {
                where: { edicion: edicionesVigentes(hoy) },
                select: {
                  numero: true,
                  edicion: {
                    select: {
                      fechaInicio: true,
                      feria: { select: { nombre: true, slug: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),

      prisma.postulacion.findMany({
        where: { estado: { in: ["ACEPTADA", "RECHAZADA"] } },
        orderBy: { revisadoEn: "desc" },
        take: 20,
        select: {
          id: true,
          estado: true,
          motivoRechazo: true,
          feria: { select: { nombre: true } },
          vendedor: { select: { emprendimiento: true, slug: true } },
        },
      }),

      prisma.vendedor.findMany({
        where: { estado: "RECHAZADO", usuarioId: { not: null } },
        orderBy: { revisadoEn: "desc" },
        take: 10,
        select: {
          id: true,
          emprendimiento: true,
          rubro: true,
          motivoRechazo: true,
          revisadoEn: true,
          nombreResponsable: true,
          email: true,
          usuario: { select: { nombre: true, email: true } },
        },
      }),
    ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Postulaciones"
        descripcion="Todo lo que espera respuesta: las altas de feriantes y los pedidos para estar en una feria presencial."
      />

      <Alerta tipo="info" className="mb-6">
        Son dos permisos y van en orden. Aprobar el <strong>alta</strong> le
        habilita al feriante su stand virtual —vidriera y catálogo—. Recién
        después puede pedir estar en una <strong>feria presencial</strong>, que
        es opcional y se resuelve feria por feria. Habilitarlo en una feria
        todavía no le reserva un puesto: el número de stand se asigna en{" "}
        <Link href="/admin/ediciones" className="font-medium underline">
          las ediciones
        </Link>
        , al armar el mapa de cada una.
      </Alerta>

      {/* ------------------------------ Altas ------------------------------ */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Altas esperando respuesta
          </h2>
          {altas.length > 0 && <Badge tono="amarillo">{altas.length}</Badge>}
        </div>

        {altas.length === 0 ? (
          <EstadoVacio
            icono={IconoTildeCirculo}
            titulo="Ninguna alta pendiente"
            descripcion="No hay emprendimientos esperando que los den de alta."
          />
        ) : (
          <div className="space-y-4">
            {altas.map((alta) => {
              const titular = titularDe(alta);

              return (
                <TarjetaSolicitud
                  key={alta.id}
                  solicitud={{
                    id: alta.id,
                    emprendimiento: alta.emprendimiento,
                    rubro: alta.rubro,
                    descripcion: alta.descripcion,
                    whatsapp: alta.whatsapp,
                    telefono: alta.telefono,
                    instagram: alta.instagram,
                    facebook: alta.facebook,
                    sitioWeb: alta.sitioWeb,
                    dni: alta.dni,
                    direccion: alta.direccion,
                    creadoEn: alta.creadoEn,
                    nombreTitular: titular.nombre,
                    emailTitular: titular.email ?? "Sin correo",
                    feriaPedida: alta.postulaciones[0]?.feria.nombre ?? null,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ---------------------- Pedidos de feria --------------------------- */}
      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Pedidos para estar en una feria
          </h2>
          {pedidos.length > 0 && <Badge tono="amarillo">{pedidos.length}</Badge>}
        </div>

        {pedidos.length === 0 ? (
          <EstadoVacio
            icono={IconoTildeCirculo}
            titulo="Ningún pedido pendiente"
            descripcion="Ningún feriante está esperando respuesta para una feria presencial."
          />
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => {
              const titular = titularDe(pedido.vendedor);

              return (
                <Tarjeta key={pedido.id}>
                  <TarjetaCuerpo>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          <Link
                            href={`/stands/${pedido.vendedor.slug}`}
                            target="_blank"
                            className="transition-colors hover:text-municipal-700"
                          >
                            {pedido.vendedor.emprendimiento}
                          </Link>
                        </p>
                        {/* El DNI va acá porque es lo que permite verificar a
                            la persona: cuando entró por CiDiTuc lo trae
                            validado contra el padrón municipal, y si falta es
                            señal de que la cuenta se hizo con contraseña. */}
                        <p className="text-sm text-slate-600">
                          {titular.nombre}
                          {pedido.vendedor.dni
                            ? ` · DNI ${pedido.vendedor.dni}`
                            : ""}
                          {titular.email ? ` · ${titular.email}` : ""}
                        </p>
                        {/* El WhatsApp es por donde la Dirección resuelve las
                            dudas antes de contestar, así que va a la vista y
                            no a dos clics de distancia. */}
                        <a
                          href={linkWhatsapp(
                            pedido.vendedor.whatsapp,
                            mensajeConsultaStand(
                              pedido.vendedor.emprendimiento,
                            ),
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-municipal-600 transition-colors hover:text-municipal-700"
                        >
                          {formatearWhatsapp(pedido.vendedor.whatsapp)}
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tono="neutro" tamanio="sm">
                          {RUBROS[pedido.vendedor.rubro]}
                        </Badge>
                        <Badge tono="azul" tamanio="sm">
                          {pedido.feria.nombre}
                        </Badge>
                      </div>
                    </div>

                    {pedido.mensaje && (
                      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">
                        {pedido.mensaje}
                      </p>
                    )}

                    {pedido.vendedor.descripcion && (
                      <p className="mt-3 text-sm whitespace-pre-line text-slate-600">
                        {pedido.vendedor.descripcion}
                      </p>
                    )}

                    <p className="mt-3 text-xs text-slate-500">
                      Lo pidió el {formatearFechaHora(pedido.creadoEn)}
                    </p>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <AccionesPostulacion
                        postulacionId={pedido.id}
                        emprendimiento={pedido.vendedor.emprendimiento}
                      />
                    </div>
                  </TarjetaCuerpo>
                </Tarjeta>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------- Se bajaron y el puesto quedó asignado ---------------- */}
      {bajasConPuesto.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Se bajaron y todavía tienen puesto asignado
          </h2>

          <Tarjeta>
            <TarjetaEncabezado
              titulo="Hay puestos para liberar"
              descripcion="Bajarse no libera el stand: el mapa de una edición publicada no cambia por un click. Liberalos al revisar la edición."
            />
            <TarjetaCuerpo>
              <ul className="divide-y divide-slate-100">
                {bajasConPuesto.map((baja) => (
                  <li
                    key={baja.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        <Link
                          href={`/stands/${baja.vendedor.slug}`}
                          target="_blank"
                          className="transition-colors hover:text-municipal-700"
                        >
                          {baja.vendedor.emprendimiento}
                        </Link>{" "}
                        <span className="font-normal text-slate-500">
                          se bajó de {baja.feria.nombre} el{" "}
                          {formatearFecha(baja.actualizadoEn)}
                        </span>
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {baja.vendedor.stands.map((stand) => (
                          <li
                            key={`${stand.edicion.feria.slug}-${stand.numero}`}
                            className="text-sm text-amber-800"
                          >
                            Puesto {stand.numero} ·{" "}
                            {stand.edicion.feria.nombre} del{" "}
                            {formatearFecha(stand.edicion.fechaInicio)}
                          </li>
                        ))}
                      </ul>
                      <a
                        href={linkWhatsapp(
                          baja.vendedor.whatsapp,
                          mensajeConsultaStand(baja.vendedor.emprendimiento),
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm text-municipal-600 transition-colors hover:text-municipal-700"
                      >
                        {formatearWhatsapp(baja.vendedor.whatsapp)}
                      </a>
                    </div>
                    <Badge tono="neutro" tamanio="sm">
                      Se bajó
                    </Badge>
                  </li>
                ))}
              </ul>
            </TarjetaCuerpo>
          </Tarjeta>
        </section>
      )}

      {/* ------------------------- Ya resueltas ---------------------------- */}
      {resueltas.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Ferias resueltas recientemente
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

      {/* --------------------- Altas rechazadas ---------------------------- */}
      {altasRechazadas.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Altas rechazadas
          </h2>

          <Tarjeta>
            <TarjetaEncabezado
              titulo={`${altasRechazadas.length} ${
                altasRechazadas.length === 1 ? "rechazada" : "rechazadas"
              }`}
              descripcion="Podés reabrirlas si el feriante corrigió lo observado."
            />
            <TarjetaCuerpo>
              <ul className="divide-y divide-slate-100">
                {altasRechazadas.map((alta) => {
                  const titular = titularDe(alta);

                  return (
                    <li
                      key={alta.id}
                      className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {alta.emprendimiento}
                          </p>
                          <Badge tono="neutro" tamanio="sm">
                            {RUBROS[alta.rubro]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {titular.nombre} · {titular.email ?? "Sin correo"}
                        </p>
                        {alta.motivoRechazo && (
                          <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-900">
                            {alta.motivoRechazo}
                          </p>
                        )}
                        {alta.revisadoEn && (
                          <p className="mt-1 text-xs text-slate-400">
                            Rechazada el {formatearFechaHora(alta.revisadoEn)}
                          </p>
                        )}
                      </div>

                      <BotonConfirmar
                        accion={reabrirSolicitud}
                        campos={{ vendedorId: alta.id }}
                        variante="contorno"
                        confirmacion={`¿Reabrir el alta de "${alta.emprendimiento}"? Vuelve a quedar esperando respuesta.`}
                      >
                        Reabrir
                      </BotonConfirmar>
                    </li>
                  );
                })}
              </ul>
            </TarjetaCuerpo>
          </Tarjeta>
        </section>
      )}
    </>
  );
}
