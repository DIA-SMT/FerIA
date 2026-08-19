import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TarjetaProducto } from "@/components/public/tarjeta-producto";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCalendario,
  IconoCorreo,
  IconoEtiqueta,
  IconoFacebook,
  IconoFlechaIzquierda,
  IconoInstagram,
  IconoTelefono,
  IconoTienda,
  IconoUbicacion,
  IconoWeb,
  IconoWhatsapp,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { EDICIONES_PUBLICAS } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearRangoFechas, hoyUTC, truncar } from "@/lib/format";
import { RUBROS } from "@/lib/labels";
import {
  linkFacebook,
  linkInstagram,
  linkTelefono,
  sitioWebLegible,
} from "@/lib/redes";
import {
  formatearWhatsapp,
  linkWhatsapp,
  mensajeConsultaStand,
} from "@/lib/whatsapp";

async function obtenerStand(slug: string) {
  return prisma.vendedor.findFirst({
    where: { slug, estado: "APROBADO" },
    include: {
      productos: {
        orderBy: [{ destacado: "desc" }, { disponible: "desc" }, { nombre: "asc" }],
      },
      stands: {
        where: { edicion: EDICIONES_PUBLICAS },
        orderBy: { edicion: { fechaInicio: "asc" } },
        include: {
          edicion: {
            include: {
              feria: { select: { nombre: true, slug: true, direccion: true } },
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
  const vendedor = await prisma.vendedor.findFirst({
    where: { slug, estado: "APROBADO" },
    select: {
      emprendimiento: true,
      descripcion: true,
      rubro: true,
      imagenPortada: true,
    },
  });

  if (!vendedor) return { title: "Stand no encontrado" };

  const descripcion = vendedor.descripcion
    ? truncar(vendedor.descripcion, 155)
    : `${RUBROS[vendedor.rubro]} en las ferias municipales de San Miguel de Tucumán.`;

  return {
    title: vendedor.emprendimiento,
    description: descripcion,
    openGraph: {
      title: vendedor.emprendimiento,
      description: descripcion,
      ...(vendedor.imagenPortada ? { images: [vendedor.imagenPortada] } : {}),
    },
  };
}

export default async function PaginaStand({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vendedor = await obtenerStand(slug);

  if (!vendedor) notFound();

  const hoy = hoyUTC();
  const participaciones = vendedor.stands.filter(
    (stand) => stand.edicion.fechaFin >= hoy,
  );

  const disponibles = vendedor.productos.filter(
    (producto) => producto.disponible,
  );
  const agotados = vendedor.productos.filter((producto) => !producto.disponible);

  const enlaceWhatsapp = linkWhatsapp(
    vendedor.whatsapp,
    mensajeConsultaStand(vendedor.emprendimiento),
  );

  return (
    <div>
      {/* ------------------------------ Portada ----------------------------- */}
      <ImagenPortada
        src={vendedor.imagenPortada}
        alt={`Portada de ${vendedor.emprendimiento}`}
        icono={IconoTienda}
        prioridad
        sizes="100vw"
        className="h-44 w-full sm:h-64"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ---------------------------- Encabezado ---------------------------
            Dos cosas acá que parecen detalle y no lo son.

            `relative z-10`: la portada es `position: relative` para que funcione
            el `fill` de next/image, y en el orden de pintado de CSS un elemento
            posicionado va por encima del texto de los elementos no posicionados
            aunque estén después en el DOM. Sin esto, la portada tapaba la mitad
            de arriba del título y del avatar. Queda en 10 para seguir por debajo
            del encabezado del sitio, que es z-30.

            El margen negativo va en el avatar y no en la fila. Cuando estaba en
            la fila, el título se metía unos 14 px dentro de la portada, y ahí es
            texto slate-900 sobre una foto cualquiera: medido sobre las diez
            portadas cargadas, ocho no llegaban al 3:1 que pide AA para texto
            grande, y la peor daba 1,21:1 en su zona más oscura. Con el margen en
            el avatar, la fila arranca en el borde de la portada y el texto queda
            siempre abajo; el avatar sigue superpuesto, que es lo que da el aire
            de vidriera, y para eso tiene el aro blanco. */}
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end">
          <Avatar
            nombre={vendedor.emprendimiento}
            imagen={vendedor.logo}
            tamanio="lg"
            className="-mt-12 size-24 text-2xl ring-4 ring-white sm:-mt-14 sm:size-28"
          />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {vendedor.emprendimiento}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tono="celeste">{RUBROS[vendedor.rubro]}</Badge>
              <Badge tono="azul" tamanio="sm">
                Feriante habilitado
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/stands"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
          >
            <IconoFlechaIzquierda className="size-4" />
            Volver al directorio
          </Link>
        </div>

        <div className="mt-6 grid gap-10 pb-10 lg:grid-cols-3">
          {/* --------------------------- Columna principal -------------------- */}
          <div className="lg:col-span-2">
            {vendedor.descripcion && (
              <section>
                <h2 className="sr-only">Sobre el emprendimiento</h2>
                <p className="text-lg whitespace-pre-line text-slate-700">
                  {vendedor.descripcion}
                </p>
              </section>
            )}

            {/* ---------------------------- Catálogo -------------------------- */}
            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Catálogo
                </h2>
                {vendedor.productos.length > 0 && (
                  <p className="text-sm text-slate-500">
                    {disponibles.length}{" "}
                    {disponibles.length === 1 ? "disponible" : "disponibles"}
                    {agotados.length > 0 && ` · ${agotados.length} sin stock`}
                  </p>
                )}
              </div>

              {vendedor.productos.length === 0 ? (
                <EstadoVacio
                  icono={IconoEtiqueta}
                  className="mt-4"
                  titulo="Catálogo en preparación"
                  descripcion="Este feriante todavía no cargó sus productos. Podés escribirle por WhatsApp para consultarle qué tiene disponible."
                />
              ) : (
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[...disponibles, ...agotados].map((producto) => (
                    <TarjetaProducto
                      key={producto.id}
                      producto={producto}
                      emprendimiento={vendedor.emprendimiento}
                      whatsapp={vendedor.whatsapp}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* -------------------------- Dónde encontrarlo -------------------- */}
            <section className="mt-10">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Dónde encontrarlo
              </h2>

              {participaciones.length === 0 ? (
                <EstadoVacio
                  icono={IconoCalendario}
                  className="mt-4"
                  titulo="Sin ferias confirmadas por ahora"
                  descripcion="Cuando se le asigne un stand en una próxima edición, va a aparecer acá."
                />
              ) : (
                <ul className="mt-4 space-y-3">
                  {participaciones.map((stand) => (
                    <li
                      key={stand.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/ferias/${stand.edicion.feria.slug}`}
                            className="font-semibold text-slate-900 transition-colors hover:text-municipal-700"
                          >
                            {stand.edicion.feria.nombre}
                          </Link>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                            <IconoCalendario className="size-4 shrink-0 text-slate-400" />
                            {formatearRangoFechas(
                              stand.edicion.fechaInicio,
                              stand.edicion.fechaFin,
                            )}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                            <IconoUbicacion className="size-4 shrink-0 text-slate-400" />
                            {stand.edicion.feria.direccion}
                          </p>
                        </div>
                        <Badge tono="amarillo">Stand {stand.numero}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ----------------------------- Contacto --------------------------- */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Contacto</h2>

              {/* El botón principal de toda la vidriera. */}
              <a
                href={enlaceWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <IconoWhatsapp className="size-5" />
                Escribir por WhatsApp
              </a>

              <p className="text-center text-xs text-slate-500">
                {formatearWhatsapp(vendedor.whatsapp)}
              </p>

              <ul className="space-y-1 border-t border-slate-100 pt-4 text-sm">
                {vendedor.telefono && (
                  <li>
                    <a
                      href={linkTelefono(vendedor.telefono)}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-municipal-700"
                    >
                      <IconoTelefono className="size-4 shrink-0 text-slate-400" />
                      {vendedor.telefono}
                    </a>
                  </li>
                )}
                {vendedor.email && (
                  <li>
                    <a
                      href={`mailto:${vendedor.email}`}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-municipal-700"
                    >
                      <IconoCorreo className="size-4 shrink-0 text-slate-400" />
                      <span className="truncate">{vendedor.email}</span>
                    </a>
                  </li>
                )}
                {vendedor.instagram && (
                  <li>
                    <a
                      href={linkInstagram(vendedor.instagram)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-municipal-700"
                    >
                      <IconoInstagram className="size-4 shrink-0 text-slate-400" />
                      <span className="truncate">@{vendedor.instagram}</span>
                    </a>
                  </li>
                )}
                {vendedor.facebook && (
                  <li>
                    <a
                      href={linkFacebook(vendedor.facebook)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-municipal-700"
                    >
                      <IconoFacebook className="size-4 shrink-0 text-slate-400" />
                      <span className="truncate">{vendedor.facebook}</span>
                    </a>
                  </li>
                )}
                {vendedor.sitioWeb && (
                  <li>
                    <a
                      href={vendedor.sitioWeb}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-municipal-700"
                    >
                      <IconoWeb className="size-4 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {sitioWebLegible(vendedor.sitioWeb)}
                      </span>
                    </a>
                  </li>
                )}
              </ul>

              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs text-slate-600">
                  La compra se coordina directamente con el feriante. La
                  municipalidad no intermedia en el pago ni en la entrega.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
