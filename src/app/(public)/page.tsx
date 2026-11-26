import Link from "next/link";

import { HeroFerias } from "@/components/public/hero-ferias";
import { SeccionFeriante } from "@/components/public/seccion-feriante";
import { SeccionRubros } from "@/components/public/seccion-rubros";
import { SeccionSelloPropio } from "@/components/public/seccion-sello-propio";
import {
  COLOR_CATEGORIA,
  ICONOS_CATEGORIA,
} from "@/components/ui/iconos-por-clave";
import {
  IconoChevronDerecha,
  IconoReloj,
  IconoTienda,
  IconoUbicacion,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { hayIAConfigurada } from "@/lib/ai";
import { cn } from "@/lib/cn";
import { EDICIONES_PUBLICAS } from "@/lib/consultas";
import { ultimasPropuestas } from "@/lib/consultas-sello-propio";
import { prisma } from "@/lib/db";
import { hoyEnZona } from "@/lib/format";
import {
  agendaDeLaPortada,
  DIAS_DE_AGENDA,
  etiquetaDeFecha,
  lugarDeEdicion,
  resumenHorario,
} from "@/lib/horarios";

export const metadata = {
  title: "Ferias Municipales — San Miguel de Tucumán",
  description:
    "Conocé las ferias de artesanos, emprendedores y gastronómicas de la ciudad. Recorré los stands online y contactá a cada feriante por WhatsApp.",
};

export default async function PaginaInicio() {
  const hoy = hoyEnZona();
  const hasta = new Date(hoy.getTime() + DIAS_DE_AGENDA * 24 * 60 * 60 * 1000);

  const [proximas, porRubro, propuestas] = await Promise.all([
    // Las que todavía no terminaron y empiezan dentro de los próximos
    // DIAS_DE_AGENDA días: de ahí salen las tarjetas de la agenda.
    prisma.edicionFeria.findMany({
      where: {
        ...EDICIONES_PUBLICAS,
        fechaInicio: { lte: hasta },
        fechaFin: { gte: hoy },
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
        lugar: true,
        feria: {
          select: {
            nombre: true,
            slug: true,
            direccion: true,
            categoria: true,
            imagen: true,
          },
        },
      },
    }),
    prisma.vendedor.groupBy({
      by: ["rubro"],
      where: { estado: "APROBADO" },
      _count: true,
      orderBy: { _count: { rubro: "desc" } },
      take: 4,
    }),
    ultimasPropuestas(3),
  ]);

  // Una tarjeta por feria y por día, de hoy en adelante: lo que queda de esta
  // semana o, si ya no queda nada, las próximas fechas.
  const { deEstaSemana, tarjetas: agenda } = agendaDeLaPortada(
    hoy,
    proximas,
    4,
  );

  return (
    <>
      <HeroFerias />

      {/* ----------------------- Ferias de la semana o próximas ------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {deEstaSemana ? "Ferias de esta semana" : "Próximas ferias"}
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

        {agenda.length === 0 ? (
          <p className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
            Todavía no hay próximas fechas publicadas.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {agenda.map(({ fecha, edicion }) => {
              const etiqueta = etiquetaDeFecha(fecha);
              const horario = resumenHorario(edicion);
              const IconoCategoria = ICONOS_CATEGORIA[edicion.feria.categoria];

              // Las dos fechas son medianoche UTC —`hoyEnZona` la construye así
              // y `semanaDe` suma días enteros—, así que comparar el instante
              // es exacto y no hace falta normalizar nada.
              const esHoy = fecha.getTime() === hoy.getTime();

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
                  className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-superficie p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-celeste-300 hover:shadow-md"
                >
                  <span className="flex min-w-0 gap-3">
                    {/*
                      El taco de fecha se pinta de ámbar cuando el día es hoy.
                      Es información y no adorno: en una agenda de siete días lo
                      primero que se busca es «cuál es hoy».
                    */}
                    <span
                      className={cn(
                        "flex size-14 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
                        esHoy
                          ? "bg-acento-100 text-acento-900"
                          : "bg-municipal-50 text-municipal-700",
                      )}
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

                    {/*
                      `alt` vacío porque el nombre de la feria va escrito justo
                      abajo: anunciarlo dos veces es ruido para quien escucha.
                    */}
                    <ImagenPortada
                      src={edicion.feria.imagen}
                      alt=""
                      icono={IconoTienda}
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      className="aspect-[16/10] min-w-0 flex-1 rounded-lg"
                    />
                  </span>

                  <span className="mt-3 flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        "paleta-original mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-white",
                        COLOR_CATEGORIA[edicion.feria.categoria],
                      )}
                      aria-hidden="true"
                    >
                      <IconoCategoria className="size-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="lineas-2 block font-semibold text-slate-900 group-hover:text-municipal-700">
                        {edicion.feria.nombre}
                      </span>
                      {/*
                        El horario se deja envolver en dos líneas en vez de
                        recortarse: una feria con horas distintas por día —«de
                        18 a 24, sábados y domingos de 12 a 24»— no entra en
                        una línea de 215 px, y cortada deja justo el dato que
                        nadie puede adivinar. La dirección sí se recorta: está
                        completa a un clic, en la página de la feria.
                      */}
                      {horario && (
                        <span className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                          <IconoReloj className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                          <span className="lineas-2">{horario}</span>
                        </span>
                      )}
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
                        <IconoUbicacion className="size-3.5 shrink-0 text-municipal-500" />
                        <span className="truncate">
                          {lugarDeEdicion(edicion, edicion.feria) ||
                            "Lugar a confirmar"}
                        </span>
                      </span>
                    </span>

                    <IconoChevronDerecha className="mt-2 size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------ Modo Feria -------------------------- */}
      {propuestas.length > 0 && <SeccionSelloPropio propuestas={propuestas} />}

      {/* --------------------------- Qué vas a encontrar -------------------- */}
      <SeccionRubros rubros={porRubro} conMigue={hayIAConfigurada()} />

      {/* --------------------------- Ser feriante --------------------------- */}
      <SeccionFeriante />
    </>
  );
}
