import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type VarianteBoton =
  | "primario"
  | "secundario"
  | "contorno"
  | "fantasma"
  | "acento"
  | "peligro";

export type TamanioBoton = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60";

const VARIANTES: Record<VarianteBoton, string> = {
  // Azul institucional con texto blanco: 4.9:1 de contraste.
  primario:
    "bg-municipal-500 text-white shadow-sm hover:bg-municipal-600 active:bg-municipal-700 focus-visible:outline-municipal-600",
  // El celeste va como fondo claro con texto oscuro; en saturado no contrasta.
  secundario:
    "bg-celeste-100 text-celeste-900 hover:bg-celeste-200 active:bg-celeste-300 focus-visible:outline-celeste-600",
  contorno:
    "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-municipal-600",
  fantasma:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-municipal-600",
  // Amarillo siempre con texto oscuro: 12:1 de contraste.
  acento:
    "bg-acento-400 text-slate-900 shadow-sm hover:bg-acento-300 active:bg-acento-500 focus-visible:outline-acento-700",
  peligro:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-700",
};

const TAMANIOS: Record<TamanioBoton, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function estilosBoton(
  variante: VarianteBoton = "primario",
  tamanio: TamanioBoton = "md",
  ancho = false,
): string {
  return cn(BASE, VARIANTES[variante], TAMANIOS[tamanio], ancho && "w-full");
}

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamanio?: TamanioBoton;
  ancho?: boolean;
  children: ReactNode;
}

export function Boton({
  variante = "primario",
  tamanio = "md",
  ancho = false,
  className,
  children,
  ...props
}: PropsBoton) {
  return (
    <button
      className={cn(estilosBoton(variante, tamanio, ancho), className)}
      {...props}
    >
      {children}
    </button>
  );
}

interface PropsBotonLink
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variante?: VarianteBoton;
  tamanio?: TamanioBoton;
  ancho?: boolean;
  /** `true` para enlaces externos (abre en pestaña nueva con rel seguro). */
  externo?: boolean;
  children: ReactNode;
}

export function BotonLink({
  href,
  variante = "primario",
  tamanio = "md",
  ancho = false,
  externo = false,
  className,
  children,
  ...props
}: PropsBotonLink) {
  const clases = cn(estilosBoton(variante, tamanio, ancho), className);

  if (externo) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={clases}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={clases} {...props}>
      {children}
    </Link>
  );
}
