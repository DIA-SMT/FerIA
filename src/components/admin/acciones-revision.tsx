"use client";

import { useActionState, useState } from "react";

import {
  aprobarCambioDelStand,
  rechazarCambioDelStand,
} from "@/actions/revisiones";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo } from "@/components/ui/campo";
import { ESTADO_INICIAL } from "@/lib/form";

/**
 * Aprobar o rechazar un cambio del stand.
 *
 * Igual que con las postulaciones: aprobar es un botón solo, y rechazar abre
 * el motivo, que el servidor exige. Sin motivo el feriante no sabe qué
 * corregir, y es lo primero que va a leer al entrar a su stand.
 */
export function AccionesRevision({
  cambioId,
  emprendimiento,
}: {
  cambioId: string;
  emprendimiento: string;
}) {
  const [aprobacion, aprobar] = useActionState(
    aprobarCambioDelStand,
    ESTADO_INICIAL,
  );
  const [rechazo, rechazar] = useActionState(
    rechazarCambioDelStand,
    ESTADO_INICIAL,
  );
  const [rechazando, setRechazando] = useState(false);

  const error =
    (!aprobacion.ok && aprobacion.mensaje) ||
    (!rechazo.ok && !rechazo.errores && rechazo.mensaje) ||
    null;

  if (rechazando) {
    return (
      <form action={rechazar} className="space-y-3">
        <input type="hidden" name="cambioId" value={cambioId} />
        {error && <Alerta tipo="error">{error}</Alerta>}
        <Campo
          htmlFor={`motivo-${cambioId}`}
          etiqueta={`¿Por qué no se aprueba? Lo va a leer ${emprendimiento}.`}
          errores={rechazo.errores?.motivoRechazo}
        >
          <AreaTexto
            id={`motivo-${cambioId}`}
            name="motivoRechazo"
            rows={2}
            maxLength={300}
            placeholder="Ej. La foto está borrosa; subí una con buena luz donde se vea el producto."
            errores={rechazo.errores?.motivoRechazo}
          />
        </Campo>
        <div className="flex flex-wrap gap-2">
          <BotonEnvio variante="peligro" tamanio="sm" textoEnviando="Rechazando…">
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
      {error && <Alerta tipo="error">{error}</Alerta>}
      <div className="flex flex-wrap gap-2">
        <form action={aprobar}>
          <input type="hidden" name="cambioId" value={cambioId} />
          <BotonEnvio tamanio="sm" textoEnviando="Aprobando…">
            Aprobar y publicar
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
