import Image from "next/image";
import Link from "next/link";

import { PreguntasDeEjemplo } from "@/components/public/preguntas-de-ejemplo";
import { IconoChevronDerecha } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { formatearNumero } from "@/lib/format";
import { RUBROS } from "@/lib/labels";
import type { Rubro } from "@prisma/client";

/**
 * El color de la tarjeta de cada rubro: fondo pastel, borde un poco más fuerte
 * y letra oscura, de la misma familia.
 *
 * Cada rubro tiene el tono de su degradé de portada (`DEGRADES_RUBRO`), para
 * que Gastronomía sea naranja acá y en el directorio. De noche se dan vuelta
 * solas, como todo el sitio: por eso estas familias están en
 * `scripts/generar-tema-oscuro.mjs`. Una familia nueva acá tiene que ir
 * también allá, o de noche queda una tarjeta pastel con letra clara.
 *
 * De noche el fondo va más transparente (`dark:…/55`): el espejo de un pastel
 * es un color oscuro pero muy saturado, y cuatro juntos gritaban sobre el azul
 * noche del resto de la página.
 *
 * Las clases van enteras, sin armarlas con la familia: Tailwind sólo genera
 * las que encuentra escritas en el código.
 */
const TONOS_RUBRO: Record<Rubro, string> = {
  GASTRONOMIA:
    "border-orange-200 bg-orange-50 text-orange-900 dark:bg-orange-50/55",
  ARTESANIAS: "border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-50/55",
  PRODUCTOS_REGIONALES:
    "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-50/55",
  HUERTA_Y_VIVERO:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-50/55",
  DECORACION: "border-teal-200 bg-teal-50 text-teal-900 dark:bg-teal-50/55",
  JUGUETES:
    "border-celeste-200 bg-celeste-50 text-celeste-900 dark:bg-celeste-50/55",
  LIBROS_Y_ARTE:
    "border-indigo-200 bg-indigo-50 text-indigo-900 dark:bg-indigo-50/55",
  INDUMENTARIA:
    "border-violet-200 bg-violet-50 text-violet-900 dark:bg-violet-50/55",
  JOYERIA_Y_BIJOUTERIE:
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:bg-fuchsia-50/55",
  COSMETICA_NATURAL:
    "border-pink-200 bg-pink-50 text-pink-900 dark:bg-pink-50/55",
  MARROQUINERIA:
    "border-stone-300 bg-stone-100 text-stone-900 dark:bg-stone-100/55",
  OTROS:
    "border-municipal-200 bg-municipal-50 text-municipal-900 dark:bg-municipal-50/55",
};

/** Los stickers se inclinan para un lado y para el otro. */
const GIROS_STICKER = [
  "-rotate-[9deg]",
  "rotate-[7deg]",
  "-rotate-[5deg]",
  "rotate-[9deg]",
];

/**
 * El sticker de cada rubro: `public/inicio/rubro-<rubro>.webp`, con el rubro
 * en minúsculas y con guiones. Son ilustraciones 3D generadas con IA en el
 * estilo de Migue, con borde blanco troquelado. No son emojis a propósito: un
 * emoji se ve distinto en cada teléfono.
 */
function stickerDe(rubro: Rubro): string {
  return `/inicio/rubro-${rubro.toLowerCase().replaceAll("_", "-")}.webp`;
}

/**
 * «Qué vas a encontrar»: los rubros con más emprendimientos, cada uno con su
 * color y su sticker, y al lado la caja para preguntarle a Migue.
 */
export function SeccionRubros({
  rubros,
  conMigue,
}: {
  rubros: Array<{ rubro: Rubro; _count: number }>;
  /**
   * Migue sólo si la IA está configurada. Sin `OPENROUTER_API_KEY` la burbuja
   * del asistente ni se monta —ver el layout público—, así que invitar a
   * hablar con él sería mandar a la gente a un botón que no existe.
   */
  conMigue: boolean;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-3 lg:gap-10">
        <div className="lg:col-span-2">
          <h2 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            Qué vas a encontrar
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ferias-hero/acento-destello.svg"
              alt=""
              aria-hidden="true"
              className="w-8"
            />
          </h2>
          <p className="mt-1 text-slate-600">
            Productos locales, frescos y con identidad tucumana.
          </p>

          {/*
            El sticker asoma por arriba de cada tarjeta. Por eso el separador
            vertical es más grande que el horizontal: el sticker de abajo no
            puede pisar la tarjeta de arriba.
          */}
          <div className="mt-10 grid gap-x-5 gap-y-8 sm:grid-cols-2">
            {rubros.map((fila, indice) => (
              <Link
                key={fila.rubro}
                href={`/stands?rubro=${fila.rubro}`}
                className={cn(
                  "group relative flex min-h-26 items-center gap-3 rounded-[1.25rem] border-[1.5px] py-4 pr-4 pl-30 shadow-[0_6px_18px_rgb(15_23_42/0.06)] transition-all hover:-translate-y-0.5 hover:shadow-md sm:pl-33",
                  TONOS_RUBRO[fila.rubro],
                )}
              >
                {/* `alt` vacío: el rubro va escrito al lado. */}
                <Image
                  src={stickerDe(fila.rubro)}
                  alt=""
                  width={240}
                  height={240}
                  sizes="110px"
                  className={cn(
                    "pointer-events-none absolute -top-5 left-3 size-24 object-contain drop-shadow-[0_8px_10px_rgb(15_23_42/0.18)] transition-transform duration-200 group-hover:scale-105 group-hover:rotate-0 sm:left-3.5 sm:size-27.5",
                    GIROS_STICKER[indice % GIROS_STICKER.length],
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-snug font-bold">
                    {RUBROS[fila.rubro]}
                  </span>
                  <span className="mt-0.5 block text-sm font-medium opacity-80">
                    {formatearNumero(fila._count)}{" "}
                    {fila._count === 1 ? "emprendimiento" : "emprendimientos"}
                  </span>
                </span>
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie shadow-[0_2px_6px_rgb(15_23_42/0.08)]"
                  aria-hidden="true"
                >
                  <IconoChevronDerecha className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        {conMigue && (
          <aside className="relative mt-12 min-h-76 overflow-hidden rounded-3xl border-[1.5px] border-municipal-100 bg-municipal-50 px-6 pt-7 pb-8 lg:mt-0">
            <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
              ¿Buscás algo en particular?
            </h3>
            <p className="mt-2 max-w-60 text-[0.95rem] leading-relaxed text-slate-700">
              Preguntale a Migue y te dice en qué feria y en qué stand lo
              conseguís.
            </p>
            <PreguntasDeEjemplo />
            {/* Pensando, con la mano en el mentón, asomado por la derecha. */}
            <Image
              src="/inicio/migue-pensando.webp"
              alt=""
              width={188}
              height={520}
              sizes="100px"
              className="pointer-events-none absolute -right-1 -bottom-2 h-56 w-auto sm:right-2 lg:h-64"
            />
          </aside>
        )}
      </div>
    </section>
  );
}
