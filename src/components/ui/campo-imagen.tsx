"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";

import { Campo, CampoArchivo } from "@/components/ui/campo";
import { cn } from "@/lib/cn";
import { useVistaPreviaLocal } from "@/lib/vista-previa";

/**
 * Campo de archivo que muestra la imagen elegida antes de guardarla.
 *
 * Sin esto el único rastro de la elección era el nombre del archivo al lado del
 * botón, y arriba seguía la imagen vieja: el feriante no tenía forma de saber
 * si había agarrado la foto que quería hasta después de guardar. Con el recorte
 * encima —la portada es apaisada y el logo cuadrado— tampoco podía anticipar
 * qué parte de la foto iba a sobrevivir.
 *
 * La vista previa es el archivo local, no una subida: no toca el servidor ni
 * deja nada en el bucket si al final no se guarda.
 */
interface PropsCampoImagen {
  name: string;
  etiqueta: string;
  ayuda?: string;
  errores?: string[];
  /** URL pública de la imagen ya guardada, o `null` si todavía no hay. */
  actual: string | null;
  /** Qué decir en el recuadro vacío, ej. «Sin portada». */
  vacio: string;
  /** La portada encabeza el stand y es apaisada; el logo es cuadrado. */
  forma: "apaisada" | "cuadrada";
}

const MARCO = {
  apaisada: "h-32 w-full",
  cuadrada: "size-32",
} as const;

/** Lo que pide `next/image`; es el tamaño del recuadro, no el del archivo. */
const MEDIDAS = {
  apaisada: { width: 320, height: 180 },
  cuadrada: { width: 128, height: 128 },
} as const;

export function CampoImagen({
  name,
  etiqueta,
  ayuda,
  errores,
  actual,
  vacio,
  forma,
}: PropsCampoImagen) {
  const [elegido, setElegido] = useState<File | null>(null);
  const previa = useVistaPreviaLocal(elegido);

  // Guardó: `actual` cambia porque el storage le pone un UUID nuevo a cada
  // archivo. A partir de ahí la previa dejaría de ser «lo que falta guardar» y
  // el cartel mentiría, así que se suelta y manda la imagen del servidor.
  useEffect(() => {
    setElegido(null);
  }, [actual]);

  function alElegir(evento: ChangeEvent<HTMLInputElement>): void {
    setElegido(evento.target.files?.[0] ?? null);
  }

  return (
    <div className="space-y-3">
      <div className={cn("relative", MARCO[forma])}>
        {previa ? (
          <>
            {/* `next/image` no sirve para una URL `blob:`: no hay nada que
                optimizar en el servidor y romper. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previa}
              alt={`Vista previa de ${etiqueta.toLowerCase()}`}
              className="size-full rounded-lg border border-municipal-300 object-cover"
            />
            <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Sin guardar
            </span>
          </>
        ) : actual ? (
          <Image
            src={actual}
            alt={etiqueta}
            {...MEDIDAS[forma]}
            className="size-full rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
            {vacio}
          </div>
        )}
      </div>

      <Campo htmlFor={name} etiqueta={etiqueta} ayuda={ayuda} errores={errores}>
        <CampoArchivo name={name} errores={errores} onChange={alElegir} />
      </Campo>
    </div>
  );
}
