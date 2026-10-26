import { z } from "zod";

import {
  facebookOpcional,
  id,
  instagramOpcional,
  sitioWebOpcional,
  telefonoOpcional,
  texto,
  textoOpcional,
  whatsapp,
} from "@/lib/validations/comunes";
import { Rubro } from "@prisma/client";

/**
 * La encuesta con la que un feriante se postula a una feria.
 *
 * Lo que **no** pide, y es el punto del cambio: nombre, correo, documento,
 * contraseña y su confirmación. Los tres primeros los da CiDiTuc y los dos
 * últimos dejan de existir, porque cuando se completa esta encuesta la persona
 * ya está autenticada. El registro viejo pedía catorce campos; acá quedan los
 * del emprendimiento, más la feria.
 */
export const encuestaSchema = z.object({
  feriaId: id,

  emprendimiento: texto(3, 140, "El nombre del emprendimiento"),
  rubro: z.nativeEnum(Rubro, {
    errorMap: () => ({ message: "Elegí un rubro." }),
  }),
  descripcion: textoOpcional(1500, "La descripción"),

  whatsapp,
  telefono: telefonoOpcional,
  instagram: instagramOpcional,
  facebook: facebookOpcional,
  sitioWeb: sitioWebOpcional,
  direccion: textoOpcional(200, "El domicilio"),

  /**
   * El cuerpo de la encuesta: qué lleva, desde cuándo produce, si ya participó.
   * Lo lee quien decide, así que es lo único que de verdad informa la decisión.
   */
  mensaje: textoOpcional(1000, "El mensaje"),
});

export type DatosEncuesta = z.infer<typeof encuestaSchema>;

/** Postularse a otra feria, cuando la ficha ya existe. */
export const postulacionSchema = z.object({
  feriaId: id,
  mensaje: textoOpcional(1000, "El mensaje"),
});

export const resolverPostulacionSchema = z
  .object({
    postulacionId: id,
    decision: z.enum(["ACEPTADA", "RECHAZADA"], {
      errorMap: () => ({ message: "Decisión no válida." }),
    }),
    motivoRechazo: textoOpcional(300, "El motivo"),
  })
  // Rechazar sin decir por qué deja al feriante sin saber qué corregir, y a la
  // Dirección sin registro de la decisión. Es el mismo criterio que ya rige
  // para rechazar una solicitud de alta.
  .refine(
    (datos) => datos.decision !== "RECHAZADA" || datos.motivoRechazo !== null,
    {
      message: "Para rechazar hace falta un motivo.",
      path: ["motivoRechazo"],
    },
  );
