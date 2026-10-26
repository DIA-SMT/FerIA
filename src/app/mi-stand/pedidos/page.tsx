import { notFound } from "next/navigation";

import { AccionesPedido } from "@/components/vendedor/acciones-pedido";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoCarrito, IconoWhatsapp } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { prisma } from "@/lib/db";
import {
  aNumero,
  formatearFechaHora,
  formatearMoneda,
  formatearRangoFechas,
} from "@/lib/format";
import {
  ESTADOS_PEDIDO,
  MODOS_ENTREGA,
  TONO_ESTADO_PEDIDO,
} from "@/lib/labels";
import { hayPedidos } from "@/lib/marketplace";
import { subtotalLinea, totalPedido } from "@/lib/pedidos";
import { requerirVendedorAprobado } from "@/lib/session";
import { formatearWhatsapp, linkWhatsapp } from "@/lib/whatsapp";

export const metadata = { title: "Pedidos" };

export default async function PaginaPedidos() {
  if (!hayPedidos()) notFound();

  const { vendedor } = await requerirVendedorAprobado();

  const pedidos = await prisma.pedido.findMany({
    where: { vendedorId: vendedor.id },
    // Los que esperan respuesta primero: es la única lista del panel donde hay
    // alguien del otro lado mirando el teléfono.
    orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    take: 100,
    select: {
      id: true,
      numero: true,
      estado: true,
      modoEntrega: true,
      motivoCancelacion: true,
      notas: true,
      creadoEn: true,
      compradorNombre: true,
      compradorWhatsapp: true,
      compradorEmail: true,
      edicion: {
        select: {
          nombre: true,
          fechaInicio: true,
          fechaFin: true,
          feria: { select: { nombre: true } },
        },
      },
      items: {
        select: {
          id: true,
          nombre: true,
          precioUnitario: true,
          cantidad: true,
        },
      },
    },
  });

  const pendientes = pedidos.filter((pedido) => pedido.estado === "PENDIENTE");

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Pedidos
        </h1>
        <p className="mt-1 text-slate-600">
          Lo que te pidieron desde tu vidriera. El cobro y la entrega los
          arreglás vos con cada persona: la Municipalidad no cobra ni retiene
          nada.
        </p>
      </header>

      {pendientes.length > 0 && (
        <Alerta tipo="advertencia" className="mb-6">
          Tenés {pendientes.length}{" "}
          {pendientes.length === 1
            ? "pedido esperando respuesta"
            : "pedidos esperando respuesta"}
          . Escribile a cada persona por WhatsApp para coordinar.
        </Alerta>
      )}

      {pedidos.length === 0 ? (
        <EstadoVacio
          icono={IconoCarrito}
          titulo="Todavía no tenés pedidos"
          descripcion="Cuando alguien arme un pedido desde tu vidriera, te va a aparecer acá y además te va a escribir por WhatsApp."
        />
      ) : (
        <div className="space-y-4">
          {pedidos.map((pedido) => {
            const lineas = pedido.items.map((item) => ({
              ...item,
              precioUnitario: aNumero(item.precioUnitario),
            }));
            // El estado, no un booleano: así TypeScript sabe cuál de los dos
            // es cuando se lo pasa a las acciones, que sólo aceptan esos.
            const abierto =
              pedido.estado === "PENDIENTE" || pedido.estado === "CONFIRMADO"
                ? pedido.estado
                : null;

            return (
              <Tarjeta key={pedido.id}>
                <TarjetaCuerpo>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Pedido #{pedido.numero}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatearFechaHora(pedido.creadoEn)}
                      </p>
                    </div>
                    <Badge
                      tono={TONO_ESTADO_PEDIDO[pedido.estado]}
                      tamanio="sm"
                    >
                      {ESTADOS_PEDIDO[pedido.estado]}
                    </Badge>
                  </div>

                  <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {lineas.map((linea) => (
                      <li
                        key={linea.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 text-slate-700">
                          {linea.cantidad} × {linea.nombre}
                        </span>
                        <span className="shrink-0 font-medium text-slate-900">
                          {formatearMoneda(subtotalLinea(linea))}
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2">
                      <span className="text-sm font-medium text-slate-700">
                        Total
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatearMoneda(totalPedido(lineas))}
                      </span>
                    </li>
                  </ul>

                  <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-700">
                        Quién pidió
                      </dt>
                      <dd className="text-slate-600">
                        {pedido.compradorNombre}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-700">Entrega</dt>
                      <dd className="text-slate-600">
                        {MODOS_ENTREGA[pedido.modoEntrega]}
                        {pedido.edicion &&
                          ` · ${pedido.edicion.feria.nombre} (${formatearRangoFechas(
                            pedido.edicion.fechaInicio,
                            pedido.edicion.fechaFin,
                          )})`}
                      </dd>
                    </div>
                    {pedido.compradorEmail && (
                      <div>
                        <dt className="font-medium text-slate-700">Correo</dt>
                        <dd className="break-all text-slate-600">
                          {pedido.compradorEmail}
                        </dd>
                      </div>
                    )}
                    {pedido.notas && (
                      <div className="sm:col-span-2">
                        <dt className="font-medium text-slate-700">
                          Aclaraciones
                        </dt>
                        <dd className="whitespace-pre-line text-slate-600">
                          {pedido.notas}
                        </dd>
                      </div>
                    )}
                    {pedido.motivoCancelacion && (
                      <div className="sm:col-span-2">
                        <dt className="font-medium text-slate-700">
                          Motivo de la cancelación
                        </dt>
                        <dd className="text-slate-600">
                          {pedido.motivoCancelacion}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <a
                      href={linkWhatsapp(
                        pedido.compradorWhatsapp,
                        `¡Hola ${pedido.compradorNombre}! Te escribo por el pedido #${pedido.numero} que hiciste en las Ferias Municipales.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
                    >
                      <IconoWhatsapp className="size-4" />
                      {formatearWhatsapp(pedido.compradorWhatsapp)}
                    </a>

                    {abierto && (
                      <AccionesPedido pedidoId={pedido.id} estado={abierto} />
                    )}
                  </div>
                </TarjetaCuerpo>
              </Tarjeta>
            );
          })}
        </div>
      )}
    </>
  );
}
