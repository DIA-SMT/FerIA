"use client";

import type { FormEvent, ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  estilosBoton,
  type TamanioBoton,
  type VarianteBoton,
} from "@/components/ui/boton";

interface PropsBotonConfirmar {
  /** Server Action simple (recibe el FormData y no devuelve estado). */
  accion: (datos: FormData) => Promise<void>;
  /** Campos ocultos que necesita la acción. */
  campos: Record<string, string>;
  /** Texto del `window.confirm`. Si se omite, no pide confirmación. */
  confirmacion?: string;
  variante?: VarianteBoton;
  tamanio?: TamanioBoton;
  className?: string;
  children: ReactNode;
}

/**
 * Botón que dispara una Server Action pidiendo confirmación antes.
 *
 * Se usa para las acciones destructivas (eliminar una feria, liberar un
 * stand). Sin JavaScript el formulario se envía igual: la confirmación es una
 * red de seguridad, no la única barrera — la acción vuelve a verificar el rol.
 */
export function BotonConfirmar({
  accion,
  campos,
  confirmacion,
  variante = "peligro",
  tamanio = "sm",
  className,
  children,
}: PropsBotonConfirmar) {
  function alEnviar(evento: FormEvent<HTMLFormElement>): void {
    if (confirmacion && !window.confirm(confirmacion)) {
      evento.preventDefault();
    }
  }

  return (
    <form action={accion} onSubmit={alEnviar}>
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      <button
        type="submit"
        className={cn(estilosBoton(variante, tamanio), className)}
      >
        {children}
      </button>
    </form>
  );
}
