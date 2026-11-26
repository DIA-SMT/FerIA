"use client";

import type { MouseEvent } from "react";

import { IconoLuna, IconoSol } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

/** Lo que tarda el círculo en cubrir la pantalla. */
const DURACION_MS = 650;

function aplicarTema(oscuro: boolean): void {
  const raiz = document.documentElement;
  raiz.classList.toggle("dark", oscuro);
  raiz.style.colorScheme = oscuro ? "dark" : "light";
  try {
    localStorage.setItem("tema", oscuro ? "oscuro" : "claro");
  } catch {
    // Sin almacenamiento (navegación privada en algunos navegadores): el
    // cambio vale para esta página y nada más.
  }
}

/**
 * El botón del sol y la luna.
 *
 * No guarda estado propio: el tema es la clase `dark` de `<html>`, que pone el
 * script del layout antes de pintar. Así el servidor y el cliente dibujan el
 * mismo botón —cuál ícono se ve lo decide el CSS— y no hay un instante con el
 * ícono equivocado mientras hidrata.
 *
 * El cambio se ve como un círculo que sale del botón y pinta la página con el
 * tema nuevo (View Transitions: el navegador saca una foto de la página como
 * estaba y la va destapando). Donde no hay View Transitions, o si el sistema
 * pide menos movimiento, cambia de golpe.
 */
export function SelectorTema({ className }: { className?: string }) {
  function alternar(evento: MouseEvent<HTMLButtonElement>): void {
    const raiz = document.documentElement;
    const oscuro = !raiz.classList.contains("dark");

    // Mientras cambia, sin las transiciones de color de botones y enlaces: si
    // no, cada uno se acomoda a su ritmo y el cambio se ve desparejo.
    raiz.dataset.cambiandoTema = "";
    const terminar = () => delete raiz.dataset.cambiandoTema;

    const quieto = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (typeof document.startViewTransition !== "function" || quieto) {
      aplicarTema(oscuro);
      // Leer un estilo obliga a pintar los colores nuevos sin transición
      // antes de devolverlas.
      void window.getComputedStyle(raiz).color;
      terminar();
      return;
    }

    // Desde el centro del botón, también si se tocó con el teclado.
    const caja = evento.currentTarget.getBoundingClientRect();
    const x = caja.left + caja.width / 2;
    const y = caja.top + caja.height / 2;
    const radio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transicion = document.startViewTransition(() => aplicarTema(oscuro));
    transicion.ready
      .then(() => {
        raiz.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radio}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: DURACION_MS,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      // Si el navegador la saltea, el tema ya cambió igual.
      .catch(() => {});
    transicion.finished.then(terminar, terminar);
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
