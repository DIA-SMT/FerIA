import { z } from "zod";

import { entero, id, idOpcional, textoOpcional } from "@/lib/validations/comunes";

/**
 * Regenera la grilla de stands de una edición.
 * Los stands numerados por encima de `cantidad` se eliminan; la acción avisa
 * si alguno de ellos estaba ocupado.
 */
export const definirStandsSchema = z.object({
  edicionId: id,
  cantidad: entero(0, 500, "La cantidad de stands"),
});

/** Asigna (o libera, si `vendedorId` viene vacío) un stand concreto. */
export const asignarStandSchema = z.object({
  standId: id,
  vendedorId: idOpcional,
});

/** Notas internas de un stand (ubicación en el predio, observaciones). */
export const notasStandSchema = z.object({
  standId: id,
  notas: textoOpcional(300, "Las notas"),
});
