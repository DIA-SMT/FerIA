"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { hoyEnZona } from "@/lib/format";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { requerirAdmin } from "@/lib/session";
import { almacenamiento, guardarComprobanteOpcional } from "@/lib/storage";
import { pagoCanonSchema } from "@/lib/validations/canon";

function revalidarCanon(edicionId?: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/canon");
  revalidatePath("/mi-stand/canon");
  if (edicionId) revalidatePath(`/admin/ediciones/${edicionId}`);
}

export async function registrarPago(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = pagoCanonSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    const [vendedor, edicion] = await Promise.all([
      prisma.vendedor.findUnique({
        where: { id: entrada.vendedorId },
        select: { id: true },
      }),
      prisma.edicionFeria.findUnique({
        where: { id: entrada.edicionId },
        select: { id: true },
      }),
    ]);

    if (!vendedor) return estadoDeError("El feriante no existe.");
    if (!edicion) return estadoDeError("La edición no existe.");

    const comprobante = await guardarComprobanteOpcional(
      datos.get("comprobante"),
    );

    await prisma.pagoCanon.create({
      data: {
        vendedorId: entrada.vendedorId,
        edicionId: entrada.edicionId,
        monto: entrada.monto,
        fechaPago: entrada.fechaPago,
        medio: entrada.medio,
        estado: entrada.estado,
        observaciones: entrada.observaciones,
        comprobante,
      },
    });

    revalidarCanon(entrada.edicionId);

    // Se redirige como en `crearFeria` y `crearEdicion`: sin esto el
    // formulario se quedaba con los mismos valores cargados y un segundo
    // click —o un F5— registraba la misma plata dos veces. La pantalla de
    // canon de esa edición ya muestra el pago recién cargado y el saldo nuevo.
    redirect(`/admin/canon?edicion=${entrada.edicionId}`);
  });
}

export async function actualizarPago(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const pagoId = String(datos.get("pagoId") ?? "");
    if (!pagoId) return estadoDeError("Falta el identificador del pago.");

    const actual = await prisma.pagoCanon.findUnique({
      where: { id: pagoId },
      select: { id: true, comprobante: true },
    });
    if (!actual) return estadoDeError("El pago no existe.");

    const validacion = pagoCanonSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    const comprobanteNuevo = await guardarComprobanteOpcional(
      datos.get("comprobante"),
    );

    await prisma.pagoCanon.update({
      where: { id: pagoId },
      data: {
        vendedorId: entrada.vendedorId,
        edicionId: entrada.edicionId,
        monto: entrada.monto,
        fechaPago: entrada.fechaPago,
        medio: entrada.medio,
        estado: entrada.estado,
        observaciones: entrada.observaciones,
        ...(comprobanteNuevo ? { comprobante: comprobanteNuevo } : {}),
      },
    });

    if (comprobanteNuevo && actual.comprobante) {
      await almacenamiento.eliminar(actual.comprobante);
    }

    revalidarCanon(entrada.edicionId);
    return estadoDeExito("Pago actualizado.");
  });
}

/** Marca un pago pendiente como abonado en efectivo con fecha de hoy. */
export async function marcarComoPagado(datos: FormData): Promise<void> {
  await requerirAdmin();

  const pagoId = String(datos.get("pagoId") ?? "");
  if (!pagoId) return;

  // El día en Tucumán, no el del reloj UTC del servidor: un pago cobrado en
  // la oficina a las 21:30 quedaba fechado al día siguiente.
  const pago = await prisma.pagoCanon.update({
    where: { id: pagoId },
    data: { estado: "PAGADO", fechaPago: hoyEnZona(), medio: "EFECTIVO" },
    select: { edicionId: true },
  });

  revalidarCanon(pago.edicionId);
}

export async function eliminarPago(datos: FormData): Promise<void> {
  await requerirAdmin();

  const pagoId = String(datos.get("pagoId") ?? "");
  if (!pagoId) return;

  const pago = await prisma.pagoCanon.findUnique({
    where: { id: pagoId },
    select: { edicionId: true, comprobante: true },
  });
  if (!pago) return;

  await prisma.pagoCanon.delete({ where: { id: pagoId } });

  if (pago.comprobante) await almacenamiento.eliminar(pago.comprobante);

  revalidarCanon(pago.edicionId);
}
