import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PropsTarjeta {
  className?: string;
  children: ReactNode;
}

export function Tarjeta({ className, children }: PropsTarjeta) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TarjetaEncabezado({
  titulo,
  descripcion,
  accion,
  className,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        {descripcion && (
          <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>
        )}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}

export function TarjetaCuerpo({ className, children }: PropsTarjeta) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function TarjetaPie({ className, children }: PropsTarjeta) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
