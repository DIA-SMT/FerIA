import Link from "next/link";
import type { ReactNode } from "react";

import { IconoChevronDerecha } from "@/components/ui/iconos";

interface Miga {
  href?: string;
  texto: string;
}

interface PropsEncabezado {
  titulo: string;
  descripcion?: ReactNode;
  migas?: Miga[];
  acciones?: ReactNode;
}

/** Encabezado estándar de las pantallas del panel municipal. */
export function EncabezadoPagina({
  titulo,
  descripcion,
  migas,
  acciones,
}: PropsEncabezado) {
  return (
    <header className="mb-6">
      {migas && migas.length > 0 && (
        <nav aria-label="Migas de pan" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
            {migas.map((miga, indice) => (
              <li key={`${miga.texto}-${indice}`} className="flex items-center gap-1">
                {indice > 0 && (
                  <IconoChevronDerecha
                    className="size-3.5 text-slate-300"
                    aria-hidden="true"
                  />
                )}
                {miga.href ? (
                  <Link
                    href={miga.href}
                    className="transition-colors hover:text-municipal-700"
                  >
                    {miga.texto}
                  </Link>
                ) : (
                  <span className="text-slate-700">{miga.texto}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {titulo}
          </h1>
          {descripcion && (
            <div className="mt-1 text-sm text-slate-600">{descripcion}</div>
          )}
        </div>
        {acciones && (
          <div className="flex flex-wrap items-center gap-2">{acciones}</div>
        )}
      </div>
    </header>
  );
}
