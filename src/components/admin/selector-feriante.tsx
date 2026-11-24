"use client";

import { useEffect, useRef, useState } from "react";

import type { FerianteElegible } from "@/actions/sello-propio";
import { BORDE_NORMAL, ESTILO_CONTROL } from "@/components/ui/campo";
import { IconoBuscar } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

interface PropsSelectorFeriante {
  /** El `name` del campo oculto que viaja con el formulario. */
  name: string;
  /** El feriante ya elegido, al editar. */
  inicial?: FerianteElegible | null;
  errores?: string[];
  buscar: (texto: string) => Promise<FerianteElegible[]>;
}

/**
 * Elegir un feriante entre las casi mil fichas, escribiendo su nombre.
 *
 * Un `<select>` con mil opciones no se puede usar, así que se busca en el
 * servidor con lo que se va escribiendo —la misma búsqueda de «Feriantes»— y
 * se elige de una lista corta. Lo que viaja con el formulario es sólo el id,
 * en un campo oculto.
 */
export function SelectorFeriante({
  name,
  inicial = null,
  errores,
  buscar,
}: PropsSelectorFeriante) {
  const [elegido, setElegido] = useState<FerianteElegible | null>(inicial);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<FerianteElegible[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const hayError = Boolean(errores && errores.length > 0);

  // Se busca cuando se deja de tipear un momento, y sólo la última consulta
  // cuenta: si llega tarde la respuesta de una anterior, se descarta.
  useEffect(() => {
    const consulta = texto.trim();
    if (consulta.length < 2) {
      setResultados(null);
      setBuscando(false);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const espera = setTimeout(() => {
      buscar(consulta)
        .then((encontrados) => {
          if (vigente) setResultados(encontrados);
        })
        .catch(() => {
          if (vigente) setResultados([]);
        })
        .finally(() => {
          if (vigente) setBuscando(false);
        });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto, buscar]);

  function cambiar() {
    setElegido(null);
    setTexto("");
    setResultados(null);
    // Después de que el campo aparezca.
    requestAnimationFrame(() => entrada.current?.focus());
  }

  return (
    <div>
      <input type="hidden" name={name} value={elegido?.id ?? ""} />

      {elegido ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <Descripcion feriante={elegido} />
          <button
            type="button"
            onClick={cambiar}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-municipal-600 transition-colors hover:bg-superficie hover:text-municipal-700"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <IconoBuscar
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={entrada}
              id={name}
              type="search"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              // Un Enter acá enviaría el formulario a medio cargar.
              onKeyDown={(evento) => {
                if (evento.key === "Enter") evento.preventDefault();
              }}
              placeholder="Buscá por emprendimiento o por quién lo lleva"
              autoComplete="off"
              aria-invalid={hayError || undefined}
              aria-describedby={hayError ? `${name}-error` : `${name}-ayuda`}
              className={cn(
                ESTILO_CONTROL,
                "pl-9",
                hayError
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                  : BORDE_NORMAL,
              )}
            />
          </div>

          {buscando && <p className="mt-2 text-sm text-slate-500">Buscando…</p>}
          {!buscando && resultados?.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">
              No hay feriantes aprobados con ese nombre.
            </p>
          )}
          {!buscando && resultados && resultados.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {resultados.map((feriante) => (
                <li key={feriante.id}>
                  <button
                    type="button"
                    onClick={() => setElegido(feriante)}
                    className="w-full px-3 py-2.5 text-left transition-colors hover:bg-municipal-50 focus-visible:bg-municipal-50 focus-visible:outline-none"
                  >
                    <Descripcion feriante={feriante} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Descripcion({ feriante }: { feriante: FerianteElegible }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-sm font-semibold text-slate-900">
        {feriante.emprendimiento}
      </span>
      <span className="block truncate text-xs text-slate-500">
        {[feriante.responsable, ...feriante.ferias].join(" · ")}
      </span>
    </span>
  );
}
