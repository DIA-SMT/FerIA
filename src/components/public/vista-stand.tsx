import type { Rubro } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";

import { EnlaceConsulta } from "@/components/public/enlace-consulta";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DEGRADES_RUBRO } from "@/components/ui/degrades-por-rubro";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCalendario,
  IconoCorreo,
  IconoFacebook,
  IconoFlechaIzquierda,
  IconoInstagram,
  IconoTelefono,
  IconoUbicacion,
  IconoWeb,
  IconoWhatsapp,
} from "@/components/ui/iconos";
import { ICONOS_RUBRO } from "@/components/ui/iconos-por-clave";
import { ImagenPortada } from "@/components/ui/imagen";
import { cn } from "@/lib/cn";
import { formatearRangoFechas } from "@/lib/format";
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

export interface DatosVistaStand {
  id: string;
  emprendimiento: string;
  rubro: Rubro;
  descripcion: string | null;
  imagenPortada: string | null;
  logo: string | null;
  whatsapp: string;
  telefono: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  sitioWeb: string | null;
}

export interface ParticipacionVistaStand {
  id: string;
  numero: number;
  edicion: {
    fechaInicio: Date;
    fechaFin: Date;
    feria: { nombre: string; slug: string; direccion: string };
  };
}

/**
 * Los controles de edición de «Mi stand», cada uno en el lugar de lo que
 * cambia. Sin esto, la vista es la del vecino.
 */
export interface EdicionVistaStand {
  portada: ReactNode;
  logo: ReactNode;
  identidad: ReactNode;
  /**
   * Con descripción va debajo del texto; sin ella ocupa el lugar del texto,
   * porque en el stand público esa parte directamente no aparece.
   */
  descripcion: ReactNode;
  contacto: ReactNode;
  /**
   * Los carteles de revisión de cada parte («En revisión», «No se aprobó»).
   * El del logo y el del nombre van juntos debajo del encabezado, así que
   * tienen que decir de qué parte son.
   */
  revisiones?: Partial<
    Record<"portada" | "logo" | "identidad" | "descripcion" | "contacto", ReactNode>
  >;
}

const ESTILO_BOTON_WHATSAPP =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 text-base font-semibold text-white shadow-sm";

const ESTILO_ENLACE_CONTACTO =
  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-municipal-700";

/**
 * El stand de un feriante: portada, logo, descripción, catálogo, dónde
 * encontrarlo y contacto.
 *
 * Es uno solo para las dos pantallas que lo muestran —la pública, `/stands/…`,
 * y «Mi stand», donde el dueño lo edita— para que lo que ve el feriante sea
 * siempre lo que ve el vecino. Lo único que cambia con `edicion` es que
 * aparecen los lápices, y que el botón de WhatsApp deja de contar consultas:
 * las del dueño no son de nadie.
 *
 * El catálogo llega armado: el vecino ve tarjetas con «Consultar» y el dueño
 * las suyas con «Editar», más la de agregar.
 */
export function VistaStand({
  vendedor,
  participaciones,
  catalogo,
  resumenCatalogo,
  edicion,
}: {
  vendedor: DatosVistaStand;
  participaciones: ParticipacionVistaStand[];
  catalogo: ReactNode;
  /** «3 disponibles · 1 sin stock», o nada si el catálogo está vacío. */
  resumenCatalogo: string | null;
  edicion?: EdicionVistaStand;
}) {
  const propio = edicion !== undefined;

  return (
    <div>
      {/* ------------------------------ Portada ----------------------------- */}
      {/* Sin foto, la misma portada de su rubro que en el catálogo de
          emprendedores: así el stand se reconoce al entrar desde la tarjeta.
          En «Mi stand» va dentro del marco del panel, con las puntas
          redondeadas; en el público, de borde a borde. */}
      <div className="relative">
        <ImagenPortada
          src={vendedor.imagenPortada}
          alt={`Portada de ${vendedor.emprendimiento}`}
          icono={ICONOS_RUBRO[vendedor.rubro]}
          degrade={DEGRADES_RUBRO[vendedor.rubro]}
          prioridad
          sizes="100vw"
          className={cn("h-44 w-full sm:h-64", propio && "rounded-2xl")}
        />
        {edicion && (
          <div className="absolute right-3 bottom-3 z-10">
            {edicion.portada}
          </div>
        )}
        {edicion?.revisiones?.portada && (
          <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)]">
            {edicion.revisiones.portada}
          </div>
        )}
      </div>

      <div className={cn(!propio && "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8")}>
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
        <div
          className={cn(
            "relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end",
            propio && "px-4 sm:px-6",
          )}
        >
          <div className="relative -mt-12 shrink-0 self-start sm:-mt-14">
            <Avatar
              nombre={vendedor.emprendimiento}
              imagen={vendedor.logo}
              tamanio="xl"
              className="ring-4 ring-white"
            />
            {edicion && (
              <div className="absolute -right-1 -bottom-1">{edicion.logo}</div>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {vendedor.emprendimiento}
              </h1>
              {edicion?.identidad}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tono="celeste">{RUBROS[vendedor.rubro]}</Badge>
              <Badge tono="azul" tamanio="sm">
                Feriante habilitado
              </Badge>
            </div>
            {(edicion?.revisiones?.logo || edicion?.revisiones?.identidad) && (
              <div className="mt-3 flex flex-wrap items-start gap-2">
                {edicion.revisiones.logo}
                {edicion.revisiones.identidad}
              </div>
            )}
          </div>
        </div>

        {!propio && (
          <div className="mt-6">
            <Link
              href="/stands"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
            >
              <IconoFlechaIzquierda className="size-4" />
              Volver al catálogo
            </Link>
          </div>
        )}

        <div className="mt-6 grid gap-10 pb-10 lg:grid-cols-3">
          {/* --------------------------- Columna principal -------------------- */}
          <div className="lg:col-span-2">
            {edicion?.revisiones?.descripcion && (
              <div className="mb-3">{edicion.revisiones.descripcion}</div>
            )}
            {vendedor.descripcion ? (
              <section>
                <h2 className="sr-only">Sobre el emprendimiento</h2>
                <p className="text-lg whitespace-pre-line text-slate-700">
                  {vendedor.descripcion}
                </p>
                {edicion && <div className="mt-3">{edicion.descripcion}</div>}
              </section>
            ) : (
              edicion && <section>{edicion.descripcion}</section>
            )}

            {/* ---------------------------- Catálogo -------------------------- */}
            <section id="catalogo" className="mt-10 scroll-mt-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Catálogo
                </h2>
                {resumenCatalogo && (
                  <p className="text-sm text-slate-500">{resumenCatalogo}</p>
                )}
              </div>

              {catalogo}
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
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Contacto
                </h2>
                {edicion?.contacto}
              </div>
              {edicion?.revisiones?.contacto}

              {/* El botón principal de toda la vidriera. Cuenta como consulta
                  del stand y no de un producto: acá nadie nombró ninguno. En
                  «Mi stand» se muestra igual pero no es un enlace: un toque del
                  dueño contaría como una consulta que no existió. */}
              {propio ? (
                <span className={ESTILO_BOTON_WHATSAPP}>
                  <IconoWhatsapp className="size-5" />
                  Escribir por WhatsApp
                </span>
              ) : (
                <EnlaceConsulta
                  href={linkWhatsapp(
                    vendedor.whatsapp,
                    mensajeConsultaStand(vendedor.emprendimiento),
                  )}
                  evento={{ stand: vendedor.id }}
                  className={cn(
                    ESTILO_BOTON_WHATSAPP,
                    "transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                  )}
                >
                  <IconoWhatsapp className="size-5" />
                  Escribir por WhatsApp
                </EnlaceConsulta>
              )}

              <p className="text-center text-xs text-slate-500">
                {formatearWhatsapp(vendedor.whatsapp)}
              </p>

              <ul className="space-y-1 border-t border-slate-100 pt-4 text-sm">
                {vendedor.telefono && (
                  <li>
                    <a
                      href={linkTelefono(vendedor.telefono)}
                      className={ESTILO_ENLACE_CONTACTO}
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
                      className={ESTILO_ENLACE_CONTACTO}
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
                      className={ESTILO_ENLACE_CONTACTO}
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
                      className={ESTILO_ENLACE_CONTACTO}
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
                      className={ESTILO_ENLACE_CONTACTO}
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
