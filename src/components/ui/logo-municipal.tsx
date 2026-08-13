import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";

interface PropsLogo {
  /** `claro` para fondos oscuros (texto blanco), `oscuro` para fondos claros. */
  tono?: "claro" | "oscuro";
  tamanio?: "sm" | "md";
  /** Envuelve el logo en un enlace al inicio del market. */
  comoEnlace?: boolean;
  className?: string;
}

/** Isologo municipal + denominación de la plataforma. */
export function LogoMunicipal({
  tono = "oscuro",
  tamanio = "md",
  comoEnlace = true,
  className,
}: PropsLogo) {
  const px = tamanio === "sm" ? 32 : 40;

  const contenido = (
    <>
      <Image
        src="/logo.png"
        alt="Isologo de la Municipalidad de San Miguel de Tucumán"
        width={px}
        height={px}
        priority
        className="shrink-0"
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "truncate font-semibold",
            tamanio === "sm" ? "text-[13px]" : "text-sm",
            tono === "claro" ? "text-white" : "text-slate-900",
          )}
        >
          San Miguel de Tucumán
        </span>
        <span
          className={cn(
            "truncate",
            tamanio === "sm" ? "text-[11px]" : "text-xs",
            tono === "claro" ? "text-white/80" : "text-slate-500",
          )}
        >
          Ferias Municipales
        </span>
      </span>
    </>
  );

  const clases = cn("flex items-center gap-2.5", className);

  if (!comoEnlace) {
    return <div className={clases}>{contenido}</div>;
  }

  return (
    <Link
      href="/"
      className={cn(clases, "rounded-md transition-opacity hover:opacity-85")}
      aria-label="Ferias Municipales de San Miguel de Tucumán — Ir al inicio"
    >
      {contenido}
    </Link>
  );
}
