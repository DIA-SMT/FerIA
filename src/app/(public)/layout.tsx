import type { ReactNode } from "react";

import { EncabezadoPublico } from "@/components/public/encabezado-publico";
import { PiePublico } from "@/components/public/pie-publico";

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-municipal-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>

      <EncabezadoPublico />

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <PiePublico />
    </div>
  );
}
