import Link from "next/link";

import { BotonLink } from "@/components/ui/boton";
import { LogoMunicipal } from "@/components/ui/logo-municipal";

export default function NoEncontrado() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <LogoMunicipal />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <p className="text-6xl font-bold text-municipal-500">404</p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            No encontramos esta página
          </h1>
          <p className="mt-3 text-slate-600">
            Puede que el enlace esté desactualizado o que la feria o el stand
            que buscabas ya no esté publicado.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <BotonLink href="/">Ir al inicio</BotonLink>
            <BotonLink href="/ferias" variante="contorno">
              Ver las ferias
            </BotonLink>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            También podés{" "}
            <Link
              href="/stands"
              className="font-medium text-municipal-600 hover:text-municipal-700"
            >
              explorar el directorio de stands
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
