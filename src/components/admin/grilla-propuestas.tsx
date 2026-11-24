import Link from "next/link";
import type { ModalidadSelloPropio } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { IconoRegalo } from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import type { EstadoDeRevision } from "@/lib/revision";
import {
  MODALIDADES_POR_TIPO,
  MODALIDADES_SELLO_PROPIO,
  precioOrientativo,
  TIPOS_SELLO_PROPIO,
} from "@/lib/sello-propio";

export interface PropuestaDelPanel {
  id: string;
  modalidad: ModalidadSelloPropio;
  titulo: string;
  imagen: string | null;
  precio: number | null;
  precioUnidad: string | null;
  publicada: boolean;
  /** Su alta o sus cambios, si esperan revisión o los rechazaron. */
  revision: EstadoDeRevision | null;
  /** Quién la ofrece. En Mi stand no se muestra: es el que mira. */
  emprendimiento?: string;
}

/**
 * Las propuestas de Modo Feria en tarjetas, separadas en regalos y servicios.
 * La usan el panel municipal y Mi stand; cada tarjeta abre su edición. Un
 * tipo sin propuestas no se muestra.
 */
export function GrillaPropuestas({
  propuestas,
  editarEn,
}: {
  propuestas: PropuestaDelPanel[];
  /** La ruta de la edición, sin el id: «/admin/modo-feria». */
  editarEn: string;
}) {
  return (
    <div className="space-y-8">
      {(["REGALO", "SERVICIO"] as const).map((tipo) => {
        const delTipo = propuestas.filter((propuesta) =>
          MODALIDADES_POR_TIPO[tipo].includes(propuesta.modalidad),
        );
        if (delTipo.length === 0) return null;

        return (
          <section key={tipo} aria-labelledby={`tipo-${tipo}`}>
            <h2
              id={`tipo-${tipo}`}
              className="text-base font-semibold text-slate-900"
            >
              {TIPOS_SELLO_PROPIO[tipo].corto}{" "}
              <span className="font-normal text-slate-500">
                ({delTipo.length})
              </span>
            </h2>

            <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {delTipo.map((propuesta) => (
                <li key={propuesta.id}>
                  <TarjetaPropuestaPanel
                    propuesta={propuesta}
                    href={`${editarEn}/${propuesta.id}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Dónde está la propuesta, en uno o dos carteles. */
function Estados({ propuesta }: { propuesta: PropuestaDelPanel }) {
  const { publicada, revision } = propuesta;
  const carteles: Array<{
    texto: string;
    tono: "verde" | "amarillo" | "rojo" | "neutro";
  }> = [];

  if (publicada) carteles.push({ texto: "Publicada", tono: "verde" });
  if (revision?.estado === "PENDIENTE") {
    carteles.push({
      texto: publicada ? "Cambios en revisión" : "En revisión",
      tono: "amarillo",
    });
  }
  if (revision?.estado === "RECHAZADO") {
    carteles.push({
      texto: publicada ? "Cambios no aprobados" : "No se aprobó",
      tono: "rojo",
    });
  }
  if (carteles.length === 0) {
    carteles.push({ texto: "Borrador", tono: "neutro" });
  }

  return (
    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
      {carteles.map((cartel) => (
        <Badge
          key={cartel.texto}
          tono={cartel.tono}
          tamanio="sm"
          conPunto={cartel.tono !== "neutro"}
          className="bg-superficie/95"
        >
          {cartel.texto}
        </Badge>
      ))}
    </div>
  );
}

function TarjetaPropuestaPanel({
  propuesta,
  href,
}: {
  propuesta: PropuestaDelPanel;
  href: string;
}) {
  const precio = precioOrientativo(propuesta.precio, propuesta.precioUnidad);

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-superficie shadow-sm transition-all hover:-translate-y-0.5 hover:border-celeste-300 hover:shadow-md"
    >
      <div className="relative">
        <ImagenPortada
          src={propuesta.imagen}
          alt=""
          icono={IconoRegalo}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="aspect-[16/10] w-full"
        />
        <Estados propuesta={propuesta} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-slate-500">
          {MODALIDADES_SELLO_PROPIO[propuesta.modalidad]}
        </p>
        <h3 className="mt-0.5 font-semibold text-slate-900 transition-colors group-hover:text-municipal-700">
          {propuesta.titulo}
        </h3>
        {propuesta.emprendimiento && (
          <p className="mt-1 text-sm text-slate-600">
            {propuesta.emprendimiento}
          </p>
        )}
        {propuesta.revision?.estado === "RECHAZADO" &&
          propuesta.revision.motivo && (
            <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-900 ring-1 ring-red-200">
              <span className="font-semibold">Motivo:</span>{" "}
              {propuesta.revision.motivo}
            </p>
          )}
        {precio && (
          <p className="mt-auto pt-3 text-sm font-semibold text-municipal-700">
            {precio}
          </p>
        )}
      </div>
    </Link>
  );
}
