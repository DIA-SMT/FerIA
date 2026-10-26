import { z } from "zod";

import {
  id,
  idOpcional,
  texto,
  textoOpcional,
  whatsapp,
} from "@/lib/validations/comunes";

/**
 * Pedido de un vecino a un feriante.
 *
 * Lo que **no** está acá es tan importante como lo que está: no hay precio, no
 * hay total y no hay medio de pago.
 *
 * Los precios no viajan en el formulario porque el cliente no es una fuente
 * confiable de cuánto sale algo. El navegador manda qué producto y cuántas
 * unidades; el servidor busca el producto, lee el precio de la base y arma el
 * pedido con eso. Si alguien edita el carrito en el navegador para poner un
 * alfajor a $1, lo único que logra es que el pedido salga con el precio real.
 *
 * El total no está porque no se guarda: se deriva de las líneas
 * (`src/lib/pedidos.ts`). Y el medio de pago no está porque el municipio no
 * cobra: lo arreglan el vecino y el feriante por WhatsApp.
 */

/** Una línea del carrito tal como llega del navegador. */
export const lineaPedidoSchema = z.object({
  productoId: id,
  cantidad: z.coerce
    .number({ invalid_type_error: "La cantidad debe ser un número." })
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad mínima es 1.")
    // Tope por línea: no es una regla de negocio, es un freno. Un pedido de
    // 10.000 alfajores a un puesto de feria es un error de tipeo o una broma,
    // y en los dos casos conviene que no llegue.
    .max(99, "La cantidad máxima por producto es 99."),
});

export const pedidoSchema = z.object({
  /** El stand al que se le pide. Se resuelve contra la base por slug. */
  vendedorSlug: texto(1, 120, "El stand"),

  compradorNombre: texto(2, 120, "Tu nombre"),
  compradorWhatsapp: whatsapp,
  /**
   * El correo es opcional a propósito. Pedir lo mínimo es la única forma
   * honesta de tratar datos de alguien que sólo quiere comprar unos alfajores:
   * con el WhatsApp alcanza para que el feriante le responda.
   */
  compradorEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((valor) => (valor && valor.length > 0 ? valor : null))
    .refine(
      (valor) => valor === null || z.string().email().safeParse(valor).success,
      { message: "Ingresá un correo electrónico válido." },
    ),

  notas: textoOpcional(500, "Las aclaraciones"),

  modoEntrega: z.enum(["RETIRO_EN_FERIA", "ACUERDA_CON_FERIANTE"], {
    errorMap: () => ({ message: "Elegí cómo querés recibirlo." }),
  }),
  /** Edición en la que retira. Sólo se usa si el modo es RETIRO_EN_FERIA. */
  edicionId: idOpcional,

  /** El carrito, serializado como JSON en un campo oculto. */
  items: z
    .string({ required_error: "El carrito está vacío." })
    .transform((valor, ctx) => {
      let crudo: unknown;
      try {
        crudo = JSON.parse(valor);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "No pudimos leer el carrito. Volvé a armarlo.",
        });
        return z.NEVER;
      }

      const parseado = z
        .array(lineaPedidoSchema)
        .min(1)
        .max(50)
        .safeParse(crudo);
      if (!parseado.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El carrito está vacío o tiene datos inválidos.",
        });
        return z.NEVER;
      }

      return parseado.data;
    }),
});

export type DatosPedido = z.infer<typeof pedidoSchema>;

export const cambiarEstadoPedidoSchema = z.object({
  pedidoId: id,
  estado: z.enum(["CONFIRMADO", "ENTREGADO", "CANCELADO"], {
    errorMap: () => ({ message: "Estado no válido." }),
  }),
  motivoCancelacion: textoOpcional(300, "El motivo"),
});
