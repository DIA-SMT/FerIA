"use client";

import { IconoLuna, IconoSol } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

/**
 * El botón del sol y la luna.
 *
 * No guarda estado propio: el tema es la clase `dark` de `<html>`, que pone el
 * script del layout antes de pintar. Así el servidor y el cliente dibujan el
 * mismo botón —cuál ícono se ve lo decide el CSS— y no hay un instante con el
 * ícono equivocado mientras hidrata.
 */
export function SelectorTema({ className }: { className?: string }) {
  function alternar(): void {
    const raiz = document.documentElement;
    const oscuro = !raiz.classList.contains("dark");
    raiz.classList.toggle("dark", oscuro);
    raiz.style.colorScheme = oscuro ? "dark" : "light";
    try {
      localStorage.setItem("tema", oscuro ? "oscuro" : "claro");
    } catch {
      // Sin almacenamiento (navegación privada en algunos navegadores): el
      // cambio vale para esta página y nada más.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-municipal-500 focus-visible:outline-none",
        className,
      )}
    >
      <IconoLuna className="size-5 dark:hidden" aria-hidden="true" />
      <IconoSol className="hidden size-5 dark:block" aria-hidden="true" />
      <span className="sr-only dark:hidden">Pasar a tema oscuro</span>
      <span className="sr-only hidden dark:inline">Pasar a tema claro</span>
    </button>
  );
}
