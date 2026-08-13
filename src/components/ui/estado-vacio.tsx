import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/cn";
import { IconoBandeja } from "@/components/ui/iconos";

interface PropsEstadoVacio {
  icono?: ComponentType<SVGProps<SVGSVGElement>>;
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
  className?: string;
}

/** Placeholder para listados sin resultados. */
export function EstadoVacio({
  icono: Icono = IconoBandeja,
  titulo,
  descripcion,
  accion,
  className,
}: PropsEstadoVacio) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
        <Icono className="size-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{titulo}</p>
      {descripcion && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{descripcion}</p>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
