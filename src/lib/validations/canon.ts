import { EstadoPago, MedioPago } from "@prisma/client";
import { z } from "zod";

import {
  fechaOpcional,
  id,
  importe,
  textoOpcional,
} from "@/lib/validations/comunes";

/** Registro o edición de un pago de canon. */
export const pagoCanonSchema = z
  .object({
    vendedorId: id,
    edicionId: id,
    monto: importe("El monto"),
    fechaPago: fechaOpcional("La fecha de pago"),
    medio: z
      .string()
      .trim()
      .optional()
      .transform((valor) => (valor && valor.length > 0 ? valor : null))
      .refine(
        (valor) =>
          valor === null || Object.values(MedioPago).includes(valor as MedioPago),
        { message: "Elegí un medio de pago válido." },
      )
      .transform((valor) => valor as MedioPago | null),
    estado: z.nativeEnum(EstadoPago, {
      errorMap: () => ({ message: "Elegí un estado." }),
    }),
    observaciones: textoOpcional(500, "Las observaciones"),
  })
  .refine(
    (datos) => datos.estado !== "PAGADO" || datos.fechaPago !== null,
    {
      message: "Un pago marcado como pagado necesita la fecha de pago.",
      path: ["fechaPago"],
    },
  )
  .refine(
    (datos) => datos.estado !== "PAGADO" || datos.medio !== null,
    {
      message: "Un pago marcado como pagado necesita el medio de pago.",
      path: ["medio"],
    },
  );

export type DatosPagoCanon = z.infer<typeof pagoCanonSchema>;

export const eliminarPagoSchema = z.object({ pagoId: id });
