import Link from "next/link";
import type { EstadoPostulacion } from "@prisma/client";

import { retirarmeDeFeria } from "@/actions/postulaciones";

import {
  FormularioPostulacion,
  type FeriaDisponible,
} from "@/components/vendedor/formulario-postulacion";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
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
  puedePedir,
}: {
  postulaciones: PostulacionDelFeriante[];
  feriasDisponibles: FeriaDisponible[];
  /** Si la ficha ya está aprobada: sin alta no se puede pedir una feria. */
  puedePedir: boolean;
}) {
  const aceptadas = postulaciones.filter((p) => p.estado === "ACEPTADA");
  const otras = postulaciones.filter((p) => p.estado !== "ACEPTADA");

  return (
    <Tarjeta>
      <TarjetaEncabezado
        titulo="Mis ferias presenciales"
        descripcion="En qué ferias estás habilitado y qué pedidos tenés en curso. Es opcional: podés tener sólo tu stand online."
      />
      <TarjetaCuerpo className="space-y-5">
        {postulaciones.length === 0 ? (
          <p className="text-sm text-slate-600">
            Todavía no pediste ninguna feria presencial.
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
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    tono={TONO_ESTADO_POSTULACION[postulacion.estado]}
                    conPunto
                  >
                    {ESTADOS_POSTULACION[postulacion.estado]}
                  </Badge>

                  {/* Bajarse es decisión del feriante y no se le pide motivo,
                      a diferencia de un rechazo. Lo que no hace es liberar el
                      puesto: si la Dirección ya le asignó uno en una edición
                      que no pasó, sigue asignado y a ellos les aparece marcado
                      para liberarlo. Un click no cambia un mapa publicado. */}
                  {(postulacion.estado === "ACEPTADA" ||
                    postulacion.estado === "PENDIENTE") && (
                    <BotonConfirmar
                      accion={retirarmeDeFeria}
                      campos={{ postulacionId: postulacion.id }}
                      variante="fantasma"
                      className="text-slate-500 hover:text-red-700"
                      confirmacion={
                        postulacion.estado === "ACEPTADA"
                          ? `¿Bajarte de ${postulacion.feria.nombre}? Tu stand online sigue publicado y podés volver a pedirla cuando quieras.`
                          : `¿Cancelar tu pedido para ${postulacion.feria.nombre}?`
                      }
                    >
                      {postulacion.estado === "ACEPTADA"
                        ? "Bajarme"
                        : "Cancelar"}
                    </BotonConfirmar>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {aceptadas.length > 0 && (
          <Alerta tipo="info">
Estar habilitado en una feria no reserva un puesto: la Dirección te asigna un número de stand cuando arma cada edición, y ahí lo vas a ver en «Mis próximas ferias».
          </Alerta>
        )}

        <div className="border-t border-slate-100 pt-4">
          {/* Pedir una feria es el segundo permiso y necesita el primero. Con
              el alta en revisión el formulario se oculta en vez de mostrarse y
              rebotar: la acción también lo rechaza, pero enterarse después de
              escribir el mensaje es peor que no poder empezar. */}
          {puedePedir ? (
            <FormularioPostulacion ferias={feriasDisponibles} />
          ) : (
            <p className="text-sm text-slate-500">
              Vas a poder pedir ferias presenciales cuando te den el alta.
            </p>
          )}
        </div>
      </TarjetaCuerpo>
    </Tarjeta>
  );
}
