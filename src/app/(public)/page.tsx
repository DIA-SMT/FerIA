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

        {/*
          Dos velos, según el ancho, porque el texto no ocupa la misma
          proporción de la pantalla:

          · Hasta `lg` el texto abarca casi todo el ancho, así que el velo es
            parejo y parejo tiene que ser: un degradé horizontal dejaría las
            últimas palabras de cada línea sobre los toldos iluminados.
          · Desde `lg` el texto llega como máximo al 69 % del ancho. El velo se
            mantiene denso hasta el 65 % y se abre después, que es justo donde
            están los puestos con las luces cálidas.

          Contraste medido contra blanco, en el peor píxel de la zona de texto:
          13,4:1 a 1440 px, 8,6:1 a 1024 px y 10,4:1 a 375 px. AAA pide 7:1.
        */}
        <div
          className="absolute inset-0 bg-municipal-950/85 lg:hidden"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden lg:block lg:bg-gradient-to-r lg:from-municipal-950 lg:from-20% lg:via-municipal-950/88 lg:via-65% lg:to-municipal-900/10"
          aria-hidden="true"
        />
        <div className="trama-puntos absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25">
              <span
                className="size-1.5 rounded-full bg-acento-400"
                aria-hidden="true"
              />
              Municipalidad de San Miguel de Tucumán
            </p>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Las ferias de la ciudad,
              <span className="text-acento-400"> ahora también online</span>
            </h1>

            <p className="mt-5 text-lg text-white/90">
              Artesanos, emprendedores y cocineros de San Miguel de Tucumán en un
              solo lugar. Mirá qué ferias hay esta semana, recorré cada stand y
              escribile directamente a quien produce.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <BotonLink href="/ferias" variante="acento" tamanio="lg">
                Ver ferias
              </BotonLink>
              <BotonLink
                href="/stands"
                tamanio="lg"
                className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Explorar stands
              </BotonLink>
            </div>

            <dl className="mt-10 flex gap-8 border-t border-white/20 pt-6">
              <div>
                <dt className="text-xs tracking-wide text-white/70 uppercase">
                  Ferias activas
                </dt>
                <dd className="mt-1 text-2xl font-bold text-white">
                  {formatearNumero(totalFerias)}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-white/70 uppercase">
                  Feriantes
                </dt>
                <dd className="mt-1 text-2xl font-bold text-white">
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
