import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  IconoAlerta,
  IconoInfo,
  IconoTildeCirculo,
} from "@/components/ui/iconos";

export type TipoAlerta = "info" | "exito" | "advertencia" | "error";

const ESTILOS: Record<TipoAlerta, string> = {
  info: "border-municipal-200 bg-municipal-50 text-municipal-900",
  exito: "border-emerald-200 bg-emerald-50 text-emerald-900",
  advertencia: "border-acento-300 bg-acento-50 text-acento-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

const COLOR_ICONO: Record<TipoAlerta, string> = {
  info: "text-municipal-600",
  exito: "text-emerald-600",
  advertencia: "text-acento-700",
  error: "text-red-600",
};

const ICONOS: Record<TipoAlerta, typeof IconoInfo> = {
  info: IconoInfo,
  exito: IconoTildeCirculo,
  advertencia: IconoAlerta,
  error: IconoAlerta,
};

interface PropsAlerta {
  tipo?: TipoAlerta;
  titulo?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Alerta({
  tipo = "info",
  titulo,
  className,
  children,
}: PropsAlerta) {
  const Icono = ICONOS[tipo];

  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        ESTILOS[tipo],
        className,
      )}
    >
      <Icono className={cn("mt-0.5 size-5 shrink-0", COLOR_ICONO[tipo])} />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && (
          <div className={cn(Boolean(titulo) && "mt-1")}>{children}</div>
        )}
      </div>
    </div>
  );
}
