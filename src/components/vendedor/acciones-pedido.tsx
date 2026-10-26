"use client";

import { useActionState, useState } from "react";

import { cambiarEstadoPedido } from "@/actions/pedidos";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo } from "@/components/ui/campo";
import { ESTADO_INICIAL } from "@/lib/form";

/**
 * Lo que el feriante puede hacer con un pedido.
 *
 * No hay botón de «cobrado»: el municipio no sabe si le pagaron ni tiene por
 * qué saberlo. Lo que se registra es si lo tomó y si lo entregó, que es lo que
 * la plataforma puede afirmar.
 *
 * Cancelar pide el motivo porque lo lee el vecino en la pantalla de su pedido:
 * una cancelación sin explicación es peor que no avisar.
 */
export function AccionesPedido({
  pedidoId,
  estado,
}: {
  pedidoId: string;
  estado: "PENDIENTE" | "CONFIRMADO";
}) {
  const [resultado, accion] = useActionState(
    cambiarEstadoPedido,
    ESTADO_INICIAL,
  );
  const [cancelando, setCancelando] = useState(false);

  if (cancelando) {
    return (
      <form action={accion} className="space-y-3">
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <input type="hidden" name="estado" value="CANCELADO" />

        {resultado.mensaje && !resultado.ok && (
          <Alerta tipo="error">{resultado.mensaje}</Alerta>
        )}

        <Campo
          htmlFor={`motivo-${pedidoId}`}
          etiqueta="¿Por qué lo cancelás?"
          ayuda="Lo va a leer quien hizo el pedido."
          errores={resultado.errores?.motivoCancelacion}
        >
          <AreaTexto
            id={`motivo-${pedidoId}`}
            name="motivoCancelacion"
            rows={2}
            maxLength={300}
            placeholder="Se me terminó la mercadería, no llego con los tiempos…"
            errores={resultado.errores?.motivoCancelacion}
          />
        </Campo>

        <div className="flex flex-wrap gap-2">
          <BotonEnvio
            variante="peligro"
            tamanio="sm"
            textoEnviando="Cancelando…"
          >
            Confirmar cancelación
          </BotonEnvio>
          <button
            type="button"
            onClick={() => setCancelando(false)}
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
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <input
            type="hidden"
            name="estado"
            value={estado === "PENDIENTE" ? "CONFIRMADO" : "ENTREGADO"}
          />
          <BotonEnvio tamanio="sm" textoEnviando="Guardando…">
            {estado === "PENDIENTE" ? "Tomar el pedido" : "Marcar entregado"}
          </BotonEnvio>
        </form>

        <button
          type="button"
          onClick={() => setCancelando(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
