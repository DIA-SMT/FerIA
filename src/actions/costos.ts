"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PRECIOS_Y_COSTOS } from "@/lib/consultas-feriante";
import { calcularCostos, datosDeCostosSchema } from "@/lib/costos";
import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  type EstadoFormulario,
} from "@/lib/form";
import { obtenerVendedorActual } from "@/lib/session";

/*
  Las fichas de costos que arma el feriante en «Precios y costos». Son suyas y
  de nadie más: cada acción busca la ficha por id **y** por su stand, así una
  ficha ajena no se puede editar ni borrar aunque alguien adivine el id.
*/

const encabezadoSchema = z.object({
  id: z.string().trim().max(40).optional(),
  nombre: z
    .string()
    .trim()
    .min(1, "Poné el nombre del producto.")
    .max(120, "Es demasiado largo."),
  productoId: z.string().trim().max(40).optional(),
});

export async function guardarFichaDeCostos(
  _estado: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await obtenerVendedorActual();

    const encabezado = encabezadoSchema.parse({
      id: formulario.get("id") || undefined,
      nombre: formulario.get("nombre"),
      productoId: formulario.get("productoId") || undefined,
    });

    let crudos: unknown;
    try {
      crudos = JSON.parse(String(formulario.get("datos") ?? ""));
    } catch {
      return estadoDeError("No se pudieron leer los datos de la cuenta.");
    }
    const leidos = datosDeCostosSchema.safeParse(crudos);
    if (!leidos.success) {
      return estadoDeError(
        "Revisá los datos: hay algún número que falta o no está bien.",
      );
    }
    const resultado = calcularCostos(leidos.data);
    if ("error" in resultado) return estadoDeError(resultado.error);

    // El producto tiene que ser suyo; si no, la ficha queda sin producto.
    const producto = encabezado.productoId
      ? await prisma.producto.findFirst({
          where: { id: encabezado.productoId, vendedorId: vendedor.id },
          select: { id: true },
        })
      : null;

    const valores = {
      nombre: encabezado.nombre,
      productoId: producto?.id ?? null,
      datos: leidos.data as Prisma.InputJsonValue,
    };

    if (encabezado.id) {
      const { count } = await prisma.fichaDeCostos.updateMany({
        where: { id: encabezado.id, vendedorId: vendedor.id },
        data: valores,
      });
      if (count === 0) return estadoDeError("No encontré esa ficha.");
    } else {
      await prisma.fichaDeCostos.create({
        data: { vendedorId: vendedor.id, ...valores },
      });
    }

    revalidatePath(PRECIOS_Y_COSTOS);
    redirect(PRECIOS_Y_COSTOS);
  });
}

export async function eliminarFichaDeCostos(
  formulario: FormData,
): Promise<void> {
  const { vendedor } = await obtenerVendedorActual();
  const id = String(formulario.get("fichaId") ?? "");
  if (!id) return;

  await prisma.fichaDeCostos.deleteMany({
    where: { id, vendedorId: vendedor.id },
  });
  revalidatePath(PRECIOS_Y_COSTOS);
}
