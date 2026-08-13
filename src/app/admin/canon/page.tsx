import Link from "next/link";

import { eliminarPago, marcarComoPagado } from "@/actions/canon";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FiltrosCanon } from "@/components/admin/filtros-canon";
import { TarjetaMetrica } from "@/components/admin/graficos";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoAlerta,
  IconoDinero,
  IconoDocumento,
  IconoLapiz,
  IconoMas,
} from "@/components/ui/iconos";
import { Tarjeta, TarjetaEncabezado } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaFila,
  Td,
  Th,
} from "@/components/ui/tabla";
import {
  calcularResumenCanon,
  detalleVencimiento,
  ESTADOS_PERMISO,
  TONO_ESTADO_PERMISO,
  type EstadoPermiso,
} from "@/lib/canon";
import { prisma } from "@/lib/db";
import { aNumero, formatearFecha, formatearMoneda } from "@/lib/format";
import { urlComprobante } from "@/lib/media";
import {
  ESTADOS_PAGO,
  MEDIOS_PAGO,
  TONO_ESTADO_PAGO,
} from "@/lib/labels";

export const metadata = { title: "Canon y permisos" };

const ESTADOS_PERMISO_VALIDOS = new Set(Object.keys(ESTADOS_PERMISO));

export default async function PaginaCanon({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string; estado?: string }>;
}) {
  const params = await searchParams;
  const filtroEstado =
    params.estado && ESTADOS_PERMISO_VALIDOS.has(params.estado)
      ? (params.estado as EstadoPermiso)
      : "";

  // Ediciones que cobran canon (las únicas con permisos que controlar).
  const ediciones = await prisma.edicionFeria.findMany({
    orderBy: { fechaInicio: "desc" },
    include: {
      feria: { select: { nombre: true } },
      stands: {
        where: { vendedorId: { not: null } },
        select: {
          numero: true,
          vendedor: {
            select: { id: true, emprendimiento: true, slug: true },
          },
        },
      },
      pagos: {
        orderBy: { creadoEn: "desc" },
        include: {
          vendedor: { select: { id: true, emprendimiento: true } },
        },
      },
    },
  });

  const opcionesEdicion = ediciones.map((edicion) => ({
    id: edicion.id,
    etiqueta: edicion.nombre
      ? `${edicion.feria.nombre} — ${edicion.nombre}`
      : edicion.feria.nombre,
  }));

  const filtroEdicion = ediciones.some((e) => e.id === params.edicion)
    ? (params.edicion ?? "")
    : "";

  const edicionesFiltradas = filtroEdicion
    ? ediciones.filter((edicion) => edicion.id === filtroEdicion)
    : ediciones;

  // ------------------------- Permisos (obligaciones) ------------------------
  const permisos = edicionesFiltradas.flatMap((edicion) =>
    edicion.stands
      .filter((stand) => stand.vendedor !== null)
      .map((stand) => {
        const vendedor = stand.vendedor!;
        const pagos = edicion.pagos.filter(
          (pago) => pago.vendedorId === vendedor.id,
        );
        const resumen = calcularResumenCanon({
          montoCanon: edicion.montoCanon,
          vencimientoCanon: edicion.vencimientoCanon,
          pagos,
        });

        const pagoPendiente = pagos.find((pago) => pago.estado === "PENDIENTE");

        return {
          clave: `${edicion.id}-${vendedor.id}`,
          edicionId: edicion.id,
          edicionEtiqueta: edicion.nombre
            ? `${edicion.feria.nombre} — ${edicion.nombre}`
            : edicion.feria.nombre,
          standNumero: stand.numero,
          vendedor,
          vencimiento: edicion.vencimientoCanon,
          resumen,
          pagoPendienteId: pagoPendiente?.id ?? null,
        };
      }),
  );

  const permisosFiltrados = filtroEstado
    ? permisos.filter((permiso) => permiso.resumen.estado === filtroEstado)
    : permisos;

  // Primero los vencidos: es lo que la Dirección necesita ver arriba.
  const ORDEN: Record<EstadoPermiso, number> = {
    VENCIDO: 0,
    PENDIENTE: 1,
    AL_DIA: 2,
    SIN_CANON: 3,
  };
  permisosFiltrados.sort(
    (a, b) => ORDEN[a.resumen.estado] - ORDEN[b.resumen.estado],
  );

  // ------------------------------- Métricas --------------------------------
  const vencidos = permisos.filter((p) => p.resumen.estado === "VENCIDO");
  const pendientes = permisos.filter((p) => p.resumen.estado === "PENDIENTE");
  const adeudado = vencidos.reduce((suma, p) => suma + p.resumen.saldo, 0);
  const recaudado = edicionesFiltradas
    .flatMap((edicion) => edicion.pagos)
    .filter((pago) => pago.estado === "PAGADO")
    .reduce((suma, pago) => suma + aNumero(pago.monto), 0);

  const pagos = edicionesFiltradas.flatMap((edicion) =>
    edicion.pagos.map((pago) => ({
      ...pago,
      edicionEtiqueta: edicion.nombre
        ? `${edicion.feria.nombre} — ${edicion.nombre}`
        : edicion.feria.nombre,
    })),
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Canon y permisos"
        descripcion="Estado del canon de cada feriante por edición. El permiso se calcula con lo abonado y la fecha de vencimiento."
        acciones={
          <BotonLink href="/admin/canon/nuevo">
            <IconoMas className="size-4" />
            Registrar pago
          </BotonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaMetrica
          etiqueta="Recaudado"
          valor={formatearMoneda(recaudado)}
          detalle={filtroEdicion ? "En la edición filtrada" : "Histórico total"}
          icono={IconoDinero}
          tono="verde"
        />
        <TarjetaMetrica
          etiqueta="Permisos vencidos"
          valor={vencidos.length}
          detalle="Canon impago con vencimiento pasado"
          icono={IconoAlerta}
          tono={vencidos.length > 0 ? "rojo" : "neutro"}
        />
        <TarjetaMetrica
          etiqueta="Monto adeudado"
          valor={formatearMoneda(adeudado)}
          detalle="Saldo de los permisos vencidos"
          tono={adeudado > 0 ? "rojo" : "neutro"}
        />
        <TarjetaMetrica
          etiqueta="Pendientes en plazo"
          valor={pendientes.length}
          detalle="Todavía dentro de la fecha de pago"
          tono={pendientes.length > 0 ? "amarillo" : "neutro"}
        />
      </div>

      <div className="mt-6">
        <FiltrosCanon
          valores={{ edicion: filtroEdicion, estado: filtroEstado }}
          ediciones={opcionesEdicion}
        />
      </div>

      {/* ------------------------------ Permisos ---------------------------- */}
      <Tarjeta className="mt-5 overflow-hidden">
        <TarjetaEncabezado
          titulo="Permisos por feriante y edición"
          descripcion={`${permisosFiltrados.length} ${
            permisosFiltrados.length === 1 ? "registro" : "registros"
          }`}
        />

        {permisosFiltrados.length === 0 ? (
          <div className="p-4">
            <EstadoVacio
              icono={IconoDinero}
              titulo="Sin registros"
              descripcion="No hay feriantes asignados que coincidan con los filtros seleccionados."
            />
          </div>
        ) : (
          <Tabla>
            <TablaCabecera>
              <tr>
                <Th>Feriante</Th>
                <Th>Edición</Th>
                <Th className="text-center">Stand</Th>
                <Th>Canon</Th>
                <Th>Abonado</Th>
                <Th>Saldo</Th>
                <Th>Vence</Th>
                <Th>Permiso</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {permisosFiltrados.map((permiso) => (
                <TablaFila
                  key={permiso.clave}
                  className={
                    permiso.resumen.estado === "VENCIDO" ? "bg-red-50/50" : ""
                  }
                >
                  <Td>
                    <Link
                      href={`/stands/${permiso.vendedor.slug}`}
                      target="_blank"
                      className="font-medium text-slate-900 transition-colors hover:text-municipal-700"
                    >
                      {permiso.vendedor.emprendimiento}
                    </Link>
                  </Td>
                  <Td className="text-slate-600">
                    <Link
                      href={`/admin/ediciones/${permiso.edicionId}`}
                      className="transition-colors hover:text-municipal-700"
                    >
                      {permiso.edicionEtiqueta}
                    </Link>
                  </Td>
                  <Td className="text-center tabular-nums">
                    {permiso.standNumero}
                  </Td>
                  <Td className="tabular-nums">
                    {formatearMoneda(permiso.resumen.montoCanon)}
                  </Td>
                  <Td className="tabular-nums">
                    {formatearMoneda(permiso.resumen.totalPagado)}
                  </Td>
                  <Td className="tabular-nums">
                    {permiso.resumen.saldo > 0 ? (
                      <span className="font-semibold text-red-600">
                        {formatearMoneda(permiso.resumen.saldo)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatearFecha(permiso.vencimiento)}
                  </Td>
                  <Td>
                    <Badge
                      tono={TONO_ESTADO_PERMISO[permiso.resumen.estado]}
                      tamanio="sm"
                      conPunto={permiso.resumen.estado === "VENCIDO"}
                    >
                      {ESTADOS_PERMISO[permiso.resumen.estado]}
                    </Badge>
                    {detalleVencimiento(permiso.resumen) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {detalleVencimiento(permiso.resumen)}
                      </p>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {permiso.pagoPendienteId ? (
                        <BotonConfirmar
                          accion={marcarComoPagado}
                          campos={{ pagoId: permiso.pagoPendienteId }}
                          confirmacion={`¿Marcar como pagado el canon de ${permiso.vendedor.emprendimiento}? Se registra con fecha de hoy y medio "Efectivo"; podés corregirlo después.`}
                          variante="secundario"
                        >
                          Marcar pagado
                        </BotonConfirmar>
                      ) : (
                        permiso.resumen.saldo > 0 && (
                          <Link
                            href={`/admin/canon/nuevo?edicion=${permiso.edicionId}&vendedor=${permiso.vendedor.id}`}
                            className="text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                          >
                            Registrar pago
                          </Link>
                        )
                      )}
                    </div>
                  </Td>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        )}
      </Tarjeta>

      {/* --------------------------- Pagos registrados ---------------------- */}
      <Tarjeta className="mt-6 overflow-hidden">
        <TarjetaEncabezado
          titulo="Pagos registrados"
          descripcion={`${pagos.length} ${
            pagos.length === 1 ? "comprobante" : "comprobantes"
          } cargados`}
        />

        {pagos.length === 0 ? (
          <div className="p-4">
            <EstadoVacio
              icono={IconoDocumento}
              titulo="Sin pagos registrados"
              descripcion="Registrá el primer pago de canon para llevar el control."
            />
          </div>
        ) : (
          <Tabla>
            <TablaCabecera>
              <tr>
                <Th>Feriante</Th>
                <Th>Edición</Th>
                <Th>Monto</Th>
                <Th>Fecha</Th>
                <Th>Medio</Th>
                <Th>Estado</Th>
                <Th>Comprobante</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {pagos.map((pago) => (
                <TablaFila key={pago.id}>
                  <Td className="font-medium text-slate-900">
                    {pago.vendedor.emprendimiento}
                  </Td>
                  <Td className="text-slate-600">{pago.edicionEtiqueta}</Td>
                  <Td className="tabular-nums">{formatearMoneda(pago.monto)}</Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatearFecha(pago.fechaPago)}
                  </Td>
                  <Td className="text-slate-500">
                    {pago.medio ? MEDIOS_PAGO[pago.medio] : "—"}
                  </Td>
                  <Td>
                    <Badge tono={TONO_ESTADO_PAGO[pago.estado]} tamanio="sm">
                      {ESTADOS_PAGO[pago.estado]}
                    </Badge>
                  </Td>
                  <Td>
                    {pago.comprobante ? (
                      <a
                        href={urlComprobante(pago.comprobante) ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 hover:text-municipal-700"
                      >
                        <IconoDocumento className="size-4" />
                        Ver
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/canon/${pago.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                      >
                        <IconoLapiz className="size-3.5" />
                        Editar
                      </Link>
                      <BotonConfirmar
                        accion={eliminarPago}
                        campos={{ pagoId: pago.id }}
                        confirmacion={`¿Eliminar el pago de ${formatearMoneda(pago.monto)} de ${pago.vendedor.emprendimiento}? Esta acción no se puede deshacer.`}
                        variante="fantasma"
                        className="text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </BotonConfirmar>
                    </div>
                  </Td>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        )}
      </Tarjeta>
    </>
  );
}
