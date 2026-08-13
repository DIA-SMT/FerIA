import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoDinero, IconoDocumento } from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
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
} from "@/lib/canon";
import { prisma } from "@/lib/db";
import { formatearFecha, formatearMoneda, formatearRangoFechas } from "@/lib/format";
import { ESTADOS_PAGO, MEDIOS_PAGO, TONO_ESTADO_PAGO } from "@/lib/labels";
import { urlComprobante } from "@/lib/media";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Canon" };

export default async function PaginaCanonFeriante() {
  const { vendedor } = await requerirVendedorAprobado();

  // Ediciones en las que tiene stand asignado, con sus pagos.
  const stands = await prisma.stand.findMany({
    where: { vendedorId: vendedor.id },
    orderBy: { edicion: { fechaInicio: "desc" } },
    include: {
      edicion: {
        include: {
          feria: { select: { nombre: true } },
          pagos: {
            where: { vendedorId: vendedor.id },
            orderBy: { creadoEn: "desc" },
          },
        },
      },
    },
  });

  const permisos = stands.map((stand) => {
    const resumen = calcularResumenCanon({
      montoCanon: stand.edicion.montoCanon,
      vencimientoCanon: stand.edicion.vencimientoCanon,
      pagos: stand.edicion.pagos,
    });

    return {
      standId: stand.id,
      standNumero: stand.numero,
      edicion: stand.edicion,
      resumen,
    };
  });

  const vencidos = permisos.filter(
    (permiso) => permiso.resumen.estado === "VENCIDO",
  );

  const pagos = stands.flatMap((stand) =>
    stand.edicion.pagos.map((pago) => ({
      ...pago,
      edicionEtiqueta: stand.edicion.nombre
        ? `${stand.edicion.feria.nombre} — ${stand.edicion.nombre}`
        : stand.edicion.feria.nombre,
    })),
  );

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Canon y permisos
        </h1>
        <p className="mt-1 text-slate-600">
          Estado de tus pagos en cada edición. Los registra la Dirección de
          Ferias y Mercados: si ves algo que no corresponde, acercate a la
          oficina.
        </p>
      </header>

      {vencidos.length > 0 && (
        <Alerta
          tipo="error"
          titulo={
            vencidos.length === 1
              ? "Tenés un canon vencido"
              : `Tenés ${vencidos.length} canon vencidos`
          }
          className="mb-6"
        >
          Regularizá tu situación en la Dirección de Ferias y Mercados para
          poder seguir participando de las próximas ediciones.
        </Alerta>
      )}

      {/* ------------------------------ Permisos ---------------------------- */}
      <Tarjeta className="overflow-hidden">
        <TarjetaEncabezado
          titulo="Mis permisos"
          descripcion="Una fila por cada edición en la que tenés stand asignado."
        />

        {permisos.length === 0 ? (
          <TarjetaCuerpo>
            <EstadoVacio
              icono={IconoDinero}
              titulo="Sin permisos todavía"
              descripcion="Cuando te asignen un stand en una edición, vas a ver acá el canon que corresponde."
            />
          </TarjetaCuerpo>
        ) : (
          <Tabla>
            <TablaCabecera>
              <tr>
                <Th>Feria y edición</Th>
                <Th>Fechas</Th>
                <Th className="text-center">Stand</Th>
                <Th>Canon</Th>
                <Th>Abonado</Th>
                <Th>Saldo</Th>
                <Th>Estado</Th>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {permisos.map((permiso) => (
                <TablaFila
                  key={permiso.standId}
                  className={
                    permiso.resumen.estado === "VENCIDO" ? "bg-red-50/50" : ""
                  }
                >
                  <Td>
                    <span className="block font-medium text-slate-900">
                      {permiso.edicion.feria.nombre}
                    </span>
                    {permiso.edicion.nombre && (
                      <span className="block text-xs text-slate-500">
                        {permiso.edicion.nombre}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatearRangoFechas(
                      permiso.edicion.fechaInicio,
                      permiso.edicion.fechaFin,
                    )}
                  </Td>
                  <Td className="text-center font-semibold text-slate-900">
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
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        )}
      </Tarjeta>

      {/* --------------------------- Pagos registrados ---------------------- */}
      {pagos.length > 0 && (
        <Tarjeta className="mt-6 overflow-hidden">
          <TarjetaEncabezado
            titulo="Pagos registrados"
            descripcion="Detalle de cada pago cargado por la municipalidad."
          />
          <Tabla>
            <TablaCabecera>
              <tr>
                <Th>Edición</Th>
                <Th>Monto</Th>
                <Th>Fecha</Th>
                <Th>Medio</Th>
                <Th>Estado</Th>
                <Th>Comprobante</Th>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {pagos.map((pago) => (
                <TablaFila key={pago.id}>
                  <Td className="text-slate-700">{pago.edicionEtiqueta}</Td>
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
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}
    </>
  );
}
