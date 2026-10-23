import Image from "next/image";

import { cn } from "@/lib/cn";
import { iniciales } from "@/lib/format";
import { urlPublica } from "@/lib/media";

interface PropsAvatar {
  nombre: string;
  /** Ruta en Supabase Storage, ej. `vendedores/abc.webp`. */
  imagen?: string | null;
  tamanio?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * El tamaño se elige acá y **no se pisa por `className`**.
 *
 * `cn` no resuelve conflictos entre utilidades de Tailwind: si el llamador
 * manda `size-24`, conviven con el `size-16` de este mapa y gana la que Tailwind
 * emita última en la hoja de estilos, no la del código. La vidriera del stand
 * hacía exactamente eso y funcionaba de casualidad, porque Tailwind ordena por
 * número y 24 > 16. Además dejaba a `next/image` pidiendo 64 px para algo que
 * el CSS estiraba a 112.
 *
 * Por eso existe `xl`: es el tamaño que necesita la vidriera, con su `px`
 * correcto. Si hace falta otro, se agrega acá.
 */
const TAMANIOS = {
  sm: { caja: "size-8 text-xs", px: 32 },
  md: { caja: "size-11 text-sm", px: 44 },
  lg: { caja: "size-16 text-lg", px: 64 },
  // Responsive: 96 px en móvil y 112 desde `sm`. El `px` va al mayor de los dos
  // para que el optimizador nunca sirva una imagen más chica que la mostrada.
  xl: { caja: "size-24 text-2xl sm:size-28", px: 112 },
} as const;

/**
 * Logo del emprendimiento; si no hay, muestra las iniciales.
 *
 * El relleno de las iniciales es blanco con las letras en azul, igual que el
 * cromo de la variante con imagen. Es a propósito: en la tarjeta del stand y en
 * la vidriera el avatar se superpone a la portada, y cuando el feriante todavía
 * no subió foto esa portada es el degradé institucional. Un círculo azul sobre
 * degradé azul se desdibuja; uno blanco recorta contra cualquier fondo.
 */
export function Avatar({
  nombre,
  imagen,
  tamanio = "md",
  className,
}: PropsAvatar) {
  const { caja, px } = TAMANIOS[tamanio];
  const url = urlPublica(imagen);

  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={px}
        height={px}
        className={cn(
          caja,
          "shrink-0 rounded-full border border-slate-200 bg-white object-cover",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        caja,
        "flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-semibold text-municipal-700",
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}
