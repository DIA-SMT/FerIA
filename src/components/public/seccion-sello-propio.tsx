import Image from "next/image";
import Link from "next/link";

import {
  TarjetaPropuesta,
  type PropuestaParaTarjeta,
} from "@/components/public/tarjeta-propuesta";
import { IconoChevronDerecha } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { TIPOS_SELLO_PROPIO } from "@/lib/sello-propio";

/**
 * «Modo Feria» en la portada: las últimas propuestas aprobadas, con los dos
 * sellos y los enlaces a sus páginas. Sin propuestas publicadas no se muestra:
 * el menú ya lleva a las páginas, que explican cómo sumarse.
 */
export function SeccionSelloPropio({
  propuestas,
}: {
  propuestas: PropuestaParaTarjeta[];
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex shrink-0" aria-hidden="true">
            {(["REGALO", "SERVICIO"] as const).map((tipo, indice) => (
              <Image
                key={tipo}
                src={TIPOS_SELLO_PROPIO[tipo].sello}
                alt=""
                width={72}
                height={72}
                className={cn(
                  "size-16 drop-shadow-[0_6px_10px_rgb(10_21_69/0.18)] sm:size-18",
                  indice === 0 ? "-rotate-6" : "-ml-5 rotate-6",
                )}
              />
            ))}
          </div>
          <div>
            <Link
              href="/modo-feria"
              className="text-sm font-semibold text-municipal-600 hover:underline"
            >
              Modo Feria
            </Link>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Regalos y servicios con sello propio
            </h2>
            <p className="mt-1 text-slate-600">
              Para empresas e instituciones, hechos por feriantes de la ciudad.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(["REGALO", "SERVICIO"] as const).map((tipo) => (
            <Link
              key={tipo}
              href={TIPOS_SELLO_PROPIO[tipo].href}
              className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
            >
              Ver {TIPOS_SELLO_PROPIO[tipo].corto.toLowerCase()}
              <IconoChevronDerecha className="size-4" />
            </Link>
          ))}
        </div>
      </div>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {propuestas.map((propuesta) => (
          <li key={propuesta.id}>
            <TarjetaPropuesta propuesta={propuesta} />
          </li>
        ))}
      </ul>
    </section>
  );
}
