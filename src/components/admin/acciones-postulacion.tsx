"use client";

import { useActionState, useState } from "react";

import { resolverPostulacion } from "@/actions/postulaciones";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo } from "@/components/ui/campo";
import { ESTADO_INICIAL } from "@/lib/form";

/**
 * Aceptar o rechazar una postulación.
 *
 * Aceptar es un botón solo: es la decisión que no necesita explicación.
 * Rechazar abre el motivo, y el servidor lo exige, porque sin motivo el
 * feriante no sabe qué corregir y la Dirección no deja registro de por qué
 * decidió lo que decidió.
 */
export function AccionesPostulacion({
  postulacionId,
  emprendimiento,
}: {
  postulacionId: string;
  emprendimiento: string;
}) {
  const [resultado, accion] = useActionState(
    resolverPostulacion,
    ESTADO_INICIAL,
  );
  const [rechazando, setRechazando] = useState(false);

  if (rechazando) {
    return (
      <form action={accion} className="space-y-3">
        <input type="hidden" name="postulacionId" value={postulacionId} />
        <input type="hidden" name="decision" value="RECHAZADA" />

        {resultado.mensaje && !resultado.ok && (
          <Alerta tipo="error">{resultado.mensaje}</Alerta>
        )}

        <Campo
          htmlFor={`motivo-${postulacionId}`}
          etiqueta={`¿Por qué se rechaza a ${emprendimiento}?`}
          ayuda="Lo va a leer el feriante."
          errores={resultado.errores?.motivoRechazo}
        >
          <AreaTexto
            id={`motivo-${postulacionId}`}
            name="motivoRechazo"
            rows={2}
            maxLength={300}
            placeholder="Ej. El rubro no corresponde a esta feria; los cupos de la edición están completos."
            errores={resultado.errores?.motivoRechazo}
          />
        </Campo>

        <div className="flex flex-wrap gap-2">
          <BotonEnvio
            variante="peligro"
            tamanio="sm"
            textoEnviando="Rechazando…"
          >
            Confirmar rechazo
          </BotonEnvio>
          <button
            type="button"
            onClick={() => setRechazando(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Volver
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      {resultado.mensaje && !resultado.ok && (
        <Alerta tipo="error">{resultado.mensaje}</Alerta>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={accion}>
          <input type="hidden" name="postulacionId" value={postulacionId} />
          <input type="hidden" name="decision" value="ACEPTADA" />
          <BotonEnvio tamanio="sm" textoEnviando="Aceptando…">
            Aceptar en la feria
          </BotonEnvio>
        </form>

        <button
          type="button"
          onClick={() => setRechazando(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
