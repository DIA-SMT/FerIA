"use client";

import { useActionState, useState } from "react";
import type { Rubro } from "@prisma/client";

import { aprobarVendedor, rechazarVendedor } from "@/actions/vendedores";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { Boton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo } from "@/components/ui/campo";
import {
  IconoCorreo,
  IconoTelefono,
  IconoWhatsapp,
} from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo, TarjetaPie } from "@/components/ui/tarjeta";
import { ESTADO_INICIAL } from "@/lib/form";
import { formatearFechaHora } from "@/lib/format";
import { RUBROS } from "@/lib/labels";
import { formatearWhatsapp } from "@/lib/whatsapp";

export interface Solicitud {
  id: string;
  emprendimiento: string;
  rubro: Rubro;
  descripcion: string | null;
  whatsapp: string;
  telefono: string | null;
  instagram: string | null;
  facebook: string | null;
  sitioWeb: string | null;
  dni: string | null;
  direccion: string | null;
  creadoEn: Date;
  nombreTitular: string;
  emailTitular: string;
}

export function TarjetaSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const [mostrarRechazo, setMostrarRechazo] = useState(false);

  const [estadoAprobar, aprobar] = useActionState(
    aprobarVendedor,
    ESTADO_INICIAL,
  );
  const [estadoRechazar, rechazar] = useActionState(
    rechazarVendedor,
    ESTADO_INICIAL,
  );

  const mensaje = estadoAprobar.mensaje ?? estadoRechazar.mensaje;
  const ok = estadoAprobar.mensaje ? estadoAprobar.ok : estadoRechazar.ok;

  return (
    <Tarjeta>
      <TarjetaCuerpo className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">
              {solicitud.emprendimiento}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {solicitud.nombreTitular}
              {solicitud.dni && ` · DNI ${solicitud.dni}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge tono="celeste">{RUBROS[solicitud.rubro]}</Badge>
            <span className="text-xs text-slate-400">
              Solicitud del {formatearFechaHora(solicitud.creadoEn)}
            </span>
          </div>
        </div>

        {solicitud.descripcion && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">
            {solicitud.descripcion}
          </p>
        )}

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <dt className="sr-only">WhatsApp</dt>
            <IconoWhatsapp className="size-4 shrink-0 text-slate-400" />
            <dd className="text-slate-700">
              {formatearWhatsapp(solicitud.whatsapp)}
            </dd>
          </div>

          <div className="flex items-center gap-2">
            <dt className="sr-only">Correo</dt>
            <IconoCorreo className="size-4 shrink-0 text-slate-400" />
            <dd className="truncate text-slate-700">
              {solicitud.emailTitular}
            </dd>
          </div>

          {solicitud.telefono && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Teléfono</dt>
              <IconoTelefono className="size-4 shrink-0 text-slate-400" />
              <dd className="text-slate-700">{solicitud.telefono}</dd>
            </div>
          )}

          {solicitud.direccion && (
            <div className="flex items-center gap-2">
              <dt className="text-slate-500">Dirección:</dt>
              <dd className="truncate text-slate-700">{solicitud.direccion}</dd>
            </div>
          )}

          {solicitud.instagram && (
            <div className="flex items-center gap-2">
              <dt className="text-slate-500">Instagram:</dt>
              <dd className="truncate text-slate-700">
                @{solicitud.instagram}
              </dd>
            </div>
          )}

          {solicitud.sitioWeb && (
            <div className="flex items-center gap-2">
              <dt className="text-slate-500">Web:</dt>
              <dd className="truncate text-slate-700">{solicitud.sitioWeb}</dd>
            </div>
          )}
        </dl>

        {mensaje && (
          <Alerta tipo={ok ? "exito" : "error"}>{mensaje}</Alerta>
        )}

        {mostrarRechazo && (
          <form action={rechazar} className="space-y-3 border-t border-slate-200 pt-4">
            <input type="hidden" name="vendedorId" value={solicitud.id} />
            <Campo
              htmlFor={`motivoRechazo-${solicitud.id}`}
              etiqueta="Motivo del rechazo"
              ayuda="Se le muestra al feriante en su panel. Sé concreto: le sirve para corregir y volver a presentarse."
              errores={estadoRechazar.errores?.motivoRechazo}
              requerido
            >
              <AreaTexto
                name="motivoRechazo"
                id={`motivoRechazo-${solicitud.id}`}
                rows={3}
                placeholder="Ej. El rubro declarado no corresponde a producción propia según el reglamento de ferias (Ord. 4.812, art. 5)."
                errores={estadoRechazar.errores?.motivoRechazo}
                required
              />
            </Campo>
            <div className="flex flex-wrap gap-2">
              <BotonEnvio variante="peligro" tamanio="sm" textoEnviando="Rechazando…">
                Confirmar rechazo
              </BotonEnvio>
              <Boton
                type="button"
                variante="fantasma"
                tamanio="sm"
                onClick={() => setMostrarRechazo(false)}
              >
                Cancelar
              </Boton>
            </div>
          </form>
        )}
      </TarjetaCuerpo>

      {!mostrarRechazo && (
        <TarjetaPie>
          <Boton
            type="button"
            variante="contorno"
            onClick={() => setMostrarRechazo(true)}
          >
            Rechazar
          </Boton>
          <form action={aprobar}>
            <input type="hidden" name="vendedorId" value={solicitud.id} />
            <BotonEnvio textoEnviando="Aprobando…">Aprobar solicitud</BotonEnvio>
          </form>
        </TarjetaPie>
      )}
    </Tarjeta>
  );
}
