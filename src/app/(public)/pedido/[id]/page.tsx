import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LimpiarCarrito } from "@/components/carrito/limpiar-carrito";
import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { IconoWhatsapp } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { aNumero, formatearMoneda, formatearRangoFechas } from "@/lib/format";
import {
  ESTADOS_PEDIDO,
  MODOS_ENTREGA,
  TONO_ESTADO_PEDIDO,
} from "@/lib/labels";
import { hayPedidos } from "@/lib/marketplace";
import { mensajePedido, subtotalLinea, totalPedido } from "@/lib/pedidos";
import { linkWhatsapp } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Pedido enviado",
  robots: { index: false, follow: false },
};

/** Diez minutos: más que suficiente para llegar acá desde el formulario. */
const VENTANA_RECIENTE = 10 * 60 * 1000;

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hayPedidos()) notFound();

  const { id } = await params;

  /*
    Esta página es direccionable por URL y no pide sesión: el vecino no tiene
    cuenta, así que no hay forma de autenticarlo. Por eso **no muestra ningún
    dato de quien compró**: ni nombre, ni teléfono, ni correo, ni las
    aclaraciones que escribió, que es texto libre y puede tener cualquier cosa.

    Lo que queda a la vista es qué se pidió, a quién y en qué estado está. Son
    datos del comercio, no de la persona: el catálogo y el contacto del stand
    ya son públicos en su ficha. Así, aunque alguien adivinara un id, no se
    lleva nada que no estuviera publicado.

    Si alguna vez hay que mostrarle sus datos al comprador, no alcanza con el
    id: hace falta un token aleatorio en la URL, y eso es otra columna.
  */
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      estado: true,
      modoEntrega: true,
      motivoCancelacion: true,
      creadoEn: true,
      vendedor: { select: { slug: true, emprendimiento: true, whatsapp: true } },
      edicion: {
        select: {
          nombre: true,
          fechaInicio: true,
          fechaFin: true,
          feria: { select: { nombre: true, direccion: true } },
        },
      },
      items: {
        select: { id: true, nombre: true, precioUnitario: true, cantidad: true },
      },
    },
  });

  if (!pedido) notFound();

  const lineas = pedido.items.map((item) => ({
    ...item,
    precioUnitario: aNumero(item.precioUnitario),
  }));

  const enlace = linkWhatsapp(
    pedido.vendedor.whatsapp,
    mensajePedido(pedido.numero, pedido.vendedor.emprendimiento, lineas),
  );

  const reciente = Date.now() - pedido.creadoEn.getTime() < VENTANA_RECIENTE;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <LimpiarCarrito slug={pedido.vendedor.slug} reciente={reciente} />

      <header>
        <p className="text-sm font-medium text-municipal-600">
          Pedido #{pedido.numero}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Listo, tu pedido está hecho
        </h1>
        <p className="mt-2 text-slate-600">
          Ahora falta el último paso, y lo tenés que dar vos:{" "}
          <strong className="font-semibold text-slate-900">
            escribile a {pedido.vendedor.emprendimiento}
          </strong>{" "}
          para coordinar el pago y la entrega.
        </p>
      </header>

      <a
        href={enlace}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <IconoWhatsapp className="size-5" />
        Escribirle por WhatsApp
      </a>

      <Alerta tipo="info" className="mt-4">
        El mensaje ya va escrito con el número de pedido y el detalle. La
        Municipalidad no cobra, no retiene el dinero ni interviene en la
        entrega: eso lo arreglás directamente con quien produce.
      </Alerta>

      <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Qué pediste</h2>
          <Badge tono={TONO_ESTADO_PEDIDO[pedido.estado]} tamanio="sm">
            {ESTADOS_PEDIDO[pedido.estado]}
          </Badge>
        </header>

        <ul className="divide-y divide-slate-100">
          {lineas.map((linea) => (
            <li
              key={linea.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{linea.nombre}</p>
                <p className="text-sm text-slate-500">
                  {linea.cantidad} × {formatearMoneda(linea.precioUnitario)}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-slate-900">
                {formatearMoneda(subtotalLinea(linea))}
              </p>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
            <p className="font-medium text-slate-700">Total</p>
            <p className="text-lg font-bold text-slate-900">
              {formatearMoneda(totalPedido(lineas))}
            </p>
          </li>
        </ul>

        <footer className="space-y-1 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-700">Entrega:</span>{" "}
            {MODOS_ENTREGA[pedido.modoEntrega]}
          </p>
          {pedido.edicion && (
            <p>
              <span className="font-medium text-slate-700">Dónde:</span>{" "}
              {pedido.edicion.feria.nombre}
              {pedido.edicion.nombre ? ` — ${pedido.edicion.nombre}` : ""} ·{" "}
              {formatearRangoFechas(
                pedido.edicion.fechaInicio,
                pedido.edicion.fechaFin,
              )}
              {` · ${pedido.edicion.feria.direccion}`}
            </p>
          )}
          {pedido.motivoCancelacion && (
            <p className="text-red-700">
              <span className="font-medium">Motivo de la cancelación:</span>{" "}
              {pedido.motivoCancelacion}
            </p>
          )}
        </footer>
      </section>

      <p className="mt-6 text-sm text-slate-500">
        Guardá este enlace si querés volver a ver el pedido.{" "}
        <Link
          href={`/stands/${pedido.vendedor.slug}`}
          className="font-medium text-municipal-600 transition-colors hover:text-municipal-700"
        >
          Volver al stand
        </Link>
      </p>
    </div>
  );
}
