"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { requerirAdmin } from "@/lib/session";
import { edicionSchema } from "@/lib/validations/feria";

function revalidarEdicion(edicionId: string, feriaId: string): void {
  revalidatePath("/");
  revalidatePath("/ferias");
  revalidatePath("/admin");
  revalidatePath("/admin/ferias");
  revalidatePath(`/admin/ferias/${feriaId}`);
  revalidatePath(`/admin/ediciones/${edicionId}`);
  revalidatePath("/admin/canon");
}

/**
 * Ajusta la grilla de stands a la cantidad indicada.
 *
 * Agrega los que falten y elimina los sobrantes **sólo si están libres**: si
 * hay un feriante asignado en un número mayor al nuevo tope, devuelve su
 * número para que la acción pueda avisar en lugar de borrar una asignación.
 */
async function sincronizarStands(
  tx: Prisma.TransactionClient,
  edicionId: string,
  cantidad: number,
): Promise<{ ocupadosFuera: number[] }> {
  const existentes = await tx.stand.findMany({
    where: { edicionId },
    select: { id: true, numero: true, vendedorId: true },
    orderBy: { numero: "asc" },
  });

  const numerosExistentes = new Set(existentes.map((stand) => stand.numero));

  const faltantes: Array<{ edicionId: string; numero: number }> = [];
  for (let numero = 1; numero <= cantidad; numero++) {
    if (!numerosExistentes.has(numero)) faltantes.push({ edicionId, numero });
  }
  if (faltantes.length > 0) {
    await tx.stand.createMany({ data: faltantes });
  }

  const sobrantes = existentes.filter((stand) => stand.numero > cantidad);
  const ocupadosFuera = sobrantes
    .filter((stand) => stand.vendedorId !== null)
    .map((stand) => stand.numero);

  const librosParaBorrar = sobrantes
    .filter((stand) => stand.vendedorId === null)
    .map((stand) => stand.id);

  if (librosParaBorrar.length > 0) {
    await tx.stand.deleteMany({ where: { id: { in: librosParaBorrar } } });
  }

  return { ocupadosFuera };
}

export async function crearEdicion(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = edicionSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    const feria = await prisma.feria.findUnique({
      where: { id: entrada.feriaId },
      select: { id: true },
    });
    if (!feria) return estadoDeError("La feria no existe.");

    const edicion = await prisma.$transaction(async (tx) => {
      const creada = await tx.edicionFeria.create({
        data: {
          feriaId: entrada.feriaId,
          nombre: entrada.nombre,
          fechaInicio: entrada.fechaInicio,
          fechaFin: entrada.fechaFin,
          horario: entrada.horario,
          estado: entrada.estado,
          cantidadStands: entrada.cantidadStands,
          montoCanon: entrada.montoCanon,
          vencimientoCanon: entrada.vencimientoCanon,
        },
      });

      await sincronizarStands(tx, creada.id, entrada.cantidadStands);
      return creada;
    });

    revalidarEdicion(edicion.id, entrada.feriaId);
    redirect(`/admin/ediciones/${edicion.id}`);
  });
}

export async function actualizarEdicion(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const edicionId = String(datos.get("edicionId") ?? "");
    if (!edicionId) return estadoDeError("Falta el identificador de la edición.");

    const validacion = edicionSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.edicionFeria.update({
        where: { id: edicionId },
        data: {
          nombre: entrada.nombre,
          fechaInicio: entrada.fechaInicio,
          fechaFin: entrada.fechaFin,
          horario: entrada.horario,
          estado: entrada.estado,
          cantidadStands: entrada.cantidadStands,
          montoCanon: entrada.montoCanon,
          vencimientoCanon: entrada.vencimientoCanon,
        },
      });

      return sincronizarStands(tx, edicionId, entrada.cantidadStands);
    });

    revalidarEdicion(edicionId, entrada.feriaId);

    if (resultado.ocupadosFuera.length > 0) {
      const numeros = resultado.ocupadosFuera.join(", ");
      return {
        ok: true,
        mensaje:
          `Edición actualizada, pero los stands ${numeros} siguen existiendo porque ` +
          "tienen un feriante asignado. Liberalos primero si querés reducir la grilla.",
      };
    }

    return estadoDeExito("Edición actualizada.");
  });
}

export async function eliminarEdicion(datos: FormData): Promise<void> {
  await requerirAdmin();

  const edicionId = String(datos.get("edicionId") ?? "");
  if (!edicionId) return;

  const edicion = await prisma.edicionFeria.findUnique({
    where: { id: edicionId },
    select: { feriaId: true },
  });
  if (!edicion) return;

  // Stands y pagos de canon se eliminan en cascada.
  await prisma.edicionFeria.delete({ where: { id: edicionId } });

  revalidarEdicion(edicionId, edicion.feriaId);
  redirect(`/admin/ferias/${edicion.feriaId}`);
}
