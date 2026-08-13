"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { requerirAdmin } from "@/lib/session";
import { asignarStandSchema, notasStandSchema } from "@/lib/validations/stand";

function revalidarStands(edicionId: string): void {
  revalidatePath("/");
  revalidatePath("/ferias");
  revalidatePath("/admin");
  revalidatePath(`/admin/ediciones/${edicionId}`);
  revalidatePath("/mi-stand");
}

/**
 * Asigna un feriante a un stand, o lo libera si no viene `vendedorId`.
 *
 * Reglas: sólo se asignan feriantes APROBADOS y un mismo feriante no puede
 * ocupar dos stands de la misma edición (además del índice único en la base,
 * lo validamos acá para poder devolver un mensaje claro).
 */
export async function asignarStand(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = asignarStandSchema.safeParse({
      standId: datos.get("standId"),
      vendedorId: datos.get("vendedorId"),
    });
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const { standId, vendedorId } = validacion.data;

    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      select: { id: true, numero: true, edicionId: true },
    });
    if (!stand) return estadoDeError("El stand no existe.");

    if (vendedorId === null) {
      await prisma.stand.update({
        where: { id: standId },
        data: { vendedorId: null, asignadoEn: null },
      });
      revalidarStands(stand.edicionId);
      return estadoDeExito(`Stand ${stand.numero} liberado.`);
    }

    const vendedor = await prisma.vendedor.findUnique({
      where: { id: vendedorId },
      select: { id: true, estado: true, emprendimiento: true },
    });
    if (!vendedor) return estadoDeError("El feriante no existe.");

    if (vendedor.estado !== "APROBADO") {
      return estadoDeError(
        "Sólo se pueden asignar stands a feriantes aprobados.",
      );
    }

    const yaTieneStand = await prisma.stand.findFirst({
      where: {
        edicionId: stand.edicionId,
        vendedorId,
        id: { not: standId },
      },
      select: { numero: true },
    });

    if (yaTieneStand) {
      return estadoDeError(
        `${vendedor.emprendimiento} ya tiene asignado el stand ${yaTieneStand.numero} en esta edición.`,
      );
    }

    await prisma.stand.update({
      where: { id: standId },
      data: { vendedorId, asignadoEn: new Date() },
    });

    revalidarStands(stand.edicionId);
    return estadoDeExito(
      `Stand ${stand.numero} asignado a ${vendedor.emprendimiento}.`,
    );
  });
}

export async function guardarNotasStand(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = notasStandSchema.safeParse({
      standId: datos.get("standId"),
      notas: datos.get("notas"),
    });
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const stand = await prisma.stand.update({
      where: { id: validacion.data.standId },
      data: { notas: validacion.data.notas },
      select: { edicionId: true },
    });

    revalidarStands(stand.edicionId);
    return estadoDeExito("Notas guardadas.");
  });
}

/** Libera un stand desde la grilla (formulario simple, sin estado). */
export async function liberarStand(datos: FormData): Promise<void> {
  await requerirAdmin();

  const standId = String(datos.get("standId") ?? "");
  if (!standId) return;

  const stand = await prisma.stand.update({
    where: { id: standId },
    data: { vendedorId: null, asignadoEn: null },
    select: { edicionId: true },
  });

  revalidarStands(stand.edicionId);
}
