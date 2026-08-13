import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  IconoCalendario,
  IconoTienda,
  IconoUbicacion,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { formatearRangoFechas } from "@/lib/format";
import { CATEGORIAS_FERIA, ESTADOS_EDICION } from "@/lib/labels";
import type { CategoriaFeria, EstadoEdicion } from "@prisma/client";

export interface FeriaResumida {
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaFeria;
  direccion: string;
  imagen: string | null;
  proximaEdicion: {
    fechaInicio: Date;
    fechaFin: Date;
    estado: EstadoEdicion;
    standsOcupados: number;
  } | null;
}

export function TarjetaFeria({
  feria,
  prioridad = false,
}: {
  feria: FeriaResumida;
  prioridad?: boolean;
}) {
  const edicion = feria.proximaEdicion;
  const enCurso = edicion?.estado === "EN_CURSO";

  return (
    <Link
      href={`/ferias/${feria.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-tarjeta)] transition-all hover:-translate-y-0.5 hover:border-celeste-300 hover:shadow-[var(--shadow-tarjeta-hover)]"
    >
      <div className="relative">
        <ImagenPortada
          src={feria.imagen}
          alt={feria.nombre}
          icono={IconoTienda}
          prioridad={prioridad}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="aspect-[16/10] w-full"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge tono="celeste" tamanio="sm" className="bg-white/95">
            {CATEGORIAS_FERIA[feria.categoria]}
          </Badge>
          {enCurso && (
            <Badge tono="verde" tamanio="sm" conPunto className="bg-white/95">
              {ESTADOS_EDICION.EN_CURSO}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold text-slate-900 transition-colors group-hover:text-municipal-700">
          {feria.nombre}
        </h3>

        <p className="lineas-2 mt-1.5 text-sm text-slate-600">
          {feria.descripcion}
        </p>

        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-start gap-2 text-slate-600">
            <dt className="sr-only">Ubicación</dt>
            <IconoUbicacion className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <dd className="lineas-2">{feria.direccion}</dd>
          </div>

          <div className="flex items-start gap-2">
            <dt className="sr-only">Próxima edición</dt>
            <IconoCalendario className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <dd
              className={
                edicion
                  ? "font-medium text-municipal-700"
                  : "text-slate-500 italic"
              }
            >
              {edicion
                ? formatearRangoFechas(edicion.fechaInicio, edicion.fechaFin)
                : "Sin ediciones programadas"}
            </dd>
          </div>
        </dl>

        {edicion && edicion.standsOcupados > 0 && (
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {edicion.standsOcupados}{" "}
            {edicion.standsOcupados === 1
              ? "feriante confirmado"
              : "feriantes confirmados"}
          </p>
        )}
      </div>
    </Link>
  );
}
