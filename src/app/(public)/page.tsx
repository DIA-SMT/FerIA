import Link from "next/link";

import { HeroInicio } from "@/components/public/hero-inicio";
import { TarjetaFeria } from "@/components/public/tarjeta-feria";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoChat,
  IconoChevronDerecha,
  IconoEtiqueta,
  IconoReloj,
  IconoTienda,
  IconoUbicacion,
} from "@/components/ui/iconos";
import { hayIAConfigurada } from "@/lib/ai";
import {
  EDICIONES_PUBLICAS,
  feriasConProximaEdicion,
  ordenarPorRelevancia,
} from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearNumero, hoyEnZona } from "@/lib/format";
import {
  agendaDeLaSemana,
  etiquetaDeFecha,
  resumenHorario,
  semanaDe,
} from "@/lib/horarios";
import { RUBROS } from "@/lib/labels";

export const metadata = {
  title: "Ferias Municipales — San Miguel de Tucumán",
  description:
    "Conocé las ferias de artesanos, emprendedores y gastronómicas de la ciudad. Recorré los stands online y contactá a cada feriante por WhatsApp.",
};

export default async function PaginaInicio() {
  const hoy = hoyEnZona();
  const semana = semanaDe(hoy);
  const [primerDia, ultimoDia] = [semana[0] as Date, semana[6] as Date];

  // El `count` de feriantes aprobados se fue con los contadores del hero: era
  // su único consumidor, y una consulta que no alimenta nada es una consulta
  // que igual cruza a São Paulo en cada visita a la portada.
  const [ferias, edicionesSemana, porRubro] = await Promise.all([
    feriasConProximaEdicion({ soloConEdiciones: true }),
    // Las que se cruzan con esta semana: empiezan antes de que termine y
    // terminan después de que empieza.
    prisma.edicionFeria.findMany({
      where: {
        ...EDICIONES_PUBLICAS,
        fechaInicio: { lte: ultimoDia },
        fechaFin: { gte: primerDia },
        feria: { activa: true },
      },
      orderBy: { fechaInicio: "asc" },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        diasSemana: true,
        horaApertura: true,
        horaCierre: true,
        horario: true,
        feria: { select: { nombre: true, slug: true, direccion: true } },
      },
    }),
    prisma.vendedor.groupBy({
      by: ["rubro"],
      where: { estado: "APROBADO" },
      _count: true,
      orderBy: { _count: { rubro: "desc" } },
      take: 4,
    }),
  ]);

  const feriasDestacadas = ordenarPorRelevancia(ferias).slice(0, 6);

  // Una tarjeta por feria y por día. La agenda devuelve los días con algo, y
  // acá se aplana para que cada tarjeta sea «esta feria, este día».
  const agenda = agendaDeLaSemana(semana, edicionesSemana)
    .flatMap((dia) =>
      dia.ediciones.map((edicion) => ({ fecha: dia.fecha, edicion })),
    )
    .slice(0, 4);

  return (
    <>
      <HeroInicio />

      {/* -------------------------- Ferias de la semana --------------------- */}
      {agenda.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Ferias de esta semana
              </h2>
              <p className="mt-1 text-slate-600">
                Organizate y disfrutá de las ferias de tu barrio.
              </p>
            </div>
            <Link
              href="/ferias"
              className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
            >
              Ver todas las ferias
              <IconoChevronDerecha className="size-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agenda.map(({ fecha, edicion }) => {
              const etiqueta = etiquetaDeFecha(fecha);
              const horario = resumenHorario(edicion);

              return (
                <Link
                  key={`${edicion.id}-${fecha.toISOString()}`}
                  href={`/ferias/${edicion.feria.slug}`}
                  // `min-w-0` es obligatorio acá, no decorativo: un ítem de
                  // grid tiene `min-width: auto`, la dirección de abajo usa
                  // `truncate` —o sea `white-space: nowrap`— y entonces su
                  // ancho mínimo es el texto entero. Sin esto la tarjeta medía
                  // 491 px dentro de una columna de 343 y la portada entera
                  // desbordaba a lo ancho en el teléfono.
                  className="group flex min-w-0 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span
                    className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-municipal-50 leading-none text-municipal-700"
                    aria-hidden="true"
                  >
                    <span className="text-[10px] font-semibold tracking-wide">
                      {etiqueta.dia}
                    </span>
                    <span className="mt-0.5 text-xl font-bold tabular-nums">
                      {etiqueta.numero}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium">
                      {etiqueta.mes}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900 group-hover:text-municipal-700">
                      {edicion.feria.nombre}
                    </span>
                    {horario && (
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <IconoReloj className="size-3.5 shrink-0" />
                        {horario}
                      </span>
                    )}
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
                      <IconoUbicacion className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {edicion.feria.direccion}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------------ Ferias ------------------------------ */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
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
              className="mt-8 bg-white"
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
        </div>
      </section>

      {/* --------------------------- Qué vas a encontrar -------------------- */}
      {porRubro.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-10">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Qué vas a encontrar
              </h2>
              <p className="mt-1 text-slate-600">
                Productos locales, frescos y con identidad tucumana.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {porRubro.map((fila) => (
                  <Link
                    key={fila.rubro}
                    href={`/stands?rubro=${fila.rubro}`}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-municipal-50 text-municipal-600"
                      aria-hidden="true"
                    >
                      <IconoEtiqueta className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900 group-hover:text-municipal-700">
                        {RUBROS[fila.rubro]}
                      </span>
                      <span className="block text-sm text-slate-600">
                        {formatearNumero(fila._count)}{" "}
                        {fila._count === 1
                          ? "emprendimiento"
                          : "emprendimientos"}
                      </span>
                    </span>
                    <IconoChevronDerecha className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>

            {/*
              Migue sólo si la IA está configurada. Sin `OPENROUTER_API_KEY` la
              burbuja del asistente ni se monta —ver el layout público—, así que
              invitar a hablar con él sería mandar a la gente a un botón que no
              existe.
            */}
            {hayIAConfigurada() && (
              <aside className="mt-10 flex flex-col justify-center rounded-2xl border border-municipal-100 bg-municipal-50 p-6 lg:mt-0">
                <span
                  className="flex size-11 items-center justify-center rounded-lg bg-municipal-500 text-white"
                  aria-hidden="true"
                >
                  <IconoChat className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  ¿Buscás algo en particular?
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Migue te ayuda a encontrarlo y te dice en qué feria y en qué
                  stand lo podés conseguir. Está abajo a la derecha, en todas
                  las páginas.
                </p>
              </aside>
            )}
          </div>
        </section>
      )}

      {/* --------------------------- Ser feriante --------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
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
                    <p className="font-semibold text-slate-900">
                      {paso.titulo}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {paso.texto}
                    </p>
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
