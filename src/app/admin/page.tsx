import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import {
  BarraOcupacion,
  GraficoBarras,
  GraficoDona,
  TarjetaMetrica,
} from "@/components/admin/graficos";
import { Alerta } from "@/components/ui/alerta";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoBandeja,
  IconoCalendario,
  IconoDinero,
  IconoGrilla,
  IconoTienda,
  IconoUsuarios,
} from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { obtenerEstadisticas } from "@/lib/estadisticas";
import { formatearMoneda } from "@/lib/format";

export const metadata = { title: "Estadísticas" };

export default async function PaginaAdmin() {
  const datos = await obtenerEstadisticas();

  const librados = datos.standsTotales - datos.standsOcupados;

  return (
    <>
      <EncabezadoPagina
        titulo="Estadísticas"
        descripcion="Resumen de la actividad de las ferias municipales."
      />

      {datos.solicitudesPendientes > 0 && (
        <Alerta
          tipo="advertencia"
          titulo={
            datos.solicitudesPendientes === 1
              ? "Hay 1 solicitud esperando revisión"
              : `Hay ${datos.solicitudesPendientes} solicitudes esperando revisión`
          }
          className="mb-6"
        >
          <Link
            href="/admin/solicitudes"
            className="font-medium underline underline-offset-2"
          >
            Ir a la bandeja de solicitudes
          </Link>
        </Alerta>
      )}

      {datos.feriantesEnMora > 0 && (
        <Alerta
          tipo="error"
          titulo={
            datos.feriantesEnMora === 1
              ? "1 feriante con el canon vencido"
              : `${datos.feriantesEnMora} feriantes con el canon vencido`
          }
          className="mb-6"
        >
          Adeudan {formatearMoneda(datos.montoAdeudado)} en total.{" "}
          <Link
            href="/admin/canon?estado=VENCIDO"
            className="font-medium underline underline-offset-2"
          >
            Ver el detalle
          </Link>
        </Alerta>
      )}

      {/* ----------------------------- Métricas ---------------------------- */}
      <section aria-label="Métricas principales">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaMetrica
            etiqueta="Ferias activas"
            valor={datos.feriasActivas}
            detalle={`${datos.edicionesVigentes} ${
              datos.edicionesVigentes === 1
                ? "edición vigente"
                : "ediciones vigentes"
            }`}
            icono={IconoTienda}
            tono="azul"
          />
          <TarjetaMetrica
            etiqueta="Feriantes activos"
            valor={datos.feriantesAprobados}
            detalle="Aprobados y publicados en el market"
            icono={IconoUsuarios}
          />
          <TarjetaMetrica
            etiqueta="Solicitudes pendientes"
            valor={datos.solicitudesPendientes}
            detalle={
              datos.solicitudesPendientes > 0
                ? "Requieren revisión"
                : "Bandeja al día"
            }
            icono={IconoBandeja}
            tono={datos.solicitudesPendientes > 0 ? "amarillo" : "verde"}
          />
          <TarjetaMetrica
            etiqueta="Recaudación acumulada"
            valor={formatearMoneda(datos.recaudacionAcumulada)}
            detalle="Canon efectivamente cobrado"
            icono={IconoDinero}
            tono="verde"
          />
        </div>
      </section>

      {/* ---------------------------- Ocupación ---------------------------- */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-1">
          <TarjetaEncabezado
            titulo="Ocupación de stands"
            descripcion="En las ediciones vigentes"
          />
          <TarjetaCuerpo>
            {datos.standsTotales === 0 ? (
              <EstadoVacio
                icono={IconoGrilla}
                titulo="Sin stands"
                descripcion="No hay ediciones vigentes con stands definidos."
              />
            ) : (
              <GraficoDona
                valor={datos.standsOcupados}
                total={datos.standsTotales}
                etiqueta="Ocupados"
                etiquetaResto="Libres"
              />
            )}
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta className="lg:col-span-2">
          <TarjetaEncabezado
            titulo="Ocupación por edición"
            descripcion={`${datos.standsOcupados} ocupados · ${librados} libres`}
          />
          <TarjetaCuerpo>
            {datos.ocupacionPorEdicion.length === 0 ? (
              <EstadoVacio
                icono={IconoCalendario}
                titulo="Sin ediciones vigentes"
                descripcion="Publicá una edición para empezar a asignar stands."
              />
            ) : (
              <ul className="space-y-3">
                {datos.ocupacionPorEdicion.map((edicion) => (
                  <li
                    key={edicion.id}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <Link
                      href={`/admin/ediciones/${edicion.id}`}
                      className="min-w-0 flex-1 truncate text-sm text-slate-700 transition-colors hover:text-municipal-700"
                    >
                      {edicion.etiqueta}
                    </Link>
                    <BarraOcupacion
                      ocupados={edicion.ocupados}
                      total={edicion.total}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TarjetaCuerpo>
        </Tarjeta>
      </section>

      {/* ------------------------ Rubros y recaudación --------------------- */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <TarjetaEncabezado
            titulo="Feriantes por rubro"
            descripcion="Sólo emprendimientos aprobados"
          />
          <TarjetaCuerpo>
            <GraficoBarras
              datos={datos.feriantesPorRubro}
              color="municipal"
              vacio="Todavía no hay feriantes aprobados."
            />
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta>
          <TarjetaEncabezado
            titulo="Recaudación por edición"
            descripcion="Canon cobrado, histórico"
            accion={
              <Link
                href="/admin/canon"
                className="text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
              >
                Ver canon
              </Link>
            }
          />
          <TarjetaCuerpo>
            <GraficoBarras
              datos={datos.recaudacionPorEdicion.map((fila) => ({
                etiqueta: fila.etiqueta,
                valor: fila.valor,
                valorTexto: formatearMoneda(fila.valor),
              }))}
              color="celeste"
              vacio="Todavía no se registraron pagos de canon."
            />
          </TarjetaCuerpo>
        </Tarjeta>
      </section>
    </>
  );
}
