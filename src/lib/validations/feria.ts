import { CategoriaFeria, EstadoEdicion } from "@prisma/client";
import { z } from "zod";

import { LIMITES_TUCUMAN } from "@/lib/geo";
import {
  casilla,
  coordenadaOpcional,
  entero,
  fecha,
  fechaOpcional,
  id,
  importe,
  texto,
  textoOpcional,
} from "@/lib/validations/comunes";

/** Alta y edición de una feria. */
export const feriaSchema = z
  .object({
    nombre: texto(3, 140, "El nombre"),
    descripcion: texto(10, 4000, "La descripción"),
    categoria: z.nativeEnum(CategoriaFeria, {
      errorMap: () => ({ message: "Elegí una categoría." }),
    }),
    direccion: texto(3, 240, "La dirección"),
    latitud: coordenadaOpcional(
      LIMITES_TUCUMAN.latMin,
      LIMITES_TUCUMAN.latMax,
      "La latitud",
    ),
    longitud: coordenadaOpcional(
      LIMITES_TUCUMAN.lngMin,
      LIMITES_TUCUMAN.lngMax,
      "La longitud",
    ),
    activa: casilla,
  })
  .refine(
    (datos) =>
      (datos.latitud === undefined) === (datos.longitud === undefined),
    {
      message: "Cargá latitud y longitud juntas, o dejá las dos vacías.",
      path: ["longitud"],
    },
  );

export type DatosFeria = z.infer<typeof feriaSchema>;

/** Alta y edición de una edición de feria. */
export const edicionSchema = z
  .object({
    feriaId: id,
    nombre: textoOpcional(140, "El nombre de la edición"),
    fechaInicio: fecha("La fecha de inicio"),
    fechaFin: fecha("La fecha de fin"),
    horario: texto(3, 160, "El horario"),
    estado: z.nativeEnum(EstadoEdicion, {
      errorMap: () => ({ message: "Elegí un estado." }),
    }),
    cantidadStands: entero(0, 500, "La cantidad de stands"),
    montoCanon: importe("El canon"),
    vencimientoCanon: fechaOpcional("La fecha de vencimiento del canon"),
  })
  .refine((datos) => datos.fechaFin >= datos.fechaInicio, {
    message: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["fechaFin"],
  });

export type DatosEdicion = z.infer<typeof edicionSchema>;

export const eliminarSchema = z.object({ id });
