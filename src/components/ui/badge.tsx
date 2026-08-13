import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { TonoBadge } from "@/lib/labels";

/**
 * Etiqueta de estado.
 *
 * Todos los tonos usan fondo claro con texto oscuro para mantener el contraste
 * (en particular el celeste y el amarillo, que en saturado no admiten texto blanco).
 */
const TONOS: Record<TonoBadge, string> = {
  azul: "bg-municipal-50 text-municipal-800 ring-municipal-200",
  celeste: "bg-celeste-50 text-celeste-900 ring-celeste-200",
  amarillo: "bg-acento-50 text-acento-900 ring-acento-300",
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rojo: "bg-red-50 text-red-800 ring-red-200",
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
};

const PUNTOS: Record<TonoBadge, string> = {
  azul: "bg-municipal-500",
  celeste: "bg-celeste-500",
  amarillo: "bg-acento-500",
  verde: "bg-emerald-500",
  rojo: "bg-red-500",
  neutro: "bg-slate-400",
};

interface PropsBadge {
  tono?: TonoBadge;
  /** Muestra un punto de color a la izquierda. */
  conPunto?: boolean;
  tamanio?: "sm" | "md";
  className?: string;
  children: ReactNode;
}

export function Badge({
  tono = "neutro",
  conPunto = false,
  tamanio = "md",
  className,
  children,
}: PropsBadge) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap",
        tamanio === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONOS[tono],
        className,
      )}
    >
      {conPunto && (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", PUNTOS[tono])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
