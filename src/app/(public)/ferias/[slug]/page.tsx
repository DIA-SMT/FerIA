import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TarjetaStand } from "@/components/public/tarjeta-stand";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCalendario,
  IconoEnlaceExterno,
  IconoFlechaIzquierda,
  IconoGrilla,
  IconoReloj,
  IconoTienda,
  IconoUbicacion,
  IconoUsuarios,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { EDICIONES_PUBLICAS } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearRangoFechas, hoyUTC, truncar } from "@/lib/format";
import { linkGoogleMaps, linkGoogleMapsPorDireccion } from "@/lib/geo";
import {
  CATEGORIAS_FERIA,
  ESTADOS_EDICION,
  TONO_ESTADO_EDICION,
} from "@/lib/labels";

async function obtenerFeria(slug: string) {
  return prisma.feria.findFirst({
    where: { slug, activa: true },
    include: {
      ediciones: {
        where: EDICIONES_PUBLICAS,
        orderBy: { fechaInicio: "asc" },
        include: {
          stands: {
            orderBy: { numero: "asc" },
            include: {
              vendedor: {
                select: {
                  slug: true,
                  emprendimiento: true,
                  rubro: true,
                  descripcion: true,
                  imagenPortada: true,
                  logo: true,
                  estado: true,
                  _count: { select: { productos: { where: { disponible: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feria = await prisma.feria.findFirst({
    where: { slug, activa: true },
    select: { nombre: true, descripcion: true, imagen: true },
  });

  if (!feria) return { title: "Feria no encontrada" };

  return {
    title: feria.nombre,
    description: truncar(feria.descripcion, 155),
    openGraph: {
      title: feria.nombre,
      description: truncar(feria.descripcion, 155),
      ...(feria.imagen ? { images: [feria.imagen] } : {}),
    },
  };
}

export default async function PaginaFeria({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feria = await obtenerFeria(slug);

  if (!feria) notFound();

  const hoy = hoyUTC();
  const vigentes = feria.ediciones.filter((edicion) => edicion.fechaFin >= hoy);
  const mapa =
    linkGoogleMaps(feria.latitud, feria.longitud) ??
    linkGoogleMapsPorDireccion(feria.direccion);

  // Feriantes con stand asignado en las ediciones vigentes, sin repetir.
  const participantes = new Map<
    string,
    NonNullable<(typeof feria.ediciones)[number]["stands"][number]["vendedor"]>
  >();
  for (const edicion of vigentes) {
    for (const stand of edicion.stands) {
      if (stand.vendedor && stand.vendedor.estado === "APROBADO") {
        participantes.set(stand.vendedor.slug, stand.vendedor);
      }
    }
  }

  return (
    <div>
      {/* ------------------------------ Portada ----------------------------- */}
      <div className="relative">
        <ImagenPortada
          src={feria.imagen}
          alt={feria.nombre}
          icono={IconoTienda}
          prioridad
          sizes="100vw"
          className="h-56 w-full sm:h-72 lg:h-80"
        />
        {feria.imagen && (
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent"
            aria-hidden="true"
          />
        )}

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
            <Badge tono="celeste" className="bg-white/95">
              {CATEGORIAS_FERIA[feria.categoria]}
            </Badge>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              {feria.nombre}
            </h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/ferias"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver a las ferias
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-3">
          {/* ---------------------------- Contenido --------------------------- */}
          <div className="lg:col-span-2">
            <section>
              <h2 className="sr-only">Sobre la feria</h2>
              <p className="text-lg whitespace-pre-line text-slate-700">
                {feria.descripcion}
              </p>
            </section>

            {/* ---------------------------- Ediciones -------------------------- */}
            <section className="mt-10">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Fechas
              </h2>

              {vigentes.length === 0 ? (
                <EstadoVacio
                  icono={IconoCalendario}
                  className="mt-4"
                  titulo="Sin fechas confirmadas"
                  descripcion="Todavía no hay una próxima edición publicada para esta feria."
                />
              ) : (
                <ul className="mt-4 space-y-3">
                  {vigentes.map((edicion) => {
                    const ocupados = edicion.stands.filter(
                      (stand) => stand.vendedorId !== null,
                    ).length;

                    return (
                      <li
                        key={edicion.id}
                        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            {edicion.nombre && (
                              <p className="text-sm font-medium text-municipal-600">
                                {edicion.nombre}
                              </p>
                            )}
                            <p className="mt-0.5 text-lg font-semibold text-slate-900">
                              {formatearRangoFechas(
                                edicion.fechaInicio,
                                edicion.fechaFin,
                              )}
                            </p>
                          </div>
                          <Badge
                            tono={TONO_ESTADO_EDICION[edicion.estado]}
                            conPunto={edicion.estado === "EN_CURSO"}
                          >
                            {ESTADOS_EDICION[edicion.estado]}
                          </Badge>
                        </div>

                        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <dt className="sr-only">Horario</dt>
                            <IconoReloj className="size-4 shrink-0 text-slate-400" />
                            <dd>{edicion.horario}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="sr-only">Stands</dt>
                            <IconoGrilla className="size-4 shrink-0 text-slate-400" />
                            <dd>
                              {ocupados} de {edicion.stands.length} stands
                              ocupados
                            </dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* --------------------------- Participantes ------------------------ */}
            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Feriantes que participan
                </h2>
                {participantes.size > 0 && (
                  <Link
                    href={`/stands?feria=${feria.slug}`}
                    className="text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                  >
                    Ver en el directorio
                  </Link>
                )}
              </div>

              {participantes.size === 0 ? (
                <EstadoVacio
                  icono={IconoUsuarios}
                  className="mt-4"
                  titulo="Todavía no hay feriantes asignados"
                  descripcion="La municipalidad va a publicar acá los stands a medida que se confirmen las asignaciones."
                />
              ) : (
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  {[...participantes.values()].map((vendedor) => (
                    <TarjetaStand
                      key={vendedor.slug}
                      stand={{
                        slug: vendedor.slug,
                        emprendimiento: vendedor.emprendimiento,
                        rubro: vendedor.rubro,
                        descripcion: vendedor.descripcion,
                        imagenPortada: vendedor.imagenPortada,
                        logo: vendedor.logo,
                        cantidadProductos: vendedor._count.productos,
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ----------------------------- Barra lateral ---------------------- */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <IconoUbicacion className="size-4 text-municipal-500" />
                  Dónde es
                </h2>
                <p className="mt-2 text-sm text-slate-600">{feria.direccion}</p>
                <p className="text-sm text-slate-500">
                  San Miguel de Tucumán, Tucumán
                </p>
              </div>

              <BotonLink
                href={mapa}
                externo
                variante="contorno"
                ancho
                tamanio="md"
              >
                Ver en Google Maps
                <IconoEnlaceExterno className="size-4" />
              </BotonLink>

              {vigentes[0] && (
                <div className="border-t border-slate-100 pt-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <IconoCalendario className="size-4 text-municipal-500" />
                    Próxima fecha
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {formatearRangoFechas(
                      vigentes[0].fechaInicio,
                      vigentes[0].fechaFin,
                    )}
                  </p>
                  <p className="text-sm text-slate-600">{vigentes[0].horario}</p>
                </div>
              )}

              <div className="rounded-lg bg-acento-50 p-3 ring-1 ring-acento-300">
                <p className="text-xs text-acento-900">
                  La entrada es libre y gratuita. Las compras se hacen
                  directamente con cada feriante.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
