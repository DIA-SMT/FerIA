"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";

import {
  IconoAlerta,
  IconoCerrar,
  IconoTildeCirculo,
} from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import type { EstadoFormulario } from "@/lib/form";

/**
 * El resultado de guardar, a la vista aunque el botón haya quedado lejos.
 *
 * Los formularios largos —el perfil, un producto, una feria— tienen el botón al
 * final, y el cartel con el resultado vivía arriba de todo: después de tocar
 * «Guardar cambios» había que scrollear para enterarse de si se había guardado.
 * Ahora el aviso flota arriba de la pantalla, esté donde esté el scroll.
 *
 * Arriba y no abajo porque abajo, en el celular, quedaba encima del botón de
 * guardar y de la burbuja de Migue.
 */

/** Lo que dura a la vista un aviso de que salió bien. */
const DURACION_EXITO_MS = 5000;

/**
 * Un error con campos marcados también se va solo: el detalle queda al lado de
 * cada campo. Uno general se queda hasta cerrarlo, porque es todo lo que hay.
 */
const DURACION_ERROR_CON_CAMPOS_MS = 8000;

type TipoAviso = "exito" | "error";

/**
 * La región siempre está en el DOM, vacía o no: los lectores de pantalla
 * anuncian lo que cambia dentro de una región que ya existía, no una que
 * aparece de golpe con el texto adentro.
 */
function Region({
  children,
  ref,
}: {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4"
    >
      {children}
    </div>
  );
}

function Aviso({
  tipo,
  mensaje,
  onCerrar,
}: {
  tipo: TipoAviso;
  mensaje: string;
  onCerrar: () => void;
}) {
  const Icono = tipo === "exito" ? IconoTildeCirculo : IconoAlerta;

  return (
    <div
      className={cn(
        "animar-aviso pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg",
        tipo === "exito"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900",
      )}
    >
      <Icono
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tipo === "exito" ? "text-emerald-600" : "text-red-600",
        )}
      />
      <p className="min-w-0 flex-1 font-medium">{mensaje}</p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar el aviso"
        className="-m-1.5 rounded-md p-1.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <IconoCerrar className="size-4" />
      </button>
    </div>
  );
}

/**
 * El resultado de un formulario con `useActionState`. Va **dentro** del
 * `<form>`, en lugar del `<Alerta>` de arriba: necesita el formulario para
 * encontrar el primer campo con error.
 *
 * Cada envío trae un objeto de estado nuevo aunque diga lo mismo, así que
 * guardar dos veces seguidas vuelve a mostrar el aviso.
 */
export function AvisoDelEnvio({
  estado,
  soloErrores = false,
}: {
  estado: EstadoFormulario;
  /** Para los formularios que al salir bien redirigen y no tienen nada que decir. */
  soloErrores?: boolean;
}) {
  const region = useRef<HTMLDivElement>(null);

  // El estado que la persona cerró, o que se venció. Se compara por identidad.
  const [cerrado, setCerrado] = useState<EstadoFormulario | null>(null);

  const tipo: TipoAviso = estado.ok ? "exito" : "error";
  const mostrar =
    Boolean(estado.mensaje) &&
    !(soloErrores && estado.ok) &&
    estado !== cerrado;

  useEffect(() => {
    if (!estado.mensaje || (soloErrores && estado.ok)) return;

    const conCampos =
      !estado.ok && Object.keys(estado.errores ?? {}).length > 0;

    // Con errores por campo, la pantalla va al primero: el botón está abajo y
    // lo que hay que corregir, casi siempre, arriba. El foco va sólo con mouse:
    // en el celular abriría el teclado y taparía el campo que se quiere ver.
    if (conCampos) {
      const primero = region.current
        ?.closest("form")
        ?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (primero) {
        const quieto = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        primero.scrollIntoView({
          behavior: quieto ? "auto" : "smooth",
          block: "center",
        });
        if (window.matchMedia("(pointer: fine)").matches) {
          primero.focus({ preventScroll: true });
        }
      }
    }

    const duracion = estado.ok
      ? DURACION_EXITO_MS
      : conCampos
        ? DURACION_ERROR_CON_CAMPOS_MS
        : null;
    if (duracion === null) return;

    const temporizador = setTimeout(() => setCerrado(estado), duracion);
    return () => clearTimeout(temporizador);
  }, [estado, soloErrores]);

  return (
    <Region ref={region}>
      {mostrar && estado.mensaje && (
        <Aviso
          tipo={tipo}
          mensaje={estado.mensaje}
          onCerrar={() => setCerrado(estado)}
        />
      )}
    </Region>
  );
}

/**
 * Un aviso de que algo salió bien, para la página a la que se llegó después de
 * guardar —por ejemplo, el catálogo después de agregar un producto—.
 *
 * Esa página lo monta cuando la URL trae `parametro`, y el aviso lo saca de la
 * URL al mostrarse: si no, recargar o volver atrás lo repetiría.
 */
export function AvisoDeLlegada({
  mensaje,
  parametro,
}: {
  mensaje: string;
  parametro: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(parametro)) {
      url.searchParams.delete(parametro);
      window.history.replaceState(window.history.state, "", url);
    }

    const temporizador = setTimeout(() => setVisible(false), DURACION_EXITO_MS);
    return () => clearTimeout(temporizador);
  }, [parametro]);

  return (
    <Region>
      {visible && (
        <Aviso
          tipo="exito"
          mensaje={mensaje}
          onCerrar={() => setVisible(false)}
        />
      )}
    </Region>
  );
}
