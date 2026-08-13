"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

export interface PestaniaFeriante {
  href: string;
  texto: string;
}

/** Pestañas del panel del feriante. */
export function NavegacionFeriante({
  pestanias,
}: {
  pestanias: PestaniaFeriante[];
}) {
  const ruta = usePathname();

  return (
    <nav aria-label="Secciones de mi stand" className="-mb-px flex gap-1 overflow-x-auto">
      {pestanias.map((pestania) => {
        const activa =
          pestania.href === "/mi-stand"
            ? ruta === "/mi-stand"
            : ruta.startsWith(pestania.href);

        return (
          <Link
            key={pestania.href}
            href={pestania.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              activa
                ? "border-municipal-500 text-municipal-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            )}
          >
            {pestania.texto}
          </Link>
        );
      })}
    </nav>
  );
}
