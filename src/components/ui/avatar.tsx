import Image from "next/image";

import { cn } from "@/lib/cn";
import { iniciales } from "@/lib/format";
import { urlPublica } from "@/lib/media";

interface PropsAvatar {
  nombre: string;
  /** Ruta en Supabase Storage, ej. `vendedores/abc.webp`. */
  imagen?: string | null;
  tamanio?: "sm" | "md" | "lg";
  className?: string;
}

const TAMANIOS = {
  sm: { caja: "size-8 text-xs", px: 32 },
  md: { caja: "size-11 text-sm", px: 44 },
  lg: { caja: "size-16 text-lg", px: 64 },
} as const;

/** Logo del emprendimiento; si no hay, muestra las iniciales sobre el azul institucional. */
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
        "flex shrink-0 items-center justify-center rounded-full bg-municipal-500 font-semibold text-white",
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}
