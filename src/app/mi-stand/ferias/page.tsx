import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoCalendario, IconoUbicacion } from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { MisFerias } from "@/components/vendedor/mis-ferias";
import { formatearRangoFechas } from "@/lib/format";
import { resumenHorario } from "@/lib/horarios";
import { feriasDelFeriante, proximasAsignaciones } from "@/lib/mis-ferias";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Mis ferias" };

/**
 * Las ferias presenciales del feriante: en cuáles está habilitado, cuáles
 * pidió, y los stands que le asignaron en las próximas ediciones.
 *
 * Vivía en el resumen de «Mi stand». Desde que esa pantalla es el stand mismo,
 * esto tiene su pestaña: es otra pregunta —dónde voy a estar— y no tiene que
 * competir con la vidriera.
 */
export default async function PaginaMisFerias() {
  const { vendedor } = await requerirVendedorAprobado();
  const [{ postulaciones, disponibles }, asignaciones] = await Promise.all([
    feriasDelFeriante(vendedor.id),
    proximasAsignaciones(vendedor.id),
  ]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Mis ferias
        </h1>
        <p className="mt-1 text-slate-600">
          Las ferias presenciales son opcionales: tu stand online funciona
          igual.
        </p>
      </header>

      <MisFerias
        postulaciones={postulaciones}
        feriasDisponibles={disponibles}
        puedePedir
      />

      <Tarjeta className="mt-6">
        <TarjetaEncabezado
          titulo="Mis próximas ferias"
          descripcion="Las asignaciones las define la Dirección de Relaciones Institucionales."
        />
        <TarjetaCuerpo>
          {asignaciones.length === 0 ? (
            <EstadoVacio
              icono={IconoCalendario}
              titulo="Todavía no tenés stands asignados"
              descripcion="Cuando te asignen un lugar en una próxima edición, lo vas a ver acá."
              accion={
                <BotonLink href="/ferias" variante="contorno" tamanio="sm">
                  Ver ferias publicadas
                </BotonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {asignaciones.map((stand) => {
                const horario = resumenHorario(stand.edicion);

                return (
                  <li
                    key={stand.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/ferias/${stand.edicion.feria.slug}`}
                        className="font-semibold text-slate-900 transition-colors hover:text-municipal-700"
                      >
                        {stand.edicion.feria.nombre}
                      </Link>
                      {stand.edicion.nombre && (
                        <p className="text-sm text-municipal-600">
                          {stand.edicion.nombre}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <IconoCalendario className="size-4 shrink-0 text-slate-400" />
                        {formatearRangoFechas(
                          stand.edicion.fechaInicio,
                          stand.edicion.fechaFin,
                        )}
                        {horario ? ` · ${horario}` : ""}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                        <IconoUbicacion className="size-4 shrink-0 text-slate-400" />
                        {stand.edicion.feria.direccion}
                      </p>
                    </div>
                    <Badge tono="amarillo">Stand {stand.numero}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </TarjetaCuerpo>
      </Tarjeta>
    </>
  );
}
