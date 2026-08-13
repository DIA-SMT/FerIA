import type { ReactNode, ThHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Tabla del panel municipal.
 *
 * `Tabla` incluye el contenedor con scroll horizontal: en el celular las
 * tablas densas se desplazan en lugar de romper el ancho de la página.
 */
export function Tabla({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <table className={cn("min-w-full text-sm", className)}>{children}</table>
      </div>
    </div>
  );
}

export function TablaCabecera({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 text-left">
      {children}
    </thead>
  );
}

export function TablaCuerpo({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TablaFila({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr className={cn("transition-colors hover:bg-slate-50/70", className)}>
      {children}
    </tr>
  );
}

/** `children` es opcional: la columna de acciones suele ir sin encabezado visible. */
type PropsTh = ThHTMLAttributes<HTMLTableCellElement>;

export function Th({ className, children, ...props }: PropsTh) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-600 uppercase whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <td className={cn("px-4 py-3 align-middle text-slate-700", className)}>
      {children}
    </td>
  );
}
