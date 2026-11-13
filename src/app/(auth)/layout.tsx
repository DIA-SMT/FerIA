import Link from "next/link";
import type { ReactNode } from "react";

import { AsistenteBurbuja } from "@/components/public/asistente-burbuja";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { LogoMunicipal } from "@/components/ui/logo-municipal";
import { hayIAConfigurada } from "@/lib/ai";

export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <LogoMunicipal />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
          >
            <IconoFlechaIzquierda className="size-4" />
            <span className="hidden sm:inline">Volver al</span> inicio
          </Link>
        </div>
      </header>

      {/* Abajo deja lugar para la burbuja de Migue: sin eso, al final de la
          página tapa el botón de enviar de la encuesta. */}
      <main className="flex flex-1 items-start justify-center px-4 pt-10 pb-24 sm:pt-16">
        {children}
      </main>

      <div className="flex h-1.5" aria-hidden="true">
        <div className="flex-1 bg-municipal-500" />
        <div className="flex-1 bg-celeste-400" />
        <div className="w-16 bg-acento-400" />
      </div>

      {/* Quien está entrando o pidiendo el alta es quien más dudas tiene. */}
      {hayIAConfigurada() && <AsistenteBurbuja />}
    </div>
  );
}
