import { ModalidadSelloPropio } from "@prisma/client";
import { z } from "zod";

import { leerPrecio } from "@/lib/sello-propio";
import { casilla, texto, textoOpcional } from "@/lib/validations/comunes";

/** Alta y edición de una propuesta de «sello propio», desde el panel. */
export const propuestaSelloPropioSchema = z.object({
  vendedorId: z.string().trim().min(1, "Elegí el feriante que la ofrece."),
  modalidad: z.nativeEnum(ModalidadSelloPropio, {
    errorMap: () => ({ message: "Elegí qué es: producto, caja, combo…" }),
  }),
  titulo: texto(3, 120, "El título"),
  descripcion: texto(10, 1500, "La descripción"),
  precio: z
    .string()
    .optional()
    .transform((valor) => leerPrecio(valor ?? ""))
    .refine(
      (valor) => valor === null || (valor > 0 && valor <= 99_999_999),
      "El precio tiene que ser un número de pesos, ej. 15.000.",
    ),
  precioUnidad: textoOpcional(40, "El «por…» del precio"),
  minimo: textoOpcional(80, "El mínimo"),
  capacidad: textoOpcional(120, "La capacidad"),
  anticipacion: textoOpcional(80, "La anticipación"),
  publicada: casilla,
});

export type DatosPropuestaSelloPropio = z.infer<
  typeof propuestaSelloPropioSchema
>;

/**
 * La misma propuesta, cargada por el feriante desde Mi stand: el feriante es
 * él, y no decide si se publica (eso lo decide la revisión).
 */
export const propuestaPropiaSchema = propuestaSelloPropioSchema.omit({
  vendedorId: true,
  publicada: true,
});
