import Image from "next/image";
import Link from "next/link";

import { BuscadorHero } from "@/components/public/buscador-hero";
import { cn } from "@/lib/cn";
import { hayPedidos } from "@/lib/marketplace";

/*
  Hero «Ruta de ferias» (idea 3).

  Todo sale del kit que está en `public/ferias-hero/`, con sus mismos nombres:
  los dos fondos, los tres Migue, el globo, los cuatro íconos de las tarjetas,
  los cuatro pines, la ruta, los banderines y el destello. Las posiciones y
  los colores son los del kit (`FeriasHero.module.css` y `posiciones-hero.json`),
  pasados a porcentajes de la caja del hero.

  Cambios respecto de los archivos del kit, y por qué:

  · Los dos fondos no son los del kit. Los del kit eran otra feria —el README
    de Codex lo dice: el fondo de la imagen aprobada no existía suelto, sólo
    pegado con Migue, los textos y los botones en `referencias/captura-
    original-*.jpg`—. Se sacó todo eso de la captura de día con el modelo de
    imágenes (gemini-3-pro-image-preview, por OpenRouter) y la de noche se hizo
    desde esa misma, así día y noche tienen exactamente la misma escena.

  · Los Migue van en WebP: los PNG pesaban 0,7 a 1,1 MB cada uno.
  · `migue-anfitrion` es el espejo del original, y el espejo dejaba el logo de
    la campera al revés. Se dio vuelta sólo el logo, así queda como el real.
  · El globo es el SVG del kit, pero metido en la página en vez de como
    imagen: así el texto se escribe con la tipografía del sitio y lo puede
    leer un lector de pantalla.
*/

const KIT = "/ferias-hero";

/** Los cuatro accesos de abajo, con el ícono y los colores del kit. */
interface Acceso {
  href: string;
  titulo: string;
  icono: string;
  /** Fondo y borde, de día y de noche (`.calendar`, `.location`… del kit). */
  tono: string;
}

function accesos(conTienda: boolean): Acceso[] {
  return [
    {
      href: "/ferias",
      titulo: "Próximas ferias",
      icono: "icon-calendar.svg",
      tono: "bg-[#e7f4ffec] dark:border-[#4aa8fc] dark:bg-[#06428ace]",
    },
    {
      href: "/ferias",
      titulo: "Dónde quedan",
      icono: "icon-location.svg",
      tono: "bg-[#f5e9ffed] dark:border-[#ae75ff] dark:bg-[#543188dc]",
    },
    {
      href: "/stands",
      // Con los pedidos encendidos hay algo para comprar: ahí es «Tienda».
      titulo: conTienda ? "Tienda" : "Emprendedores",
      icono: "icon-users.svg",
      tono: "bg-[#e6ffece9] dark:border-[#4de0b1] dark:bg-[#096e5cde]",
    },
    {
      href: "/registro",
      titulo: "Cómo participar",
      icono: "icon-handshake.svg",
      tono: "bg-[#fff3e6ef] dark:border-[#ffc277] dark:bg-[#68422de0]",
    },
  ];
}

/**
 * Los pines, en porcentajes de la caja de la ruta (`.pinBag`, `.pinLocation`…
 * del kit). Cada uno se corre medio ancho a la izquierda y un 40 % de su alto
 * hacia arriba, para que la punta caiga sobre la línea.
 */
const PINES = [
  { archivo: "pin-bolsa.svg", x: 6, y: 41 },
  { archivo: "pin-ubicacion.svg", x: 34, y: 3 },
  { archivo: "pin-eco.svg", x: 67, y: 39 },
  { archivo: "pin-comida.svg", x: 96, y: 30 },
];

/** La ruta punteada con sus pines. Decorativa. */
function Ruta({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none", className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${KIT}/ruta-punteada.svg`}
        alt=""
        className="absolute inset-0 size-full object-fill"
      />
      {PINES.map((pin, indice) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={pin.archivo}
          src={`${KIT}/${pin.archivo}`}
          alt=""
          className="pin-ruta absolute h-auto w-[10%] -translate-x-1/2 -translate-y-[40%] drop-shadow-[0_5px_4px_rgb(0_26_49/0.33)] max-xl:w-[13%]"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            animationDelay: `${indice * 180}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * «Preguntale a Migue»: `bocadillo-migue.svg` del kit.
 *
 * El mismo dibujo y los mismos colores, con el texto en la tipografía del
 * sitio. Queda blanco también de noche, como en la referencia.
 */
function BocadilloMigue() {
  return (
    <svg
      viewBox="0 0 292 67"
      role="img"
      aria-label="Preguntale a Migue"
      className="mb-1.5 ml-1 w-48 sm:w-56 xl:w-[17.7cqw] -rotate-2 drop-shadow-[0_3px_9px_rgb(5_24_92/0.13)]"
    >
      <path
        d="M24 2H267Q290 2 290 24V35Q290 57 267 57H50L31 66L34 57H24Q2 57 2 35V24Q2 2 24 2Z"
        fill="white"
        stroke="#0D6EFD"
        strokeWidth="2"
      />
      <text
        x="146"
        y="38"
        textAnchor="middle"
        fontSize="25"
        className="font-globo"
        fontWeight="700"
        fill="#0A1740"
      >
        Preguntale a{" "}
        <tspan fontWeight="800" fill="#0866F2">
          Migue
        </tspan>
      </text>
    </svg>
  );
}

/**
 * Portada de la home: «Ruta de ferias».
 *
 * Una feria de fondo, Migue invitando a pasar, y el título, el buscador —que
 * va directo a Migue— y los cuatro accesos, unidos por una ruta con pines.
 *
 * Día y noche son **la misma foto** con otra luz: cambiar de tema no mueve un
 * puesto ni una persona. Las dos están siempre y el tema decide cuál se ve.
 *
 * Un Migue por tamaño de pantalla, los tres del kit:
 *
 *   · Compu (≥ 1280 px): `migue-anfitrion`, grande a la izquierda, mostrando el
 *     contenido con la mano. Es la composición de la referencia.
 *   · Tablet (768–1279 px): `migue-original-palma`, a la derecha, mostrando la
 *     ruta que queda a su izquierda.
 *   · Celular: `migue-cuerpo-completo`, entero y más chico, al costado de la
 *     ruta.
 *
 * En tablet y celular se apila: texto y buscador arriba —nunca debajo de
 * Migue—, después Migue con la ruta, y los accesos de a dos.
 */
export function HeroRuta() {
  const lista = accesos(hayPedidos());

  return (
    // La foto va de borde a borde; la composición —Migue, título, buscador,
    // ruta y accesos— va en una caja centrada con las proporciones de la
    // referencia (1102 × 583), del ancho que haga falta para que entre entera
    // en la primera pantalla: entre 1200 y 1600 px. Más ancha, en una pantalla
    // de 1920, el título pasaba los 100 px.
    <section className="relative isolate overflow-hidden bg-[#ddecf6] dark:bg-[#07152f]">
      <div className="absolute inset-0 -z-30" aria-hidden="true">
        <Image
          src={`${KIT}/fondo-feria-claro.webp`}
          // Vacío a propósito: es ambiente, y el h1 ya dice de qué se trata.
          alt=""
          fill
          priority
          sizes="100vw"
          quality={90}
          className="object-cover object-[55%_center] transition-opacity duration-300 xl:object-center dark:opacity-0"
        />
        <Image
          src={`${KIT}/fondo-feria-oscuro.webp`}
          alt=""
          fill
          sizes="100vw"
          quality={90}
          className="object-cover object-[55%_center] opacity-0 transition-opacity duration-300 xl:object-center dark:opacity-100"
        />
      </div>

      <div className="@container relative mx-auto w-full xl:aspect-[1102/583] xl:min-h-[490px] xl:max-w-[min(100rem,max(75rem,calc((100dvh_-_4rem)_*_1.89)))]">
        <div className="velo-ruta absolute inset-0 -z-20" aria-hidden="true" />

        {/* Banderines arriba. En la compu no van: la foto ya trae los suyos en
            ese lugar; en tablet y celular el recorte de la foto los deja
            afuera, y estos los reponen. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${KIT}/banderines.svg`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -left-[4%] -z-10 w-[75%] -rotate-[5deg] opacity-85 sm:w-[55%] xl:hidden dark:opacity-45"
        />

        {/* Compu: Migue anfitrión, recortado por el borde de abajo. */}
        <Image
          src={`${KIT}/migue-anfitrion.webp`}
          alt="Migue, el asistente de las ferias, invita a recorrerlas"
          width={1256}
          height={1164}
          priority
          sizes="(min-width: 1280px) min(44vw, 704px), 1px"
          quality={90}
          className="pointer-events-none absolute -bottom-[2%] -left-[1%] z-10 h-auto w-[44%] max-w-none drop-shadow-[0_13px_16px_rgb(10_21_69/0.16)] max-xl:hidden"
        />

        {/* Título, bajada y buscador. */}
        <div className="relative z-20 px-4 pt-8 text-center sm:px-8 sm:pt-10 xl:absolute xl:top-[7%] xl:right-[12%] xl:left-[39%] xl:p-0">
          {/*
            «Ferias de la ciudad de San Miguel de Tucumán», a pedido de la
            Dirección (la referencia decía «Recorré las ferias de la ciudad»).

            Entero no entra a un solo tamaño en el ancho del título, así que va
            en dos niveles, como el hero anterior: «Ferias de la ciudad» grande
            y la ciudad más chica y en azul. Por eso la bajada ya no la nombra:
            sería decirlo dos veces. El espacio entre los dos renglones es
            explícito para que el texto del título —el que leen los lectores
            de pantalla y los buscadores— no quede «ciudadde».
          */}
          <h1 className="relative mx-auto inline-block font-globo text-[clamp(1.9rem,7.1vw,2.7rem)] leading-[1.01] font-extrabold tracking-[-0.03em] text-[#081B45] [text-shadow:0_1px_1px_rgb(255_255_255/0.26)] sm:text-5xl xl:text-[5.2cqw] dark:text-white">
            <span className="block">Ferias de la ciudad</span>{" "}
            <span className="mt-[0.12em] block text-[0.6em] leading-tight text-[#0866F2] dark:text-[#8cc2ff]">
              {"de San Miguel de Tucumán"}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${KIT}/acento-destello.svg`}
              alt=""
              aria-hidden="true"
              className="absolute -top-[6%] -right-[11%] w-[9%] min-w-7"
            />
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[clamp(0.95rem,3.3vw,1.2rem)] leading-snug font-bold text-[#374B70] sm:text-xl xl:mt-[1.9%] xl:max-w-none xl:text-[1.55cqw] dark:text-[#d4e8ff]">
            Descubrí productos, productores y ferias barriales.
          </p>

          <div className="mx-auto mt-5 w-full max-w-[590px] text-left xl:mt-[3.5%] xl:w-[82%] xl:max-w-none">
            {/* El globo con su destello a la izquierda, como en la
                referencia. */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${KIT}/acento-destello.svg`}
                alt=""
                aria-hidden="true"
                className="absolute top-0 -left-[5%] w-[6%] min-w-6 -scale-x-100"
              />
              <BocadilloMigue />
            </div>
            <BuscadorHero variante="ruta" />
          </div>
        </div>

        {/* Tablet y celular: la ruta, y Migue a la derecha mostrándola.
            Migue entra entero en esta caja (`h-full`) y no la pasa: el
            texto y el buscador van arriba en el flujo, con su propio
            `z-20`, así que si asomaba por encima de la caja el buscador le
            tapaba la cabeza en el celular. */}
        <div className="relative z-10 mt-2 h-72 sm:h-80 xl:hidden">
          <Ruta className="absolute top-[38%] left-[4%] h-[30%] w-[58%] sm:w-[56%] md:w-[46%]" />
          {/* Tablet */}
          <Image
            src={`${KIT}/migue-original-palma.webp`}
            alt=""
            width={1256}
            height={1164}
            sizes="(min-width: 768px) 360px, 1px"
            className="pointer-events-none absolute right-[2%] bottom-0 hidden h-full w-auto max-w-none drop-shadow-[0_13px_16px_rgb(10_21_69/0.16)] md:block"
          />
          {/* Celular */}
          <Image
            src={`${KIT}/migue-cuerpo-completo.webp`}
            alt=""
            width={743}
            height={1351}
            sizes="(max-width: 767px) 180px, 1px"
            className="pointer-events-none absolute right-[3%] bottom-0 h-full w-auto max-w-none drop-shadow-[0_13px_16px_rgb(10_21_69/0.16)] md:hidden"
          />
        </div>

        {/* Compu: la ruta cruza entre el buscador y los accesos. */}
        <Ruta className="absolute top-[64%] right-[13%] left-[39%] z-10 h-[20%] max-xl:hidden" />

        <nav
          aria-label="Accesos rápidos"
          className="relative z-30 grid grid-cols-2 gap-2 px-3 pb-3 sm:gap-3 sm:px-6 sm:pb-6 xl:absolute xl:bottom-[3%] xl:left-[29.5%] xl:w-[63%] xl:grid-cols-4 xl:gap-[1%] xl:p-0"
        >
          {lista.map(({ href, titulo, icono, tono }) => (
            <Link
              key={titulo}
              href={href}
              className={cn(
                "flex h-[78px] min-w-0 items-center justify-center gap-2 rounded-2xl border-2 border-white/80 px-2 text-center text-sm leading-tight font-extrabold text-[#071b44] shadow-[0_5px_18px_rgb(20_37_61/0.16)] backdrop-blur-[14px] transition-[transform,box-shadow] duration-200 hover:-translate-y-[5px] hover:shadow-[0_10px_25px_rgb(11_29_68/0.5)] focus-visible:outline-4 focus-visible:outline-offset-[3px] focus-visible:outline-[#0d6efd] sm:h-24 sm:flex-col sm:text-base xl:h-[7.6cqw] xl:gap-[4%] xl:text-[1.42cqw] dark:text-[#f7fbff]",
                tono,
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${KIT}/${icono}`}
                alt=""
                aria-hidden="true"
                // De noche se aclaran: los trazos del kit son del mismo tono que el
                // fondo oscuro de su tarjeta y se perdían.
                className="h-8 w-auto shrink-0 sm:h-9 xl:h-[44%] xl:max-w-[56%] dark:brightness-[1.7] dark:saturate-[0.9]"
              />
              <span>{titulo}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
