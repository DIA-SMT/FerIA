import Link from "next/link";
import { notFound } from "next/navigation";

import { eliminarEdicion } from "@/actions/ediciones";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { GraficoDona, TarjetaMetrica } from "@/components/admin/graficos";
import { GrillaStands } from "@/components/admin/grilla-stands";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import {
  IconoCalendario,
  IconoDinero,
  IconoLapiz,
  IconoMas,
  IconoReloj,
  IconoTacho,
} from "@/components/ui/iconos";
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
import {
  aNumero,
  formatearFecha,
  formatearMoneda,
  formatearRangoFechas,
} from "@/lib/format";
import { ESTADOS_EDICION, RUBROS, TONO_ESTADO_EDICION } from "@/lib/labels";

export const metadata = { title: "Stands de la edición" };

export default async function PaginaEdicion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [edicion, vendedores] = await Promise.all([
    prisma.edicionFeria.findUnique({
      where: { id },
      include: {
        feria: { select: { id: true, nombre: true } },
        stands: {
          orderBy: { numero: "asc" },
          include: {
            vendedor: {
              select: { id: true, emprendimiento: true, rubro: true, slug: true },
            },
          },
        },
        pagos: {
          select: {
            vendedorId: true,
            monto: true,
            estado: true,
            fechaPago: true,
          },
        },
      },
    }),
    prisma.vendedor.findMany({
      where: { estado: "APROBADO" },
      select: { id: true, emprendimiento: true, rubro: true },
      orderBy: { emprendimiento: "asc" },
    }),
  ]);

  if (!edicion) notFound();

  const ocupados = edicion.stands.filter((stand) => stand.vendedor !== null);
  const montoCanon = aNumero(edicion.montoCanon);

  // Canon esperado = canon × feriantes asignados.
  const canonEsperado = montoCanon * ocupados.length;
  const canonRecaudado = edicion.pagos
    .filter((pago) => pago.estado === "PAGADO")
    .reduce((suma, pago) => suma + aNumero(pago.monto), 0);

  const filasCanon = ocupados
    .map((stand) => {
      const vendedor = stand.vendedor;
      if (!vendedor) return null;

      const pagos = edicion.pagos.filter(
        (pago) => pago.vendedorId === vendedor.id,
      );
      const resumen = calcularResumenCanon({
        montoCanon: edicion.montoCanon,
        vencimientoCanon: edicion.vencimientoCanon,
        pagos,
      });

      const ultimoPago = pagos
        .filter((pago) => pago.estado === "PAGADO" && pago.fechaPago)
        .sort(
          (a, b) => (b.fechaPago?.getTime() ?? 0) - (a.fechaPago?.getTime() ?? 0),
        )[0];

      return {
        standNumero: stand.numero,
        vendedor,
        resumen,
        fechaUltimoPago: ultimoPago?.fechaPago ?? null,
      };
    })
    .filter((fila): fila is NonNullable<typeof fila> => fila !== null);

  const titulo = edicion.nombre ?? "Edición sin nombre";

  return (
    <>
      <EncabezadoPagina
        titulo={titulo}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <IconoCalendario className="size-4 text-slate-400" />
              {formatearRangoFechas(edicion.fechaInicio, edicion.fechaFin)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconoReloj className="size-4 text-slate-400" />
              {edicion.horario}
            </span>
            <Badge
              tono={TONO_ESTADO_EDICION[edicion.estado]}
              tamanio="sm"
              conPunto={edicion.estado === "EN_CURSO"}
            >
              {ESTADOS_EDICION[edicion.estado]}
            </Badge>
          </span>
        }
        migas={[
          { href: "/admin/ferias", texto: "Ferias" },
          { href: `/admin/ferias/${edicion.feria.id}`, texto: edicion.feria.nombre },
          { texto: titulo },
        ]}
        acciones={
          <>
            <BotonLink
              href={`/admin/canon/nuevo?edicion=${edicion.id}`}
              variante="contorno"
              tamanio="sm"
            >
              <IconoMas className="size-4" />
              Registrar pago
            </BotonLink>
            <BotonLink
              href={`/admin/ediciones/${edicion.id}/editar`}
              variante="secundario"
              tamanio="sm"
            >
              <IconoLapiz className="size-4" />
              Editar edición
            </BotonLink>
          </>
        }
      />

      {/* ------------------------------ Métricas ---------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaMetrica
          etiqueta="Stands ocupados"
          valor={`${ocupados.length} / ${edicion.stands.length}`}
          detalle={`${edicion.stands.length - ocupados.length} libres`}
          tono="azul"
        />
        <TarjetaMetrica
          etiqueta="Canon por feriante"
          valor={formatearMoneda(edicion.montoCanon)}
          detalle={
            edicion.vencimientoCanon
              ? `Vence el ${formatearFecha(edicion.vencimientoCanon)}`
              : "Sin fecha de vencimiento"
          }
          icono={IconoDinero}
        />
        <TarjetaMetrica
          etiqueta="Canon esperado"
          valor={formatearMoneda(canonEsperado)}
          detalle="Canon × feriantes asignados"
        />
        <TarjetaMetrica
          etiqueta="Recaudado"
          valor={formatearMoneda(canonRecaudado)}
          detalle={
            canonEsperado > 0
              ? `${Math.round((canonRecaudado / canonEsperado) * 100)}% del esperado`
              : "Esta edición no cobra canon"
          }
          tono={
            canonEsperado > 0 && canonRecaudado >= canonEsperado
              ? "verde"
              : "neutro"
          }
        />
      </div>

      {/* ------------------------------- Grilla ----------------------------- */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <TarjetaEncabezado
            titulo="Grilla de stands"
            descripcion="Tocá un stand para asignarle un feriante o liberarlo."
          />
          <TarjetaCuerpo>
            <GrillaStands
              stands={edicion.stands.map((stand) => ({
                id: stand.id,
                numero: stand.numero,
                vendedor: stand.vendedor,
              }))}
              vendedores={vendedores}
            />
          </TarjetaCuerpo>
        </Tarjeta>

        <div className="space-y-5">
          <Tarjeta>
            <TarjetaEncabezado titulo="Ocupación" />
            <TarjetaCuerpo>
              <GraficoDona
                valor={ocupados.length}
                total={edicion.stands.length}
                etiqueta="Ocupados"
                etiquetaResto="Libres"
              />
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta className="border-red-200">
            <TarjetaEncabezado
              titulo="Eliminar edición"
              descripcion="Se borran sus stands y los pagos de canon asociados."
              className="border-red-100"
            />
            <TarjetaCuerpo>
              <BotonConfirmar
                accion={eliminarEdicion}
                campos={{ edicionId: edicion.id }}
                confirmacion={`¿Eliminar la edición "${titulo}"? Se van a borrar sus ${edicion.stands.length} stands y los pagos de canon registrados. Esta acción no se puede deshacer.`}
                tamanio="md"
              >
                <IconoTacho className="size-4" />
                Eliminar edición
              </BotonConfirmar>
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      </div>

      {/* -------------------------- Canon de la edición --------------------- */}
      <Tarjeta className="mt-6">
        <TarjetaEncabezado
          titulo="Canon de los feriantes asignados"
          descripcion="El estado del permiso se calcula con lo abonado y la fecha de vencimiento."
          accion={
            <Link
              href={`/admin/canon?edicion=${edicion.id}`}
              className="text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
            >
              Gestionar pagos
            </Link>
          }
        />

        {filasCanon.length === 0 ? (
          <TarjetaCuerpo>
            <p className="py-6 text-center text-sm text-slate-500">
              Todavía no hay feriantes asignados a esta edición.
            </p>
          </TarjetaCuerpo>
        ) : (
          <Tabla>
            <TablaCabecera>
              <tr>
                <Th>Stand</Th>
                <Th>Feriante</Th>
                <Th>Rubro</Th>
                <Th>Abonado</Th>
                <Th>Saldo</Th>
                <Th>Permiso</Th>
                <Th>Último pago</Th>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {filasCanon.map((fila) => (
                <TablaFila key={fila.vendedor.id}>
                  <Td className="font-semibold text-slate-900">
                    {fila.standNumero}
                  </Td>
                  <Td>
                    <Link
                      href={`/stands/${fila.vendedor.slug}`}
                      target="_blank"
                      className="font-medium text-slate-900 transition-colors hover:text-municipal-700"
                    >
                      {fila.vendedor.emprendimiento}
                    </Link>
                  </Td>
                  <Td className="text-slate-500">
                    {RUBROS[fila.vendedor.rubro]}
                  </Td>
                  <Td className="tabular-nums">
                    {formatearMoneda(fila.resumen.totalPagado)}
                  </Td>
                  <Td className="tabular-nums">
                    {fila.resumen.saldo > 0 ? (
                      <span className="font-medium text-red-600">
                        {formatearMoneda(fila.resumen.saldo)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      tono={TONO_ESTADO_PERMISO[fila.resumen.estado]}
                      tamanio="sm"
                      conPunto={fila.resumen.estado === "VENCIDO"}
                    >
                      {ESTADOS_PERMISO[fila.resumen.estado]}
                    </Badge>
                    {detalleVencimiento(fila.resumen) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {detalleVencimiento(fila.resumen)}
                      </p>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatearFecha(fila.fechaUltimoPago)}
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
