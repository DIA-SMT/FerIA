import Link from "next/link";
import type { EstadoPostulacion } from "@prisma/client";

import {
  FormularioPostulacion,
  type FeriaDisponible,
} from "@/components/vendedor/formulario-postulacion";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { formatearFecha } from "@/lib/format";
import { ESTADOS_POSTULACION, TONO_ESTADO_POSTULACION } from "@/lib/labels";

export interface PostulacionDelFeriante {
  id: string;
  estado: EstadoPostulacion;
  motivoRechazo: string | null;
  creadoEn: Date;
  revisadoEn: Date | null;
  feria: { nombre: string; slug: string };
}

/**
 * Las ferias del feriante: a cuáles entró, cuáles está esperando.
 *
 * Es la respuesta a «¿cuál es mi feria?», que hasta ahora la aplicación no
 * podía contestar: un feriante aprobado veía stands asignados o no veía nada,
 * sin ningún lugar donde constara a qué feria pertenece.
 *
 * Aceptada y asignada son cosas distintas y se muestran separadas a propósito:
 * «sos feriante de la Feria de Artesanos» lo decide la Dirección acá, y «te
 * toca el puesto 14 de la edición de noviembre» lo decide después, al armar el
 * mapa. Mezclarlas haría que alguien aceptado creyera que tiene lugar.
 */
export function MisFerias({
  postulaciones,
  feriasDisponibles,
}: {
  postulaciones: PostulacionDelFeriante[];
  feriasDisponibles: FeriaDisponible[];
}) {
  const aceptadas = postulaciones.filter((p) => p.estado === "ACEPTADA");
  const otras = postulaciones.filter((p) => p.estado !== "ACEPTADA");

  return (
    <Tarjeta>
      <TarjetaEncabezado
        titulo="Mis ferias"
        descripcion="De qué ferias sos parte y qué postulaciones tenés en curso."
      />
      <TarjetaCuerpo className="space-y-5">
        {postulaciones.length === 0 ? (
          <p className="text-sm text-slate-600">
            Todavía no te postulaste a ninguna feria.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...aceptadas, ...otras].map((postulacion) => (
              <li
                key={postulacion.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/ferias/${postulacion.feria.slug}`}
                    className="font-semibold text-slate-900 transition-colors hover:text-municipal-700"
                  >
                    {postulacion.feria.nombre}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {postulacion.estado === "PENDIENTE"
                      ? `Te postulaste el ${formatearFecha(postulacion.creadoEn)}`
                      : postulacion.revisadoEn
                        ? `Resuelta el ${formatearFecha(postulacion.revisadoEn)}`
                        : null}
                  </p>
                  {postulacion.motivoRechazo && (
                    <p className="mt-1 text-sm text-red-900">
                      {postulacion.motivoRechazo}
                    </p>
                  )}
                </div>
                <Badge
                  tono={TONO_ESTADO_POSTULACION[postulacion.estado]}
                  conPunto
                >
                  {ESTADOS_POSTULACION[postulacion.estado]}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {aceptadas.length > 0 && (
          <Alerta tipo="info">
            Ser feriante de una feria no reserva un puesto: la Dirección te
            asigna un número de stand cuando arma cada edición, y ahí lo vas a
            ver en «Mis próximas ferias».
          </Alerta>
        )}

        <div className="border-t border-slate-100 pt-4">
          <FormularioPostulacion ferias={feriasDisponibles} />
        </div>
      </TarjetaCuerpo>
    </Tarjeta>
  );
}
