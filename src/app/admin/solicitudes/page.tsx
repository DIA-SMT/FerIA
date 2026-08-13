import Link from "next/link";

import { reabrirSolicitud } from "@/actions/vendedores";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { TarjetaSolicitud } from "@/components/admin/tarjeta-solicitud";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoTildeCirculo } from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { prisma } from "@/lib/db";
import { formatearFechaHora } from "@/lib/format";
import { RUBROS } from "@/lib/labels";

export const metadata = { title: "Solicitudes" };

export default async function PaginaSolicitudes() {
  const [pendientes, rechazadas] = await Promise.all([
    prisma.vendedor.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { creadoEn: "asc" },
      include: { usuario: { select: { nombre: true, email: true } } },
    }),
    prisma.vendedor.findMany({
      where: { estado: "RECHAZADO" },
      orderBy: { revisadoEn: "desc" },
      take: 20,
      include: { usuario: { select: { nombre: true, email: true } } },
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Solicitudes de feriantes"
        descripcion="Revisá los emprendimientos que pidieron participar. Sólo los aprobados aparecen en el market y pueden ocupar stands."
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Pendientes</h2>
          {pendientes.length > 0 && (
            <Badge tono="amarillo">{pendientes.length}</Badge>
          )}
        </div>

        {pendientes.length === 0 ? (
          <EstadoVacio
            icono={IconoTildeCirculo}
            titulo="Bandeja al día"
            descripcion="No hay solicitudes esperando revisión."
          />
        ) : (
          <div className="space-y-4">
            {pendientes.map((solicitud) => (
              <TarjetaSolicitud
                key={solicitud.id}
                solicitud={{
                  id: solicitud.id,
                  emprendimiento: solicitud.emprendimiento,
                  rubro: solicitud.rubro,
                  descripcion: solicitud.descripcion,
                  whatsapp: solicitud.whatsapp,
                  telefono: solicitud.telefono,
                  instagram: solicitud.instagram,
                  facebook: solicitud.facebook,
                  sitioWeb: solicitud.sitioWeb,
                  dni: solicitud.dni,
                  direccion: solicitud.direccion,
                  creadoEn: solicitud.creadoEn,
                  nombreTitular: solicitud.usuario.nombre,
                  emailTitular: solicitud.usuario.email,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {rechazadas.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Rechazadas recientemente
          </h2>

          <Tarjeta>
            <TarjetaEncabezado
              titulo={`${rechazadas.length} ${
                rechazadas.length === 1 ? "solicitud" : "solicitudes"
              }`}
              descripcion="Podés reabrirlas si el feriante corrigió lo observado."
            />
            <TarjetaCuerpo>
              <ul className="divide-y divide-slate-100">
                {rechazadas.map((solicitud) => (
                  <li
                    key={solicitud.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {solicitud.emprendimiento}
                        </p>
                        <Badge tono="neutro" tamanio="sm">
                          {RUBROS[solicitud.rubro]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {solicitud.usuario.nombre} · {solicitud.usuario.email}
                      </p>
                      {solicitud.motivoRechazo && (
                        <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-900">
                          {solicitud.motivoRechazo}
                        </p>
                      )}
                      {solicitud.revisadoEn && (
                        <p className="mt-1 text-xs text-slate-400">
                          Rechazada el {formatearFechaHora(solicitud.revisadoEn)}
                        </p>
                      )}
                    </div>

                    <BotonConfirmar
                      accion={reabrirSolicitud}
                      campos={{ vendedorId: solicitud.id }}
                      confirmacion={`¿Volver a poner la solicitud de "${solicitud.emprendimiento}" como pendiente?`}
                      variante="contorno"
                    >
                      Reabrir
                    </BotonConfirmar>
                  </li>
                ))}
              </ul>
            </TarjetaCuerpo>
          </Tarjeta>
        </section>
      )}

      <p className="mt-8 text-sm text-slate-500">
        ¿Buscás un feriante ya aprobado?{" "}
        <Link
          href="/admin/feriantes"
          className="font-medium text-municipal-600 hover:text-municipal-700"
        >
          Ver el listado completo
        </Link>
      </p>
    </>
  );
}
