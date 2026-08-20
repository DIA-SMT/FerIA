"use client";

import { useRef, type ReactNode } from "react";

import { IconoCerrar } from "@/components/ui/iconos";

/**
 * Los términos y condiciones en un diálogo modal, sin página propia.
 *
 * Es un `<dialog>` nativo con `showModal()`, que trae gratis lo que un modal
 * casero suele hacer mal: Esc lo cierra, el foco entra al abrirse y vuelve al
 * disparador al cerrarse, y el fondo queda inerte. Click en el telón también
 * cierra: sobre el telón el objetivo del evento es el propio `<dialog>`, porque
 * todo el interior está cubierto por el envoltorio.
 *
 * El contenido llega por `children` renderizado del lado del servidor: este
 * componente es de cliente sólo por los dos manejadores de click.
 *
 * Hay más de un disparador (el aviso del pie y la línea del copyright), así que
 * el diálogo se identifica por id y `BotonTerminos` lo busca al momento del
 * click. Es la alternativa simple a un contexto para un elemento que existe una
 * sola vez por página, en el pie.
 */

const ID_DIALOGO = "dialogo-terminos";

/** Abre el diálogo. Sólo puede correr en el cliente, dentro de un click. */
function abrirDialogo(): void {
  const dialogo = document.getElementById(ID_DIALOGO);
  if (dialogo instanceof HTMLDialogElement) dialogo.showModal();
}

/** Disparador: un botón con aspecto de enlace, para usar donde haga falta. */
export function BotonTerminos({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={abrirDialogo} className={className}>
      {children}
    </button>
  );
}

export function DialogoTerminos({ children }: { children: ReactNode }) {
  const referencia = useRef<HTMLDialogElement>(null);

  return (
    <dialog
      id={ID_DIALOGO}
      ref={referencia}
      aria-labelledby="titulo-terminos"
      onClick={(evento) => {
        if (evento.target === referencia.current) referencia.current?.close();
      }}
      className="dialogo-modal m-auto w-[min(100%-2rem,44rem)] rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/50"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2
            id="titulo-terminos"
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            Términos y condiciones
          </h2>
          <button
            type="button"
            onClick={() => referencia.current?.close()}
            aria-label="Cerrar los términos y condiciones"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <IconoCerrar className="size-4" />
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-6 pt-4 pb-8">
          {children}
        </div>
      </div>
    </dialog>
  );
}
