import { CategoriaFeria, DiaSemana, EstadoEdicion } from "@prisma/client";
import { z } from "zod";

import { LIMITES_TUCUMAN } from "@/lib/geo";
import {
  casilla,
  coordenadaOpcional,
  entero,
  fecha,
  fechaOpcional,
  horaOpcional,
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
    (datos) => (datos.latitud === undefined) === (datos.longitud === undefined),
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
    /**
     * Los días llegan como una casilla por día, todas con el mismo `name`.
     * `FormData.getAll` devuelve un arreglo, y `Object.fromEntries` se queda
     * sólo con el último valor, así que la acción las junta a mano antes de
     * validar y acá llegan ya como arreglo.
     */
    diasSemana: z
      .array(z.nativeEnum(DiaSemana))
      .default([])
      .refine((dias) => new Set(dias).size === dias.length, {
        message: "Hay un día repetido.",
      }),
    horaApertura: horaOpcional("La hora de apertura"),
    horaCierre: horaOpcional("La hora de cierre"),
    /** Pasó a opcional: ahora es la aclaración, no el dato principal. */
    horario: textoOpcional(160, "La aclaración de horario"),
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
  })
  // Las dos horas van juntas o no va ninguna: con una sola no se puede
  // escribir "8:00 a 14:00", y la tarjeta terminaría mostrando media verdad.
  .refine(
    (datos) => (datos.horaApertura === null) === (datos.horaCierre === null),
    {
      message: "Cargá las dos horas, o ninguna.",
      path: ["horaCierre"],
    },
  )
  // Una feria que cierra antes de abrir es un error de tipeo, y se nota recién
  // cuando alguien va a las ocho y encuentra el parque vacío.
  .refine(
    (datos) =>
      datos.horaApertura === null ||
      datos.horaCierre === null ||
      datos.horaCierre > datos.horaApertura,
    {
      message: "La hora de cierre tiene que ser posterior a la de apertura.",
      path: ["horaCierre"],
    },
  )
  // Sin vencimiento, un canon impago nunca escala: el permiso queda PENDIENTE
  // para siempre, no entra en "Permisos vencidos" y el responsable cree que
  // está todo cobrado. La falla es hacia el lado tranquilizador, que es el
  // peor: por eso se exige la fecha acá, donde el formulario no puede
  // saltearla (tiene `noValidate`, así que el `required` del HTML no alcanza).
  .refine((datos) => datos.montoCanon <= 0 || datos.vencimientoCanon !== null, {
    message:
      "Si la edición cobra canon, cargá hasta cuándo hay tiempo de pagarlo.",
    path: ["vencimientoCanon"],
  });

export type DatosEdicion = z.infer<typeof edicionSchema>;

export const eliminarSchema = z.object({ id });
