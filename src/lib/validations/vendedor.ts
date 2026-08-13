import { Rubro } from "@prisma/client";
import { z } from "zod";

import {
  email,
  facebookOpcional,
  id,
  instagramOpcional,
  password,
  sitioWebOpcional,
  telefonoOpcional,
  texto,
  textoOpcional,
  whatsapp,
} from "@/lib/validations/comunes";

/** Registro público de un feriante. Queda en estado PENDIENTE. */
export const registroVendedorSchema = z
  .object({
    // Datos personales
    nombre: texto(2, 120, "El nombre y apellido"),
    email,
    password,
    confirmarPassword: z.string().min(1, "Repetí la contraseña."),
    dni: textoOpcional(20, "El DNI"),
    direccion: textoOpcional(200, "La dirección"),

    // Emprendimiento
    emprendimiento: texto(2, 120, "El nombre del emprendimiento"),
    rubro: z.nativeEnum(Rubro, {
      errorMap: () => ({ message: "Elegí un rubro." }),
    }),
    descripcion: textoOpcional(2000, "La descripción"),

    // Contacto
    whatsapp,
    telefono: telefonoOpcional,

    // Redes
    instagram: instagramOpcional,
    facebook: facebookOpcional,
    sitioWeb: sitioWebOpcional,
  })
  .refine((datos) => datos.password === datos.confirmarPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmarPassword"],
  });

export type RegistroVendedor = z.infer<typeof registroVendedorSchema>;

/** Edición del perfil de la vidriera por parte del propio feriante. */
export const perfilVendedorSchema = z.object({
  emprendimiento: texto(2, 120, "El nombre del emprendimiento"),
  rubro: z.nativeEnum(Rubro, {
    errorMap: () => ({ message: "Elegí un rubro." }),
  }),
  descripcion: textoOpcional(2000, "La descripción"),
  whatsapp,
  telefono: telefonoOpcional,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .optional()
    .transform((valor) => (valor && valor.length > 0 ? valor : null))
    .refine(
      (valor) => valor === null || z.string().email().safeParse(valor).success,
      { message: "El correo de contacto no es válido." },
    ),
  instagram: instagramOpcional,
  facebook: facebookOpcional,
  sitioWeb: sitioWebOpcional,
  direccion: textoOpcional(200, "La dirección"),
});

export type PerfilVendedor = z.infer<typeof perfilVendedorSchema>;

/** Aprobación de una solicitud por parte del personal municipal. */
export const aprobarVendedorSchema = z.object({
  vendedorId: id,
});

/** Rechazo de una solicitud: el motivo es obligatorio y se le muestra al feriante. */
export const rechazarVendedorSchema = z.object({
  vendedorId: id,
  motivoRechazo: texto(10, 500, "El motivo del rechazo"),
});
