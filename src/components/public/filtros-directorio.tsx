"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Boton } from "@/components/ui/boton";
import { IconoBuscar, IconoCerrar } from "@/components/ui/iconos";
import { aOpciones, RUBROS } from "@/lib/labels";

interface PropsFiltros {
  valores: { q: string; rubro: string; feria: string };
  ferias: Array<{ slug: string; nombre: string }>;
}

/**
 * Filtros del directorio de stands.
 *
 * Los valores actuales llegan por props desde el servidor (que ya leyó los
 * `searchParams`), así que no hace falta `useSearchParams` ni un límite de
 * Suspense. Los `select` navegan al cambiar; la búsqueda, al enviar el
 * formulario.
 */
export function FiltrosDirectorio({ valores, ferias }: PropsFiltros) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState(valores.q);

  // Si el usuario vuelve con el botón "atrás", el input debe reflejar la URL.
  useEffect(() => {
    setBusqueda(valores.q);
  }, [valores.q]);

  function navegar(cambios: Partial<typeof valores>): void {
    const proximos = { ...valores, ...cambios };
    const params = new URLSearchParams();
    if (proximos.q) params.set("q", proximos.q);
    if (proximos.rubro) params.set("rubro", proximos.rubro);
    if (proximos.feria) params.set("feria", proximos.feria);

    const consulta = params.toString();
    router.push(consulta ? `/stands?${consulta}` : "/stands");
  }

  function alBuscar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    navegar({ q: busqueda.trim() });
  }

  const hayFiltros = Boolean(valores.q || valores.rubro || valores.feria);

  const estiloSelect =
    "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm " +
    "focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none sm:w-auto";

  return (
    <form onSubmit={alBuscar} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por emprendimiento o producto…"
            aria-label="Buscar stands"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none"
          />
        </div>

        <select
          value={valores.rubro}
          onChange={(evento) => navegar({ rubro: evento.target.value })}
          aria-label="Filtrar por rubro"
          className={estiloSelect}
        >
          <option value="">Todos los rubros</option>
          {aOpciones(RUBROS).map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>

        <select
          value={valores.feria}
          onChange={(evento) => navegar({ feria: evento.target.value })}
          aria-label="Filtrar por feria"
          className={estiloSelect}
        >
          <option value="">Todas las ferias</option>
          {ferias.map((feria) => (
            <option key={feria.slug} value={feria.slug}>
              {feria.nombre}
            </option>
          ))}
        </select>

        <Boton type="submit" tamanio="lg" className="sm:w-auto">
          Buscar
        </Boton>
      </div>

      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setBusqueda("");
            router.push("/stands");
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <IconoCerrar className="size-3.5" />
          Limpiar filtros
        </button>
      )}
    </form>
  );
}
