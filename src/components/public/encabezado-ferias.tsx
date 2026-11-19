import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Ruta } from "@/components/public/hero-ruta";
import { Badge } from "@/components/ui/badge";
import {
  COLOR_CATEGORIA,
  ICONOS_CATEGORIA,
} from "@/components/ui/iconos-por-clave";
import { cn } from "@/lib/cn";
import { CATEGORIAS_FERIA } from "@/lib/labels";
import type { CategoriaFeria } from "@prisma/client";

const KIT = "/ferias-hero";

/**
 * El encabezado de `/ferias`, en la estética de la portada: el mismo fondo de
 * feria con un velo claro, el título en la letra redonda, la ruta con sus
 * pines y Migue con un mapa de la ciudad. Abajo, adentro de la misma banda,
 * los filtros por categoría.
 *
 * Migue cambia de caja según el ancho. En el celular y la tablet se para en el
 * bloque del texto (`relative`), arriba de los filtros: si bajara hasta el
 * borde de la banda taparía el final de la fila de filtros, que ahí se desliza
 * de costado. Desde `lg` ese bloque pasa a `static` y Migue se apoya en el
 * borde de abajo de la banda, a la derecha, donde los filtros no llegan.
 *
 * Por eso el bloque tiene un alto mínimo un poco mayor que Migue en cada
 * ancho (`min-h-46` para `h-44`, `sm:min-h-58` para `sm:h-56`, y desde `lg`
 * los 15rem del bloque más los filtros para `lg:h-72`). El alto del texto no
 * alcanza: sin el cartel de «en curso» el bloque medía 150 px, Migue 176, y
 * la banda —que recorta lo que sale— le cortaba la cabeza en el celular.
 */
export function EncabezadoFerias({
  categorias,
  activa,
  enCurso,
}: {
  /** Sólo las categorías con alguna feria: un filtro que lleva a una página vacía no sirve. */
  categorias: CategoriaFeria[];
  activa?: CategoriaFeria;
  enCurso: number;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#ddecf6] dark:bg-[#07152f]">
      <div className="absolute inset-0 -z-20" aria-hidden="true">
        <Image
          src={`${KIT}/fondo-feria-claro.webp`}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_62%] transition-opacity duration-300 dark:opacity-0"
        />
        <Image
          src={`${KIT}/fondo-feria-oscuro.webp`}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_62%] opacity-0 transition-opacity duration-300 dark:opacity-100"
        />
      </div>
      {/*
        El velo: parejo en el celular, donde el texto ocupa todo el ancho, y de
        izquierda a derecha desde `lg`, para que la feria se vea del lado de
        Migue.
      */}
      <div
        className="absolute inset-0 -z-10 bg-[#f1f8ff]/85 lg:bg-transparent lg:bg-gradient-to-r lg:from-[#f4f9ff]/95 lg:via-[#eef6fd]/85 lg:to-[#eef6fd]/70 dark:bg-[#07152f]/85 dark:lg:bg-transparent dark:lg:from-[#07152f]/95 dark:lg:via-[#07152f]/80 dark:lg:to-[#07152f]/70"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Ruta className="absolute top-[24%] right-[15rem] hidden h-24 w-[25rem] xl:block" />

        <div className="relative min-h-46 pt-9 pb-6 sm:min-h-58 sm:pt-12 lg:static lg:min-h-60 lg:pt-14 lg:pb-7">
          <div className="max-w-xl pr-24 sm:pr-40 lg:pr-0">
            <h1 className="relative inline-block font-globo text-[2.1rem] leading-[1.02] font-extrabold tracking-[-0.03em] text-[#081B45] sm:text-5xl dark:text-white">
              Ferias municipales
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${KIT}/acento-destello.svg`}
                alt=""
                aria-hidden="true"
                className="absolute -top-3 -right-8 w-7 sm:-right-10 sm:w-9"
              />
            </h1>
            <p className="mt-3 text-base leading-snug font-semibold text-[#374B70] sm:text-lg dark:text-[#d4e8ff]">
              Elegí una feria y mirá las fechas, el horario y quiénes
              participan.
            </p>
            {enCurso > 0 && (
              <Badge tono="verde" conPunto className="mt-4">
                {enCurso === 1
                  ? "1 feria en curso ahora mismo"
                  : `${enCurso} ferias en curso ahora mismo`}
              </Badge>
            )}
          </div>

          {/* Con un mapa de la ciudad: la página es «dónde y cuándo». */}
          <Image
            src={`${KIT}/migue-mapa.webp`}
            alt=""
            width={312}
            height={760}
            sizes="(max-width: 1024px) 90px, 130px"
            className="pointer-events-none absolute right-0 bottom-0 h-44 w-auto drop-shadow-[0_13px_16px_rgb(10_21_69/0.16)] sm:right-6 sm:h-56 lg:right-12 lg:h-72"
          />
        </div>

        {/*
          Los filtros, en la misma banda. En el celular van en una sola fila
          que se desliza de costado: en tres renglones empujaban la primera
          feria hasta la mitad de la pantalla.
        */}
        <nav
          aria-label="Filtrar por categoría"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-6 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 lg:pb-8 lg:pr-56"
        >
          <Filtro href="/ferias" activo={!activa}>
            Todas
          </Filtro>
          {categorias.map((categoria) => {
            const Icono = ICONOS_CATEGORIA[categoria];
            return (
              <Filtro
                key={categoria}
                href={`/ferias?categoria=${categoria}`}
                activo={activa === categoria}
                icono={
                  <span
                    className={cn(
                      "paleta-original flex size-6 shrink-0 items-center justify-center rounded-full text-white",
                      COLOR_CATEGORIA[categoria],
                    )}
                    aria-hidden="true"
                  >
                    <Icono className="size-3.5" />
                  </span>
                }
              >
                {CATEGORIAS_FERIA[categoria]}
              </Filtro>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

function Filtro({
  href,
  activo,
  icono,
  children,
}: {
  href: string;
  activo: boolean;
  icono?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 text-sm font-semibold whitespace-nowrap shadow-[0_2px_8px_rgb(8_27_69/0.08)] ring-1 transition-colors",
        icono ? "pl-1.5" : "pl-4",
        activo
          ? "paleta-original bg-[#0866F2] text-white ring-[#0866F2]"
          : "bg-superficie/90 text-[#081B45] ring-[#cfe0f0] hover:bg-superficie dark:text-white dark:ring-white/15",
      )}
    >
      {icono}
      {children}
    </Link>
  );
}
