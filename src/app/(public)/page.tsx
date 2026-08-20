import Image from "next/image";
import Link from "next/link";

import { TarjetaFeria } from "@/components/public/tarjeta-feria";
import { TarjetaStand } from "@/components/public/tarjeta-stand";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoChevronDerecha,
  IconoTienda,
  IconoUsuarios,
} from "@/components/ui/iconos";
import {
  feriasConProximaEdicion,
  ordenarPorRelevancia,
  vendedoresAprobados,
} from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearNumero } from "@/lib/format";

export const metadata = {
  title: "Ferias Municipales — San Miguel de Tucumán",
  description:
    "Conocé las ferias de artesanos, emprendedores y gastronómicas de la ciudad. Recorré los stands online y contactá a cada feriante por WhatsApp.",
};

export default async function PaginaInicio() {
  const [ferias, stands, totalFeriantes, totalFerias] = await Promise.all([
    feriasConProximaEdicion({ soloConEdiciones: true }),
    vendedoresAprobados({ limite: 8 }),
    prisma.vendedor.count({ where: { estado: "APROBADO" } }),
    prisma.feria.count({ where: { activa: true } }),
  ]);

  const feriasDestacadas = ordenarPorRelevancia(ferias).slice(0, 6);

  return (
    <>
      {/* ------------------------------- Hero ------------------------------- */}
      {/*
        Foto de fondo con velo institucional. El velo no es decorativo: es lo
        que sostiene el contraste del texto blanco sobre una imagen que tiene
        zonas claras (los toldos iluminados). Va opaco a la izquierda, donde
        está el texto, y se abre hacia la derecha para dejar ver la feria.
      */}
      <section className="relative isolate overflow-hidden bg-municipal-950">
        {/* La foto va en su propio contenedor porque el que se acerca es él: si
            el `scale` fuera sobre el `Image` con `fill`, pelearía con el
            `object-position`. */}
        <div className="animar-acercar absolute inset-0" aria-hidden="true">
          <Image
            src="/hero-feria-nocturna.webp"
            // Vacío a propósito: es una imagen de ambiente y el h1 ya dice de
            // qué se trata. Anunciarla sería ruido para un lector de pantalla.
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-right"
          />
        </div>

        {/*
          Dos velos, según el ancho, porque el texto no ocupa la misma
          proporción de la pantalla:

          · Hasta `lg` el texto abarca casi todo el ancho, así que el velo es
            parejo y parejo tiene que ser: un degradé horizontal dejaría las
            últimas palabras de cada línea sobre los toldos iluminados.
          · Desde `lg` el texto llega como máximo al 55 % del ancho, y ahí entra
            `velo-hero`, que abre hacia la derecha sin escalón.

          Contraste contra blanco, componiendo foto + velo + resplandor + trama
          y midiendo el píxel más claro del 55 % izquierdo, que es el peor caso
          para texto blanco: 8,0:1 a 1440 px, 8,0:1 a 1024 px y 7,2:1 a 375 px.
          AAA pide 7:1, así que el margen es chico: si se abre más el velo o se
          sube el resplandor, hay que volver a medir.
        */}
        <div
          className="absolute inset-0 bg-municipal-950/85 lg:hidden"
          aria-hidden="true"
        />
        <div className="velo-hero absolute inset-0 hidden lg:block" aria-hidden="true" />

        {/* Resplandor celeste detrás del texto: da profundidad al azul plano
            del lado izquierdo, que era lo más chato del hero. */}
        <div
          className="absolute top-1/2 -left-32 size-[34rem] -translate-y-1/2 rounded-full bg-celeste-500/20 blur-3xl"
          aria-hidden="true"
        />

        <div
          className="trama-puntos trama-hero absolute inset-0"
          aria-hidden="true"
        />

        {/* Base que engancha con la sección clara de abajo, para que el corte no
            sea una línea recta. */}
        <div
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-municipal-950 to-transparent"
          aria-hidden="true"
        />

        {/* Los bloques entran escalonados, de arriba hacia abajo. El retraso va
            inline porque es un dato de este hero y no una escala reutilizable. */}
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl">
            <p
              className="animar-aparecer inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm"
              style={{ animationDelay: "60ms" }}
            >
              <span
                className="animar-latir size-1.5 rounded-full bg-acento-400"
                aria-hidden="true"
              />
              Municipalidad de San Miguel de Tucumán
            </p>

            <h1
              className="animar-aparecer mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "160ms" }}
            >
              Las ferias de la ciudad,
              {/* El amarillo va en su propia línea: partido a mitad de frase por
                  el salto de línea se leía como un error de maquetado. */}
              <span className="mt-1 block text-acento-400">
                ahora también online
              </span>
            </h1>

            <p
              className="animar-aparecer mt-6 max-w-xl text-lg leading-relaxed text-white/85"
              style={{ animationDelay: "260ms" }}
            >
              Artesanos, emprendedores y cocineros de San Miguel de Tucumán en un
              solo lugar. Mirá qué ferias hay esta semana, recorré cada stand y
              escribile directamente a quien produce.
            </p>

            <div
              className="animar-aparecer mt-9 flex flex-wrap gap-3"
              style={{ animationDelay: "360ms" }}
            >
              <BotonLink
                href="/ferias"
                variante="acento"
                tamanio="lg"
                className="shadow-lg shadow-acento-400/20 transition-transform hover:-translate-y-0.5"
              >
                Ver ferias
              </BotonLink>
              <BotonLink
                href="/stands"
                tamanio="lg"
                className="border border-white/30 bg-white/10 text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:bg-white/20"
              >
                Explorar stands
              </BotonLink>
            </div>

            <dl
              className="animar-aparecer mt-12 flex gap-10 border-t border-white/15 pt-6"
              style={{ animationDelay: "460ms" }}
            >
              <div>
                <dt className="text-[11px] font-medium tracking-widest text-celeste-200 uppercase">
                  Ferias activas
                </dt>
                <dd className="mt-1.5 text-3xl font-bold text-white tabular-nums">
                  {formatearNumero(totalFerias)}
                </dd>
              </div>
              {/* Separador fino, en lugar de dejar los dos números sueltos. */}
              <div className="w-px self-stretch bg-white/15" aria-hidden="true" />
              <div>
                <dt className="text-[11px] font-medium tracking-widest text-celeste-200 uppercase">
                  Feriantes
                </dt>
                <dd className="mt-1.5 text-3xl font-bold text-white tabular-nums">
                  {formatearNumero(totalFeriantes)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ------------------------------ Ferias ------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Ferias en curso y próximas
            </h2>
            <p className="mt-1 text-slate-600">
              Fechas confirmadas por la Dirección de Ferias y Mercados.
            </p>
          </div>
          <Link
            href="/ferias"
            className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
          >
            Ver todas
            <IconoChevronDerecha className="size-4" />
          </Link>
        </div>

        {feriasDestacadas.length === 0 ? (
          <EstadoVacio
            icono={IconoTienda}
            className="mt-8"
            titulo="Por ahora no hay ferias programadas"
            descripcion="Cuando la municipalidad publique las próximas fechas, van a aparecer acá."
          />
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {feriasDestacadas.map((feria, indice) => (
              <TarjetaFeria
                key={feria.slug}
                feria={feria}
                prioridad={indice < 3}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------ Stands ------------------------------ */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Stands para recorrer
              </h2>
              <p className="mt-1 text-slate-600">
                Emprendimientos locales con su vidriera online.
              </p>
            </div>
            <Link
              href="/stands"
              className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
            >
              Ver el directorio
              <IconoChevronDerecha className="size-4" />
            </Link>
          </div>

          {stands.length === 0 ? (
            <EstadoVacio
              icono={IconoUsuarios}
              className="mt-8 bg-white"
              titulo="Todavía no hay stands publicados"
              descripcion="Los feriantes aprobados por la municipalidad aparecen en este directorio."
            />
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stands.map((stand) => (
                <TarjetaStand key={stand.slug} stand={stand} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* --------------------------- Ser feriante --------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-municipal-100 bg-municipal-50">
          <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                ¿Tenés un emprendimiento y querés participar?
              </h2>
              <p className="mt-3 text-slate-600">
                Registrate en la plataforma con los datos de tu emprendimiento.
                La Dirección de Ferias y Mercados revisa cada solicitud y, una
                vez aprobada, vas a poder cargar tu catálogo y ser asignado a un
                stand en las próximas ediciones.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <BotonLink href="/registro" tamanio="lg">
                  Registrarme como feriante
                </BotonLink>
                <BotonLink href="/ingresar" variante="contorno" tamanio="lg">
                  Ya tengo cuenta
                </BotonLink>
              </div>
            </div>

            <ol className="space-y-4">
              {[
                {
                  titulo: "Registrás tu emprendimiento",
                  texto:
                    "Cargás tus datos, el rubro y cómo te pueden contactar.",
                },
                {
                  titulo: "La municipalidad revisa la solicitud",
                  texto:
                    "Verificamos que cumpla con el reglamento de ferias vigente.",
                },
                {
                  titulo: "Publicás tu stand y te asignamos un lugar",
                  texto:
                    "Subís tus productos y participás de las próximas ediciones.",
                },
              ].map((paso, indice) => (
                <li key={paso.titulo} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-municipal-500 text-sm font-semibold text-white">
                    {indice + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{paso.titulo}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{paso.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
