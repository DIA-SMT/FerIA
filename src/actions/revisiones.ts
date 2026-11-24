"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { aprobarCambio, rechazarCambio } from "@/lib/revision";
import { requerirAdmin } from "@/lib/session";

/*
  Panel municipal — revisión de lo que los feriantes cambian en su stand.
  La lógica vive en `src/lib/revision.ts`; acá sólo se exige el rol, se valida
  la entrada y se refresca lo que cambió.
*/

function refrescar(slugs: string[]): void {
  revalidatePath("/admin/revisiones");
  revalidatePath("/admin", "layout");
  revalidatePath("/mi-stand");
  revalidatePath("/stands");
  revalidatePath("/");
  // Una propuesta de Modo Feria aprobada aparece en sus páginas.
  revalidatePath("/modo-feria", "layout");
  for (const slug of slugs) revalidatePath(`/stands/${slug}`);
}

const aprobarSchema = z.object({ cambioId: z.string().min(1) });

const rechazarSchema = z.object({
  cambioId: z.string().min(1),
  motivoRechazo: z
    .string()
    .trim()
    .min(5, "Contale al feriante qué corregir, en una frase.")
    .max(300, "El motivo es demasiado largo (máximo 300 caracteres)."),
});

export async function aprobarCambioDelStand(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const sesion = await requerirAdmin();
    const entrada = aprobarSchema.safeParse(Object.fromEntries(datos));
    if (!entrada.success) return estadoDeError("Falta el cambio a aprobar.");

    const resultado = await aprobarCambio(entrada.data.cambioId, sesion.id);
    if (!resultado.ok) return estadoDeError(resultado.mensaje);

    refrescar(resultado.slugs);
    return estadoDeExito("Aprobado: ya está publicado.");
  });
}

export async function rechazarCambioDelStand(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const sesion = await requerirAdmin();
    const entrada = rechazarSchema.safeParse(Object.fromEntries(datos));
    if (!entrada.success) return estadoDesdeZod(entrada.error);

    const resultado = await rechazarCambio(
      entrada.data.cambioId,
      sesion.id,
      entrada.data.motivoRechazo,
    );
    if (!resultado.ok) return estadoDeError(resultado.mensaje);

    refrescar(resultado.slugs);
    return estadoDeExito("Rechazado: el feriante va a ver el motivo.");
  });
}
