import Image from "next/image";
import type { ReactNode } from "react";

import { IconoTienda, IconoUsuario } from "@/components/ui/iconos";
import { ICONOS_RUBRO } from "@/components/ui/iconos-por-clave";
import { cn } from "@/lib/cn";

/**
 * Los rubros de abajo de la tarjeta: identidad, no navegación. Quietos, sin
 * enlace y en gris azulado, para no competir con el botón de CiDiTuc. Son
 * rubros reales del catálogo, con sus mismos íconos.
 */
const RUBROS_DE_LA_ESCENA = [
  { texto: "Artesanías", Icono: ICONOS_RUBRO.ARTESANIAS },
  { texto: "Gastronomía", Icono: ICONOS_RUBRO.GASTRONOMIA },
  { texto: "Emprendedores", Icono: IconoTienda },
  { texto: "Productos regionales", Icono: ICONOS_RUBRO.PRODUCTOS_REGIONALES },
];

/**
 * La escena de la pantalla de ingreso: la feria de fondo, Migue presentando la
 * tarjeta y la ola azul de cierre. La tarjeta llega por `children`.
 *
 * Es una página de paso —sólo lleva a CiDiTuc—, pero es lo primero que ve un
 * feriante del municipio, así que recibe como bienvenida y no como un login
 * frío. Lo que no cambia es la jerarquía: el botón de CiDiTuc es lo más visible
 * de la pantalla, y el fondo va lavado casi a blanco para no competirle.
 *
 * Migue va a la **derecha** de la tarjeta, presentándola con la palma abierta.
 * Las poses originales gesticulan todas hacia ese lado; ponerlo a la izquierda
 * obligaría a espejarlo, y eso daría vuelta el logo del buzo. En pantallas
 * angostas sube y se asoma por detrás de la tarjeta, arriba a la derecha.
 *
 * `conMigue` en falso es para el acceso del personal municipal: la misma
 * escena, sin el personaje ni los rubros, que le hablan al feriante.
 */
export function EscenaIngreso({
  children,
  conMigue = true,
}: {
  children: ReactNode;
  conMigue?: boolean;
}) {
  return (
    <div className="relative isolate flex flex-1 flex-col items-center overflow-hidden px-4 pt-6 pb-32 sm:pt-12 xl:pt-14 xl:pb-36">
      {/* El fondo: la misma feria de la portada, desenfocada de origen y
          lavada acá con dos velos, más blanco en el centro, donde va la
          tarjeta. Es decorativo: `alt` vacío y fuera del árbol accesible. */}
      <Image
        src="/ingreso/fondo-feria.webp"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="-z-30 object-cover object-[center_40%]"
      />
      <div aria-hidden="true" className="velo-ingreso absolute inset-0 -z-20" />

      <div className="relative flex w-full max-w-5xl flex-col items-center xl:static xl:flex-row xl:justify-center">
        {conMigue && (
          <Image
            src="/ingreso/migue-presentando.webp"
            alt="Migue, el asistente de las ferias, te muestra por dónde entrar"
            width={1040}
            height={947}
            priority
            sizes="(min-width: 1280px) 520px, 210px"
            className={cn(
              "pointer-events-none h-auto drop-shadow-[0_16px_18px_rgb(5_31_71/0.18)]",
              // Angosto: arriba de la tarjeta, asomado por detrás.
              "relative z-0 order-first -mr-3 -mb-14 ml-auto w-[210px]",
              // Ancho: a la derecha, saliendo de la ola.
              "xl:absolute xl:right-[max(8px,calc(50%-630px))] xl:bottom-0 xl:z-20 xl:m-0 xl:w-[520px]",
            )}
          />
        )}

        <div
          className={cn(
            "relative z-10 w-full max-w-[500px]",
            conMigue && "xl:mr-[260px]",
          )}
        >
          {children}
        </div>
      </div>

      {conMigue && (
        <ul
          aria-hidden="true"
          className="mt-7 flex w-full max-w-[500px] justify-center xl:mr-[260px]"
        >
          {RUBROS_DE_LA_ESCENA.map(({ texto, Icono }) => (
            <li
              key={texto}
              className="flex flex-1 flex-col items-center gap-1.5 px-2 text-center text-xs font-semibold text-municipal-950 sm:text-[13px] border-l border-municipal-950/10 first:border-l-0"
            >
              <Icono className="size-6 text-municipal-600" />
              {texto}
            </li>
          ))}
        </ul>
      )}

      {/* La ola de cierre. Va por encima de Migue: le tapa el corte de abajo,
          así sale de la ola en vez de flotar. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-24 w-full sm:h-28"
      >
        <defs>
          <linearGradient id="ola-ingreso" x1="0" x2="1">
            <stop offset="0" stopColor="#0567f2" />
            <stop offset="1" stopColor="#33adff" />
          </linearGradient>
        </defs>
        <path
          d="M0 70 C 260 20, 520 20, 760 58 C 1000 96, 1220 92, 1440 40 L1440 120 L0 120 Z"
          fill="url(#ola-ingreso)"
          opacity="0.18"
        />
        <path
          d="M0 92 C 300 50, 600 58, 860 84 C 1080 106, 1280 100, 1440 72 L1440 120 L0 120 Z"
          fill="url(#ola-ingreso)"
        />
      </svg>
    </div>
  );
}

/**
 * La tarjeta blanca de la escena, con el ícono que asoma arriba. El contenido
 * —título, botón, formulario— lo pone la página.
 */
export function TarjetaIngreso({ children }: { children: ReactNode }) {
  return (
    <section className="relative rounded-[28px] bg-superficie/95 px-5 pt-14 pb-6 text-center shadow-[0_24px_60px_rgb(5_31_71/0.16),0_2px_6px_rgb(5_31_71/0.06)] sm:px-10 sm:pt-16 sm:pb-8">
      <span
        aria-hidden="true"
        className="absolute -top-9 left-1/2 flex size-[72px] -translate-x-1/2 items-center justify-center rounded-[22px] bg-superficie text-municipal-500 shadow-[0_10px_24px_rgb(5_31_71/0.12)]"
      >
        <IconoUsuario className="size-9" />
      </span>
      {children}
    </section>
  );
}
