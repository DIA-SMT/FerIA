"use client";

import type { Rubro } from "@prisma/client";
import { startTransition, useActionState, useState } from "react";

import { redactarDescripcion } from "@/actions/descripcion-ia";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { IconoCerrar } from "@/components/ui/iconos";
import {
  ESTADO_REDACCION_INICIAL,
  MINIMO_PARA_MEJORAR,
} from "@/lib/redaccion";

/**
 * Redacción asistida de la descripción del emprendimiento.
 *
 * Vive **dentro** del formulario del perfil, así que no puede tener su propio
 * `<form>` y despacha por click armando el `FormData` a mano. Los botones son
 * `type="button"` para no enviar el perfil sin querer, y el despacho va dentro
 * de `startTransition` para que el botón se deshabilite mientras espera.
 *
 * La propuesta nunca reemplaza el texto sola: hay que aceptarla. Y si se acepta,
 * queda a mano el texto anterior para volver, porque lo que se pisa es algo que
 * el feriante escribió.
 */
export function AsistenteDeDescripcion({
  valor,
  nombreEmprendimiento,
  rubro,
  onAplicar,
}: {
  /** Lo que hay hoy en el campo. */
  valor: string;
  /** Se mandan al prompt para ambientar el texto. */
  nombreEmprendimiento: string;
  rubro: Rubro;
  onAplicar: (texto: string) => void;
}) {
  const [estado, redactar, redactando] = useActionState(
    redactarDescripcion,
    ESTADO_REDACCION_INICIAL,
  );

  // Texto que había antes de aplicar una sugerencia, para poder volver.
  const [previo, setPrevio] = useState<string | null>(null);

  // Cierra el panel al aceptar o descartar. El estado de `useActionState` no se
  // puede limpiar desde acá, así que sin esta bandera la sugerencia ya usada
  // seguiría en pantalla, invitando a aplicarla de nuevo.
  const [abierto, setAbierto] = useState(false);

  const sugerencia = abierto && !redactando ? estado.sugerencia : undefined;
  const hayTexto = valor.trim().length > 0;
  const vaAMejorar = valor.trim().length >= MINIMO_PARA_MEJORAR;

  function pedir() {
    setAbierto(true);

    const datos = new FormData();
    datos.set("descripcion", valor);
    datos.set("emprendimiento", nombreEmprendimiento);
    datos.set("rubro", rubro);

    startTransition(() => redactar(datos));
  }

  function aplicar() {
    if (!sugerencia) return;
    setPrevio(valor);
    onAplicar(sugerencia);
    setAbierto(false);
  }

  function volver() {
    if (previo === null) return;
    onAplicar(previo);
    setPrevio(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Boton
          type="button"
          variante="contorno"
          tamanio="sm"
          onClick={pedir}
          disabled={redactando}
        >
          {redactando
            ? "Escribiendo…"
            : vaAMejorar
              ? "Mejorar lo que escribí"
              : "Ayudame a escribirla"}
        </Boton>

        {!vaAMejorar && (
          <span className="text-xs text-slate-500">
            {hayTexto
              ? "Te armamos la estructura sin perder lo que ya pusiste."
              : "Te dejamos un borrador con huecos para completar."}
          </span>
        )}
      </div>

      {previo !== null && previo.trim().length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-celeste-200 bg-celeste-50 px-3 py-2">
          <p className="text-xs text-celeste-900">
            Reemplazamos tu texto por el de la IA.
          </p>
          <button
            type="button"
            onClick={volver}
            className="text-xs font-semibold text-celeste-900 underline underline-offset-2 hover:text-municipal-700"
          >
            Volver a lo que tenía
          </button>
        </div>
      )}

      {estado.ok === false && estado.mensaje && (
        <Alerta tipo="error">{estado.mensaje}</Alerta>
      )}

      {sugerencia && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-700">
            {estado.modo === "mejorar"
              ? "Propuesta: lo mismo que escribiste, mejor redactado"
              : "Borrador para completar"}
          </p>

          {estado.modo === "borrador" && (
            <p className="mt-1 text-xs text-slate-500">
              Lo que está entre corchetes lo tenés que reemplazar vos. La IA no
              inventa esos datos a propósito: se publican como tuyos.
            </p>
          )}

          <p className="mt-2 whitespace-pre-line rounded border border-slate-200 bg-white p-3 text-sm text-slate-800">
            {sugerencia}
          </p>

          <p className="mt-1.5 text-xs text-slate-500">
            {sugerencia.length} caracteres
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Boton type="button" tamanio="sm" onClick={aplicar}>
              Usar esta redacción
            </Boton>
            <Boton
              type="button"
              variante="contorno"
              tamanio="sm"
              onClick={pedir}
              disabled={redactando}
            >
              Probar otra
            </Boton>
            <Boton
              type="button"
              variante="fantasma"
              tamanio="sm"
              onClick={() => setAbierto(false)}
              className="text-slate-600"
            >
              <IconoCerrar className="size-3.5" />
              Descartar
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
