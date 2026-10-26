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
  precio: importeOpcional("El precio"),
  stock: enteroOpcional(0, 1_000_000, "El stock"),
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
