"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { IconoCerrar } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

/**
 * Ventana modal controlada desde afuera, con `abierto` y `onCerrar`.
 *
 * Es el mismo `<dialog>` nativo con `showModal()` que usan los términos (ver
 * `dialogo-terminos.tsx`), así que trae lo mismo de fábrica: Esc lo cierra, el
 * foco entra al abrirse y vuelve al botón que lo abrió, y el fondo queda inerte.
 * Click en el telón también cierra.
 *
 * El estado vive en quien lo usa y no acá: así el que lo abre puede cerrarlo
 * cuando le conviene —por ejemplo, cuando el formulario de adentro guardó bien—.
 * Esc y el telón avisan por `onCerrar`, para que ese estado no quede mintiendo.
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  className,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  className?: string;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  /*
    Esc cierra el diálogo por su cuenta, sin pasar por `onCerrar`, y el estado
    de afuera quedaba diciendo «abierto»: el botón ya no lo volvía a abrir,
    porque pedía lo mismo que creía tener. El `onClose` de React no llega en
    este caso —probado—, así que se escucha el evento nativo. La referencia a
    `onCerrar` va en un ref para no volver a enganchar el escucha cada vez que
    quien lo usa se vuelve a dibujar.
  */
  const alCerrar = useRef(onCerrar);
  useEffect(() => {
    alCerrar.current = onCerrar;
  });
  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    const avisar = () => alCerrar.current();
    dialogo.addEventListener("close", avisar);
    return () => dialogo.removeEventListener("close", avisar);
  }, []);

  return (
    <dialog
      ref={referencia}
      aria-labelledby={idTitulo}
      onClick={(evento) => {
        if (evento.target === referencia.current) onCerrar();
      }}
      className={cn(
        "dialogo-modal m-auto w-[min(100%-2rem,36rem)] rounded-2xl border border-slate-200 bg-superficie p-0 shadow-xl backdrop:bg-black/50",
        className,
      )}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id={idTitulo}
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              {titulo}
            </h2>
            {descripcion && (
              <p className="mt-0.5 text-sm text-slate-600">{descripcion}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <IconoCerrar className="size-4" />
          </button>
        </header>

        {/* Sólo se monta abierto: así cada vez arranca con los valores
            guardados y no con lo que quedó escrito la vez anterior. */}
        {abierto && (
          <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {children}
          </div>
        )}
      </div>
    </dialog>
  );
}
