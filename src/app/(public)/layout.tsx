import type { ReactNode } from "react";

import { AsistenteBurbuja } from "@/components/public/asistente-burbuja";
import { EncabezadoPublico } from "@/components/public/encabezado-publico";
import { PiePublico } from "@/components/public/pie-publico";
import { hayIAConfigurada } from "@/lib/ai";

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

      {/* Sin OPENROUTER_API_KEY la burbuja se montaba igual en todas las
          páginas públicas y le contestaba un error genérico a cada vecino que
          la abría. Esto es un Server Component, así que la decisión se toma
          acá y el componente del asistente ni siquiera llega al navegador. */}
      {hayIAConfigurada() && <AsistenteBurbuja />}
    </div>
  );
}
