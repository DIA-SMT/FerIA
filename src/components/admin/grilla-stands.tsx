"use client";

import { useActionState, useState } from "react";
import type { Rubro } from "@prisma/client";

import { asignarStand } from "@/actions/stands";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { Campo, Seleccion } from "@/components/ui/campo";
import { cn } from "@/lib/cn";
import { ESTADO_INICIAL } from "@/lib/form";
import { RUBROS } from "@/lib/labels";

export interface StandGrilla {
  id: string;
  numero: number;
  vendedor: { id: string; emprendimiento: string; rubro: Rubro } | null;
}

export interface VendedorAsignable {
  id: string;
  emprendimiento: string;
  rubro: Rubro;
}

interface PropsGrilla {
  stands: StandGrilla[];
  vendedores: VendedorAsignable[];
}

/**
 * Grilla de stands de una edición.
 *
 * Muestra ocupados y libres de un vistazo y, al elegir uno, abre el panel de
 * asignación. La acción vuelve a validar todo del lado del servidor: acá sólo
 * evitamos ofrecer feriantes que ya tienen stand en esta misma edición.
 */
export function GrillaStands({ stands, vendedores }: PropsGrilla) {
  const [seleccionado, setSeleccionado] = useState<StandGrilla | null>(null);

  const ocupados = stands.filter((stand) => stand.vendedor !== null);

  if (stands.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Esta edición todavía no tiene stands. Editala y definí la cantidad para
        generar la grilla.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Referencias */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-municipal-600 bg-municipal-500" />
          Ocupado ({ocupados.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-dashed border-slate-300 bg-white" />
          Libre ({stands.length - ocupados.length})
        </span>
      </div>

      {/* Grilla */}
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {stands.map((stand) => {
          const ocupado = stand.vendedor !== null;
          const activo = seleccionado?.id === stand.id;

          return (
            <li key={stand.id}>
              <button
                type="button"
                onClick={() =>
                  setSeleccionado((actual) =>
                    actual?.id === stand.id ? null : stand,
                  )
                }
                aria-pressed={activo}
                title={
                  ocupado
                    ? `Stand ${stand.numero} — ${stand.vendedor?.emprendimiento}`
                    : `Stand ${stand.numero} — libre`
                }
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center rounded-lg border p-1 text-center transition-all",
                  ocupado
                    ? "border-municipal-600 bg-municipal-500 text-white hover:bg-municipal-600"
                    : "border-dashed border-slate-300 bg-white text-slate-400 hover:border-municipal-400 hover:text-municipal-600",
                  activo && "ring-2 ring-acento-400 ring-offset-2",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-bold",
                    ocupado ? "text-white" : "text-slate-600",
                  )}
                >
                  {stand.numero}
                </span>
                {ocupado && (
                  <span className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-white/85">
                    {stand.vendedor?.emprendimiento}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Panel de asignación */}
      {seleccionado ? (
        <PanelAsignacion
          // La `key` reinicia el estado del formulario al cambiar de stand.
          key={seleccionado.id}
          stand={seleccionado}
          vendedores={vendedores}
          ocupadosPorOtros={ocupados
            .filter((stand) => stand.id !== seleccionado.id)
            .map((stand) => stand.vendedor?.id)
            .filter((id): id is string => Boolean(id))}
          alCerrar={() => setSeleccionado(null)}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
          Tocá un stand de la grilla para asignarlo o liberarlo.
        </p>
      )}
    </div>
  );
}

function PanelAsignacion({
  stand,
  vendedores,
  ocupadosPorOtros,
  alCerrar,
}: {
  stand: StandGrilla;
  vendedores: VendedorAsignable[];
  ocupadosPorOtros: string[];
  alCerrar: () => void;
}) {
  const [estado, accion] = useActionState(asignarStand, ESTADO_INICIAL);

  const yaAsignados = new Set(ocupadosPorOtros);
  const disponibles = vendedores.filter(
    (vendedor) =>
      !yaAsignados.has(vendedor.id) || vendedor.id === stand.vendedor?.id,
  );

  return (
    <div className="rounded-xl border border-municipal-200 bg-municipal-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Stand {stand.numero}</h3>
        {stand.vendedor ? (
          <Badge tono="verde">Ocupado</Badge>
        ) : (
          <Badge tono="neutro">Libre</Badge>
        )}
      </div>

      {stand.vendedor && (
        <p className="mt-1 text-sm text-slate-600">
          Asignado a{" "}
          <strong className="text-slate-900">
            {stand.vendedor.emprendimiento}
          </strong>{" "}
          ({RUBROS[stand.vendedor.rubro]})
        </p>
      )}

      {estado.mensaje && (
        <Alerta tipo={estado.ok ? "exito" : "error"} className="mt-3">
          {estado.mensaje}
        </Alerta>
      )}

      <form action={accion} className="mt-4 space-y-3">
        <input type="hidden" name="standId" value={stand.id} />

        <Campo
          htmlFor="vendedorId"
          etiqueta="Feriante"
          ayuda="Sólo se listan feriantes aprobados sin stand en esta edición. Dejalo vacío para liberarlo."
          errores={estado.errores?.vendedorId}
        >
          <Seleccion
            name="vendedorId"
            defaultValue={stand.vendedor?.id ?? ""}
            placeholder="— Sin asignar (liberar) —"
            opciones={disponibles.map((vendedor) => ({
              valor: vendedor.id,
              etiqueta: `${vendedor.emprendimiento} · ${RUBROS[vendedor.rubro]}`,
            }))}
            errores={estado.errores?.vendedorId}
          />
        </Campo>

        <div className="flex flex-wrap gap-2">
          <BotonEnvio tamanio="sm">Guardar asignación</BotonEnvio>
          <button
            type="button"
            onClick={alCerrar}
            className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
          >
            Cerrar
          </button>
        </div>
      </form>

      {disponibles.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          No hay feriantes aprobados disponibles. Aprobá solicitudes desde la
          bandeja o liberá otro stand.
        </p>
      )}
    </div>
  );
}
