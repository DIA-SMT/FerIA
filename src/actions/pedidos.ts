"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  type EstadoFormulario,
} from "@/lib/form";
import { aNumero } from "@/lib/format";
import { hayPedidos } from "@/lib/marketplace";
import { sePuedePedir } from "@/lib/pedidos";
import { requerirVendedorAprobado } from "@/lib/session";
import {
  cambiarEstadoPedidoSchema,
  pedidoSchema,
} from "@/lib/validations/pedido";

/**
 * Pedidos del vecino al feriante.
 *
 * El municipio no cobra: lo que hace esta acción es dejar asentado qué se
 * pidió, a quién y a qué precio, y después mandar a las dos personas a
 * hablar por WhatsApp. No hay pago, ni reserva de dinero, ni comisión.
 */

/**
 * El carrito dice qué y cuánto; el precio lo pone la base.
 *
 * Esto no es una precaución teórica: el carrito vive en localStorage y
 * cualquiera puede editarlo desde las herramientas del navegador. Si el precio
 * viajara en el formulario, se podría pedir una campera a $1 y el feriante
 * recibiría un pedido con ese número escrito por el municipio. Acá lo único
 * que se acepta del navegador es el id del producto y la cantidad.
 */
export async function crearPedido(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    // El flag se comprueba también acá y no sólo al pintar la pantalla: la
    // acción es un endpoint y se puede invocar sin pasar por la interfaz.
    if (!hayPedidos()) {
      return estadoDeError(
        "Los pedidos no están habilitados. Escribile al feriante por WhatsApp.",
      );
    }

    const entrada = pedidoSchema.parse(Object.fromEntries(datos));

    const vendedor = await prisma.vendedor.findFirst({
      where: { slug: entrada.vendedorSlug, estado: "APROBADO" },
      select: { id: true, emprendimiento: true },
    });

    if (!vendedor) {
      return estadoDeError(
        "Ese stand ya no está disponible. Volvé al directorio y buscá otro.",
      );
    }

    const pedidos = new Map(
      entrada.items.map((linea) => [linea.productoId, linea.cantidad]),
    );

    // El `vendedorId` en el where es lo que impide armar un pedido mezclando
    // productos de otro stand mandando sus ids a mano.
    const productos = await prisma.producto.findMany({
      where: { id: { in: [...pedidos.keys()] }, vendedorId: vendedor.id },
      select: {
        id: true,
        nombre: true,
        precio: true,
        stock: true,
        disponible: true,
      },
    });

    const lineas: Array<{
      productoId: string;
      nombre: string;
      precioUnitario: number;
      cantidad: number;
    }> = [];
    const rechazados: string[] = [];

    for (const producto of productos) {
      const cantidad = pedidos.get(producto.id);
      if (cantidad === undefined) continue;

      const precio = producto.precio === null ? null : aNumero(producto.precio);

      if (!sePuedePedir({ ...producto, precio })) {
        rechazados.push(producto.nombre);
        continue;
      }

      // El stock no se descuenta: el feriante vende también en el puesto y en
      // mano, así que el número de acá nunca va a ser la verdad del canasto.
      // Se usa para no dejar pedir de más en el momento, y nada más.
      if (producto.stock !== null && cantidad > producto.stock) {
        rechazados.push(`${producto.nombre} (quedan ${producto.stock})`);
        continue;
      }

      lineas.push({
        productoId: producto.id,
        nombre: producto.nombre,
        precioUnitario: precio ?? 0,
        cantidad,
      });
    }

    // Los que ni siquiera volvieron de la consulta: borrados, o de otro stand.
    if (productos.length < pedidos.size) {
      rechazados.push("alguno de los productos ya no está en el catálogo");
    }

    if (lineas.length === 0) {
      return estadoDeError(
        "Ninguno de los productos del carrito se puede pedir ahora. Revisá el catálogo del stand.",
      );
    }

    if (rechazados.length > 0) {
      return estadoDeError(
        `No pudimos tomar el pedido porque cambió el catálogo: ${rechazados.join(
          ", ",
        )}. Revisá el carrito y volvé a intentar.`,
      );
    }

    const edicionId = await edicionDeRetiro(entrada, vendedor.id);

    const pedido = await prisma.pedido.create({
      data: {
        vendedorId: vendedor.id,
        compradorNombre: entrada.compradorNombre,
        compradorWhatsapp: entrada.compradorWhatsapp,
        compradorEmail: entrada.compradorEmail,
        notas: entrada.notas,
        modoEntrega: entrada.modoEntrega,
        edicionId,
        items: { create: lineas },
      },
      select: { id: true },
    });

    revalidatePath("/mi-stand/pedidos");
    redirect(`/pedido/${pedido.id}`);
  });
}

/**
 * Valida la edición de retiro.
 *
 * Tiene que ser una edición en la que ese feriante realmente tenga stand: el
 * id viaja en un `select` del formulario y mandar otro sería citar al vecino a
 * una feria donde no hay nadie esperándolo.
 */
async function edicionDeRetiro(
  entrada: { modoEntrega: string; edicionId: string | null },
  vendedorId: string,
): Promise<string | null> {
  if (entrada.modoEntrega !== "RETIRO_EN_FERIA") return null;
  if (!entrada.edicionId) return null;

  const stand = await prisma.stand.findFirst({
    where: { vendedorId, edicionId: entrada.edicionId },
    select: { edicionId: true },
  });

  return stand?.edicionId ?? null;
}

/**
 * El feriante responde el pedido.
 *
 * `respondidoEn` se escribe la primera vez que sale de PENDIENTE y no se
 * vuelve a tocar: lo que mide es cuánto tardó en haber una respuesta, no
 * cuándo fue el último cambio, que para eso está `actualizadoEn`.
 */
export async function cambiarEstadoPedido(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await requerirVendedorAprobado();
    const entrada = cambiarEstadoPedidoSchema.parse(Object.fromEntries(datos));

    const pedido = await prisma.pedido.findFirst({
      where: { id: entrada.pedidoId, vendedorId: vendedor.id },
      select: { id: true, estado: true, respondidoEn: true },
    });

    if (!pedido) return estadoDeError("Ese pedido no existe.");

    if (pedido.estado === "ENTREGADO" || pedido.estado === "CANCELADO") {
      return estadoDeError(
        "Ese pedido ya está cerrado y no se puede volver a cambiar.",
      );
    }

    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        estado: entrada.estado,
        motivoCancelacion:
          entrada.estado === "CANCELADO" ? entrada.motivoCancelacion : null,
        respondidoEn: pedido.respondidoEn ?? new Date(),
      },
    });

    revalidatePath("/mi-stand/pedidos");
    revalidatePath(`/pedido/${pedido.id}`);

    return estadoDeExito("Pedido actualizado.");
  });
}
