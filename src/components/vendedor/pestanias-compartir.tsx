"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * «Compartir» tiene dos herramientas: la imagen del catálogo, armada con sus
 * fotos tal cual, y la publicitaria, que arma la IA. Se elige arriba; las dos
 * quedan montadas para no perder lo que se eligió al pasar de una a otra.
 */
export function PestaniasCompartir({
  catalogo,
  publicidad,
}: {
  catalogo: ReactNode;
  /** `null` sin IA configurada: ahí no hay pestaña. */
  publicidad: ReactNode | null;
}) {
  const [activa, setActiva] = useState<"catalogo" | "publicidad">("catalogo");

  if (!publicidad) return <>{catalogo}</>;

  const pestanias = [
    { clave: "catalogo" as const, texto: "Catálogo" },
    { clave: "publicidad" as const, texto: "Publicidad con IA ✨" },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Qué imagen armar"
        className="mb-6 inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200"
      >
        {pestanias.map((pestania) => (
          <button
            key={pestania.clave}
            type="button"
            role="tab"
            aria-selected={activa === pestania.clave}
            onClick={() => setActiva(pestania.clave)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              activa === pestania.clave
                ? "bg-superficie text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {pestania.texto}
          </button>
        ))}
      </div>
      <div hidden={activa !== "catalogo"}>{catalogo}</div>
      <div hidden={activa !== "publicidad"}>{publicidad}</div>
    </div>
  );
}
