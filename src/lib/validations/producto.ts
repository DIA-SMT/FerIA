import { z } from "zod";

import {
  casilla,
  enteroOpcional,
  id,
  importeOpcional,
  texto,
  textoOpcional,
} from "@/lib/validations/comunes";

/**
 * Alta y edición de un producto del catálogo del feriante.
 *
 * El precio es opcional incluso con el marketplace prendido: hay productos que
 * se hacen a medida y hay fichas que vinieron del padrón sin precio. Un
 * producto sin precio se muestra igual y se consulta por WhatsApp, como se hizo
 * siempre; lo que no se puede es ponerlo en el carrito.
 */
export const productoSchema = z.object({
  nombre: texto(2, 140, "El nombre del producto"),
  descripcion: textoOpcional(1500, "La descripción"),
  /*
    `.optional()` no es decorativo: con `PERMITIR_PRECIOS` apagado el formulario
    ni dibuja estos dos campos, así que no llegan en el `FormData`. Sin esto el
    `coerce` recibía `undefined`, daba NaN y el guardado fallaba entero con un
    «Revisá los datos ingresados» que no marcaba ningún campo en rojo, porque el
    campo del error no estaba en pantalla.

    Y tiene que ser `undefined`, no `null`: ausente significa «el formulario no
    opina», y Prisma lo deja como está. `null` significaría borrar el precio, que
    es lo que pasaría al editar una ficha importada con precio cargado.
  */
  precio: importeOpcional("El precio").optional(),
  stock: enteroOpcional(0, 1_000_000, "El stock").optional(),
  disponible: casilla,
  destacado: casilla,
  /**
   * Imágenes ya cargadas que se conservan. Las nuevas llegan también como rutas
   * —no como archivos—: el selector de fotos ya las subió a Storage.
   */
  imagenesActuales: z
    .string()
    .optional()
    .transform((valor) =>
      valor
        ? valor
            .split(",")
            .map((ruta) => ruta.trim())
            .filter(Boolean)
        : [],
    ),
});

export type DatosProducto = z.infer<typeof productoSchema>;

export const eliminarProductoSchema = z.object({ productoId: id });

export const alternarDisponibilidadSchema = z.object({ productoId: id });
