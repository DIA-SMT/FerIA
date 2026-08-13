"use client";

import { useRouter } from "next/navigation";

import { ESTADOS_PERMISO } from "@/lib/canon";

interface PropsFiltrosCanon {
  valores: { edicion: string; estado: string };
  ediciones: Array<{ id: string; etiqueta: string }>;
}

const ESTILO_SELECT =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm " +
  "focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none sm:w-64";

/** Filtros del listado de canon. Navegan al cambiar, sin botón de envío. */
export function FiltrosCanon({ valores, ediciones }: PropsFiltrosCanon) {
  const router = useRouter();

  function navegar(cambios: Partial<typeof valores>): void {
    const proximos = { ...valores, ...cambios };
    const params = new URLSearchParams();
    if (proximos.edicion) params.set("edicion", proximos.edicion);
    if (proximos.estado) params.set("estado", proximos.estado);

    const consulta = params.toString();
    router.push(consulta ? `/admin/canon?${consulta}` : "/admin/canon");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div>
        <label
          htmlFor="filtro-edicion"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Edición
        </label>
        <select
          id="filtro-edicion"
          value={valores.edicion}
          onChange={(evento) => navegar({ edicion: evento.target.value })}
          className={ESTILO_SELECT}
        >
          <option value="">Todas las ediciones</option>
          {ediciones.map((edicion) => (
            <option key={edicion.id} value={edicion.id}>
              {edicion.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="filtro-estado"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Estado del permiso
        </label>
        <select
          id="filtro-estado"
          value={valores.estado}
          onChange={(evento) => navegar({ estado: evento.target.value })}
          className={ESTILO_SELECT}
        >
          <option value="">Todos</option>
          {Object.entries(ESTADOS_PERMISO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

      {(valores.edicion || valores.estado) && (
        <button
          type="button"
          onClick={() => router.push("/admin/canon")}
          className="h-10 self-end rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
