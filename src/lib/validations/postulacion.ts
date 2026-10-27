import { z } from "zod";

import {
  facebookOpcional,
  id,
  idOpcional,
  instagramOpcional,
  sitioWebOpcional,
  telefonoOpcional,
  texto,
  textoOpcional,
  whatsapp,
} from "@/lib/validations/comunes";
import { Rubro } from "@prisma/client";

/**
 * La encuesta con la que alguien pide el alta como feriante.
 *
 * Lo que **no** pide, y es el punto del cambio: nombre, correo, documento,
 * contraseña y su confirmación. Los tres primeros los da CiDiTuc y los dos
 * últimos dejan de existir, porque cuando se completa esta encuesta la persona
 * ya está autenticada. El registro viejo pedía catorce campos; acá quedan los
 * del emprendimiento.
 *
 * `feriaId` es **opcional**, y ahí está la decisión de fondo. Antes era
 * obligatorio: había que elegir una feria presencial para poder existir en la
 * plataforma, aunque lo único que quisieras fuera tu vidriera. Ahora son dos
 * permisos separados —ser feriante habilita el stand virtual, estar en una
 * feria se pide aparte— y esto es apenas un atajo para no obligar a volver a
 * entrar: si se elige una, el pedido queda encolado y la Dirección lo ve recién
 * cuando aprueba el alta.
 */
export const encuestaSchema = z.object({
  feriaId: idOpcional,

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

/**
 * Bajarse de una feria presencial.
 *
 * No pide motivo, a diferencia de un rechazo. Rechazar es una decisión de la
 * Dirección sobre una persona y tiene que quedar fundada; bajarse es una
 * decisión del feriante sobre sí mismo y no le debe explicación a nadie.
 */
export const retirarmeSchema = z.object({ postulacionId: id });
