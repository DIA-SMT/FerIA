import Image from "next/image";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/cn";
import { IconoImagen } from "@/components/ui/iconos";
import { urlPublica } from "@/lib/media";

interface PropsImagenPortada {
  /** Ruta en Supabase Storage, ej. `ferias/abc.webp`. */
  src?: string | null;
  alt: string;
  /** Ícono del placeholder cuando todavía no se cargó una imagen. */
  icono?: ComponentType<SVGProps<SVGSVGElement>>;
  /** `sizes` de next/image; ajustalo a la grilla donde se usa. */
  sizes?: string;
  prioridad?: boolean;
  /**
   * `cover` recorta para llenar la caja; `contain` muestra la imagen entera.
   *
   * Para fotos de producto va `contain`. La insignia municipal se compone en una
   * esquina, entre el 3,5 % y el 13,5 % del borde, así que cualquier recorte se
   * la lleva: en una caja 4/3 se pierde 12,5 % arriba y abajo y del logo queda
   * una astilla. Las portadas de feria y de stand sí van recortadas, que para
   * eso son apaisadas.
   */
  ajuste?: "cover" | "contain";
  className?: string;
}

/**
 * Imagen de portada con relleno cuando no hay archivo cargado.
 *
 * Recibe la ruta tal como está guardada en la base y resuelve la URL pública
 * de Supabase Storage internamente, así ningún llamador tiene que saber cómo
 * se arman esas URL.
 *
 * El placeholder usa el degradé institucional en lugar de un gris plano, para
 * que las grillas del market no se vean rotas mientras los feriantes todavía
 * no subieron sus fotos.
 */
export function ImagenPortada({
  src,
  alt,
  icono: Icono = IconoImagen,
  sizes = "(max-width: 768px) 100vw, 33vw",
  prioridad = false,
  ajuste = "cover",
  className,
}: PropsImagenPortada) {
  const url = urlPublica(src);
  const contiene = ajuste === "contain";

  if (!url) {
    return (
      <div
        className={cn(
          "degrade-institucional relative flex items-center justify-center overflow-hidden",
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <div className="trama-puntos absolute inset-0" aria-hidden="true" />
        <Icono className="relative size-10 text-white/70" />
      </div>
    );
  }

  return (
    // El fondo se decide acá y no por `className`: `cn` no resuelve conflictos
    // entre utilidades, así que un `bg-*` que llegue por props no gana seguro.
    // Con `contain` va blanco, que es el fondo que compone el procesador de
    // fotos: si la imagen no fuera cuadrada, la banda no se ve.
    <div
      className={cn(
        "relative overflow-hidden",
        contiene ? "bg-white" : "bg-slate-100",
        className,
      )}
    >
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={prioridad}
        className={contiene ? "object-contain" : "object-cover"}
      />
    </div>
  );
}
