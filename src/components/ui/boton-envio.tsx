"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  estilosBoton,
  type TamanioBoton,
  type VarianteBoton,
} from "@/components/ui/boton";

interface PropsBotonEnvio {
  variante?: VarianteBoton;
  tamanio?: TamanioBoton;
  ancho?: boolean;
  className?: string;
  /** Texto mientras se envía el formulario. */
  textoEnviando?: string;
  children: ReactNode;
}

/**
 * Botón de envío con estado de carga.
 *
 * Lee `useFormStatus`, así que tiene que estar dentro del `<form>` cuyo
 * envío quiere reflejar (no en el mismo componente que renderiza el form).
 */
export function BotonEnvio({
  variante = "primario",
  tamanio = "md",
  ancho = false,
  className,
  textoEnviando = "Guardando…",
  children,
}: PropsBotonEnvio) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(estilosBoton(variante, tamanio, ancho), className)}
    >
      {pending && (
        <svg
          className="size-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M12 2a10 10 0 0110 10h-3a7 7 0 00-7-7V2z"
          />
        </svg>
      )}
      {pending ? textoEnviando : children}
    </button>
  );
}
