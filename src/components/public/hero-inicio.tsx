import Image from "next/image";
import Link from "next/link";

import {
  IconoBuscar,
  IconoCalendario,
  IconoChevronDerecha,
  IconoFlechaDerecha,
  IconoTienda,
  IconoUbicacion,
  IconoUsuarios,
} from "@/components/ui/iconos";
import { hayPedidos } from "@/lib/marketplace";

/**
 * Los cuatro accesos del pie del hero.
 *
 * Son los mismos destinos que el menú del encabezado, escritos desde lo que la
 * persona viene a hacer y no desde cómo se llama la sección: «Dónde quedan» en
 * vez de «Mapa», porque todavía no hay un mapa y lo que hay —la dirección de
 * cada feria— alcanza para esa pregunta.
 */
function accesos(conTienda: boolean) {
  return [
    {
      href: "/ferias",
      icono: IconoCalendario,
      titulo: "Próximas ferias",
      texto: "Días, horarios y ubicaciones",
      color: "bg-municipal-50 text-municipal-600",
    },
    {
      href: "/ferias",
      icono: IconoUbicacion,
      titulo: "Dónde quedan",
      texto: "La dirección y el mapa de cada feria",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      href: "/stands",
      icono: IconoUsuarios,
      /*
      Esta tarjeta cambia de nombre sola cuando se enciende el marketplace.

      Apagado dice «Productores» y lleva a un directorio: es lo que hay, y lo
      que la persona va a encontrar. Encendido dice «Tienda», porque recién ahí
      hay precios y se puede pedir.

      No dice «Marketplace» en ninguno de los dos casos, y es a propósito: es
      una palabra en inglés en un sitio municipal en castellano, y nombra el
      mecanismo en vez de lo que la persona viene a hacer. Un vecino que busca
      dulce de cayote entiende «Tienda»; «Marketplace» lo entiende quien pensó
      el sistema.
    */
      ...(conTienda
        ? {
            titulo: "Tienda",
            texto: "Comprale directo a quien produce",
          }
        : {
            titulo: "Productores",
            texto: "Quiénes hacen posible las ferias",
          }),
      color: "bg-amber-50 text-amber-600",
    },
    {
      href: "/registro",
      icono: IconoTienda,
      titulo: "Cómo participar",
      texto: "Información para feriantes",
      color: "bg-rose-50 text-rose-600",
    },
  ];
}

/**
 * Portada de la home.
 *
 * Cambió de noche a día, y eso no es un cambio de foto: es dar vuelta todo el
 * esquema. El hero anterior era texto blanco sobre una foto nocturna con un
 * velo oscuro; este es texto oscuro sobre una foto luminosa con un velo claro
 * (`velo-hero-claro` en globals.css). Por eso el acento amarillo del título
 * anterior no sobrevivió: sobre blanco es ilegible. Acá el color lo pone la
 * foto y el título va en azul institucional.
 *
 * Contraste medido componiendo foto + velo y buscando el píxel **más oscuro**
 * de la franja de texto, que es el peor caso para letra oscura. Se reproduce
 * con `node scripts/medir-contraste-hero.mjs`:
 *
 *   «Ferias» (municipal-950)    12,5:1   AAA
 *   «Tucumanas» (municipal-600)  5,1:1   AA
 *   antetítulo (municipal-700)   6,7:1   AA
 *   párrafo (slate-700)          8,0:1   AAA
 *   ayuda del buscador           5,8:1   AA
 *   etiquetas de los números     5,8:1   AA
 *
 * Dos cosas que el medidor corrigió y por eso quedan anotadas: las etiquetas
 * de los contadores empezaron en `slate-500` y daban 3,7:1, que no alcanza
 * para texto chico; y «Tucumanas» empezó en `municipal-500`, que daba 3,8:1 —
 * suficiente para texto grande, pero raspando el mínimo con el peor píxel.
 *
 * El peor píxel cae en el borde derecho de la columna de texto, donde el velo
 * es más fino; el texto real vive bastante más a la izquierda, así que estos
 * números son el piso y no el promedio.
 */
/**
 * Los tres trazos que salen de «Ferias».
 *
 * Decorativo y nada más, así que va `aria-hidden`: un lector de pantalla que
 * anuncie esto interrumpe el título a la mitad.
 *
 * En SVG y no en tres `div` girados porque tiene que escalar con la tipografía
 * —el título va de 48 a 72 px según el ancho— y un `viewBox` lo hace solo. El
 * tamaño está en `em`, así que sigue al `font-size` del `h1` sin que haya que
 * repetir los cortes en cada punto de quiebre.
 */
function AdornoFerias() {
  return (
    <svg
      viewBox="0 0 48 40"
      aria-hidden="true"
      className="absolute -top-[0.12em] -right-[0.95em] h-[0.78em] w-[0.94em]"
      fill="none"
      strokeLinecap="round"
      strokeWidth="6"
    >
      <path d="M5 30 L13 9" stroke="#16a34a" />
      <path d="M22 27 L27 5" stroke="var(--color-acento-400)" />
      <path d="M38 30 L42 14" stroke="var(--color-municipal-500)" />
    </svg>
  );
}

/*
  No hay contadores en el hero, y conviene que siga así.

  Había dos —«Ferias programadas» y «Feriantes»— y se sacaron por pedido: en
  una portada que ya tiene título, buscador y cuatro accesos, dos números
  sueltos compiten por la atención sin ayudar a decidir nada.

  Si alguna vez vuelven, el número de ferias tiene que salir de la MISMA lista
  que la grilla de más abajo y no de un `count` con el flag `activa`. Con el
  `count` la portada se contradecía sola: el mismo HTML decía «Ferias activas:
  5» arriba y «Por ahora no hay ferias programadas» abajo, porque son dos
  preguntas distintas. Con una sola lista, el 0 y el cartel de vacío aparecen
  juntos o no aparece ninguno.
*/
export function HeroInicio() {
  return (
    <section className="relative isolate overflow-hidden bg-white">
      {/* La foto trae su propio desvanecido hacia la izquierda, donde va el
          texto; `object-right` la ancla para que ese degradado caiga siempre
          en el mismo lugar aunque cambie el ancho de la pantalla. */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src="/hero-feria-dia.webp"
          // Vacío a propósito: es ambiente, y el h1 ya dice de qué se trata.
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right"
        />
      </div>

      {/* Hasta `lg` el texto ocupa casi todo el ancho y el velo tiene que ser
          parejo: un degradado horizontal dejaría las últimas palabras de cada
          línea sobre los toldos. Desde `lg` entra el degradado. */}
      <div
        className="absolute inset-0 bg-white/92 lg:hidden"
        aria-hidden="true"
      />
      <div
        className="velo-hero-claro absolute inset-0 hidden lg:block"
        aria-hidden="true"
      />

      {/* Base blanca que engancha con la sección de abajo: sin esto la foto
          termina en una línea recta justo donde la vista sigue bajando. */}
      <div
        className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="lg:col-span-7">
            <p
              className="animar-aparecer text-xs font-semibold tracking-[0.2em] text-municipal-700 uppercase"
              style={{ animationDelay: "60ms" }}
            >
              San Miguel de Tucumán
            </p>

            {/* Dos tonos y renglones pegados: es lo que le da peso de marca.
                El `leading` ajustado no es capricho — con el interlineado
                normal, dos palabras de este tamaño se separan tanto que dejan
                de leerse como una sola unidad. */}
            <h1
              className="animar-aparecer mt-2 text-5xl leading-[0.95] font-bold tracking-tight text-municipal-950 sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "160ms" }}
            >
              <span className="relative inline-block">
                Ferias
                <AdornoFerias />
              </span>
              <span className="block text-municipal-600">Tucumanas</span>
            </h1>

            <p
              className="animar-aparecer mt-5 max-w-xl text-lg leading-relaxed text-slate-700"
              style={{ animationDelay: "260ms" }}
            >
              Conocé a nuestros productores locales, alimentos frescos,
              productos artesanales y ferias de barrio en toda la ciudad.
            </p>

            {/*
              Un formulario común con `method` GET, no un componente de
              cliente: el navegador arma solo `/stands?q=…`, que es una ruta que
              ya existe. Así el buscador de la portada anda sin JavaScript.

              El texto de ayuda invita a buscar por nombre de feria, y eso sólo
              es cierto desde que `vendedoresAprobados` también mira el nombre
              de la feria en la que participa cada stand. La frase se escribió
              después de que la búsqueda la cumpliera, no antes.
            */}
            <form
              action="/stands"
              className="animar-aparecer mt-8 max-w-2xl"
              style={{ animationDelay: "360ms" }}
              role="search"
            >
              <label htmlFor="q-inicio" className="sr-only">
                Buscar una feria, un producto o un emprendimiento
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-900/5 focus-within:border-municipal-400 focus-within:ring-2 focus-within:ring-municipal-500/20">
                <IconoBuscar className="ml-2 size-5 shrink-0 text-slate-400" />
                <input
                  id="q-inicio"
                  name="q"
                  type="search"
                  placeholder="¿Qué producto o feria estás buscando?"
                  className="min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
                />
                {/* Redondo y sin texto, como la referencia. El nombre va en
                    `aria-label`: sin eso, un lector de pantalla anuncia
                    «botón» y no hay forma de saber qué hace. */}
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-municipal-500 text-white transition-colors hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
                >
                  <IconoFlechaDerecha className="size-5" />
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Buscá por nombre de la feria, producto o emprendimiento. Ej.:
                frutas, artesanías, yerba, Feria Parque Avellaneda.
              </p>
            </form>
          </div>

          {/*
            Migue sólo desde `lg`. Más angosto que eso compite con el texto por
            el mismo espacio, y lo que se pierde si no está es nada: el
            asistente sigue a un toque en la burbuja de abajo a la derecha.
          */}
          <div
            className="animar-aparecer relative hidden lg:col-span-5 lg:block"
            style={{ animationDelay: "560ms" }}
          >
            <div className="relative ml-auto w-[22rem] xl:w-[26rem]">
              <p className="absolute top-2 -left-8 z-10 max-w-[12rem] rounded-2xl rounded-br-sm bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-slate-200">
                Hola, soy{" "}
                <span className="font-semibold text-municipal-700">Migue</span>.
                Preguntame qué feria hay hoy o dónde conseguir algo.
              </p>
              <Image
                src="/migue.webp"
                // Nombrado y descripto porque no es ambiente: es un personaje
                // con el que se puede hablar, y quien no ve la imagen tiene que
                // enterarse de que existe.
                alt="Migue, el asistente de las ferias municipales"
                width={1315}
                height={1197}
                priority
                sizes="(max-width: 1280px) 22rem, 26rem"
                className="h-auto w-full drop-shadow-xl"
              />
            </div>
          </div>
        </div>

        {/*
          Los accesos van DENTRO del hero y no en una banda blanca aparte: así
          la foto y el velo siguen detrás de ellos y el bloque entero se lee
          como una sola pieza, que es como está en la referencia. Afuera, el
          corte horizontal partía la portada en dos justo donde la vista baja.
        */}
        <nav
          aria-label="Accesos rápidos"
          className="animar-aparecer mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4"
          style={{ animationDelay: "660ms" }}
        >
          {accesos(hayPedidos()).map((acceso) => (
            <Link
              key={acceso.titulo}
              href={acceso.href}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${acceso.color}`}
                aria-hidden="true"
              >
                <acceso.icono className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">
                  {acceso.titulo}
                </span>
                <span className="block text-sm text-slate-600">
                  {acceso.texto}
                </span>
              </span>
              <IconoChevronDerecha className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
