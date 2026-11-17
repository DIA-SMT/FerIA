"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { SIN_FERIA, type TipoDeCambio } from "@/lib/tipos-de-cambio";

function enlace(tipo: string, feria: string): string {
  const params = new URLSearchParams();
  if (tipo) params.set("tipo", tipo);
  if (feria) params.set("feria", feria);
  const consulta = params.toString();
  return consulta ? `/admin/revisiones?${consulta}` : "/admin/revisiones";
}

/**
 * Los filtros de la bandeja de revisiones: qué tipo de cambio y de qué feria.
 *
 * El tipo va en pastillas con la cantidad de cada uno, porque es lo que se
 * mira de un vistazo («hay 12 productos nuevos»); sólo aparecen los que tienen
 * algo, más el elegido. La feria va en un desplegable: son nueve y crecen.
 * Las cantidades de las pastillas ya vienen filtradas por la feria elegida.
 */
export function FiltrosRevisiones({
  tipo,
  feria,
  conteos,
  total,
  tipos,
  ferias,
}: {
  tipo: string;
  feria: string;
  conteos: Partial<Record<TipoDeCambio, number>>;
  total: number;
  tipos: Record<TipoDeCambio, string>;
  ferias: Array<{ slug: string; nombre: string }>;
}) {
  const router = useRouter();

  const pastillas = (Object.keys(tipos) as TipoDeCambio[]).filter(
    (clave) => (conteos[clave] ?? 0) > 0 || clave === tipo,
  );

  const estiloPastilla = (activa: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors",
      activa
        ? "paleta-original bg-municipal-600 text-white ring-municipal-600"
        : "bg-superficie text-slate-700 ring-slate-200 hover:bg-slate-50",
    );

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filtro-feria" className="text-sm font-medium text-slate-700">
          Feria
        </label>
        <select
          id="filtro-feria"
          value={feria}
          onChange={(evento) => router.push(enlace(tipo, evento.target.value))}
          className="h-10 rounded-lg border border-slate-300 bg-superficie px-3 text-sm text-slate-900 shadow-sm focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none"
        >
          <option value="">Todas las ferias</option>
          {ferias.map((opcion) => (
            <option key={opcion.slug} value={opcion.slug}>
              {opcion.nombre}
            </option>
          ))}
          <option value={SIN_FERIA}>Sin feria asignada</option>
        </select>
      </div>

      <nav aria-label="Tipo de cambio" className="flex flex-wrap gap-2">
        <Link href={enlace("", feria)} className={estiloPastilla(!tipo)}>
          Todo
          <span className={cn("text-xs", !tipo ? "text-white/80" : "text-slate-500")}>
            {total}
          </span>
        </Link>
        {pastillas.map((clave) => (
          <Link
            key={clave}
            href={enlace(clave, feria)}
            className={estiloPastilla(tipo === clave)}
          >
            {tipos[clave]}
            <span
              className={cn(
                "text-xs",
                tipo === clave ? "text-white/80" : "text-slate-500",
              )}
            >
              {conteos[clave] ?? 0}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
