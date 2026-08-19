import { z } from "zod";

import {
  casilla,
  id,
  texto,
  textoOpcional,
} from "@/lib/validations/comunes";

/**
 * Alta y edición de un producto del catálogo del feriante.
 *
 * Sin precio a propósito: el catálogo es una vidriera y el valor se acuerda por
 * WhatsApp entre el vecino y quien produce.
 */
export const productoSchema = z.object({
  nombre: texto(2, 140, "El nombre del producto"),
  descripcion: textoOpcional(1500, "La descripción"),
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
