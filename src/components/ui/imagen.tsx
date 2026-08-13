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
  className,
}: PropsImagenPortada) {
  const url = urlPublica(src);

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
    <div className={cn("relative overflow-hidden bg-slate-100", className)}>
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={prioridad}
        className="object-cover"
      />
    </div>
  );
}
