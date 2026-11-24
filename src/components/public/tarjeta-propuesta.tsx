import Link from "next/link";
import type { ModalidadSelloPropio } from "@prisma/client";

import { EnlaceConsulta } from "@/components/public/enlace-consulta";
import { Badge } from "@/components/ui/badge";
import {
  IconoInstagram,
  IconoRegalo,
  IconoWhatsapp,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import {
  MODALIDADES_SELLO_PROPIO,
  mensajeConsultaPropuesta,
  precioOrientativo,
  tipoDeModalidad,
} from "@/lib/sello-propio";
import { linkInstagram } from "@/lib/redes";
import { linkWhatsapp } from "@/lib/whatsapp";

/** Lo que muestra la tarjeta. Es `PropuestaPublica` de la consulta. */
export interface PropuestaParaTarjeta {
  id: string;
  modalidad: ModalidadSelloPropio;
  titulo: string;
  descripcion: string;
  imagen: string | null;
  precio: number | null;
  precioUnidad: string | null;
  minimo: string | null;
  capacidad: string | null;
  anticipacion: string | null;
  vendedor: {
    id: string;
    slug: string;
    emprendimiento: string;
    whatsapp: string;
    /** Usuario, sin @. */
    instagram: string | null;
    postulaciones: { feria: { nombre: string; slug: string } }[];
  };
}

/**
 * Una propuesta de «sello propio», con todo lo que necesita quien la va a
 * pedir: qué es, quién la hace, el precio orientativo, las condiciones y el
 * botón para escribirle al feriante. Lo que no se cargó no se muestra.
 */
export function TarjetaPropuesta({
  propuesta,
  prioridad = false,
}: {
  propuesta: PropuestaParaTarjeta;
  prioridad?: boolean;
}) {
  const { vendedor } = propuesta;
  const tipo = tipoDeModalidad(propuesta.modalidad);
  const precio = precioOrientativo(propuesta.precio, propuesta.precioUnidad);
  const ferias = vendedor.postulaciones.map((postulacion) => postulacion.feria);

  const condiciones = [
    { etiqueta: "Mínimo", valor: propuesta.minimo },
    {
      etiqueta: tipo === "SERVICIO" ? "Capacidad" : "Puede preparar",
      valor: propuesta.capacidad,
    },
    { etiqueta: "Anticipación", valor: propuesta.anticipacion },
  ].filter((condicion) => condicion.valor);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-superficie shadow-[var(--shadow-tarjeta)]">
      <div className="relative">
        {/* `alt` vacío: el título va escrito justo abajo. */}
        <ImagenPortada
          src={propuesta.imagen}
          alt=""
          icono={IconoRegalo}
          prioridad={prioridad}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="aspect-[4/3] w-full"
        />
        <Badge
          tono="celeste"
          tamanio="sm"
          className="absolute top-3 left-3 bg-superficie/95"
        >
          {MODALIDADES_SELLO_PROPIO[propuesta.modalidad]}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-lg leading-snug font-semibold text-slate-900">
          {propuesta.titulo}
        </h3>

        <p className="mt-1 text-sm text-slate-600">
          <Link
            href={`/stands/${vendedor.slug}`}
            className="font-semibold text-municipal-700 transition-colors hover:text-municipal-800 hover:underline"
          >
            {vendedor.emprendimiento}
          </Link>
          {ferias.map((feria) => (
            <span key={feria.slug}>
              {" · "}
              <Link
                href={`/ferias/${feria.slug}`}
                className="transition-colors hover:text-municipal-700 hover:underline"
              >
                {feria.nombre}
              </Link>
            </span>
          ))}
        </p>
        {vendedor.instagram && (
          <a
            href={linkInstagram(vendedor.instagram)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 self-start text-sm text-slate-600 transition-colors hover:text-municipal-700"
          >
            <IconoInstagram className="size-4" />@{vendedor.instagram}
          </a>
        )}

        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-700">
          {propuesta.descripcion}
        </p>

        {(precio || condiciones.length > 0) && (
          <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
            {precio && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt className="text-slate-500">Precio orientativo</dt>
                <dd className="text-base font-bold text-municipal-700">
                  {precio}
                </dd>
              </div>
            )}
            {condiciones.map((condicion) => (
              <div
                key={condicion.etiqueta}
                className="flex flex-wrap items-baseline justify-between gap-x-3"
              >
                <dt className="text-slate-500">{condicion.etiqueta}</dt>
                <dd className="text-right font-medium text-slate-800">
                  {condicion.valor}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-auto pt-5">
          <EnlaceConsulta
            href={linkWhatsapp(
              vendedor.whatsapp,
              mensajeConsultaPropuesta(propuesta.titulo, tipo),
            )}
            evento={{ stand: vendedor.id }}
            className="paleta-original inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <IconoWhatsapp className="size-5" />
            Consultar por WhatsApp
          </EnlaceConsulta>
        </div>
      </div>
    </article>
  );
}
