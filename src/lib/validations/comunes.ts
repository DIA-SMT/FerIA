import { z } from "zod";

import { normalizarWhatsapp } from "@/lib/whatsapp";

/**
 * Piezas reutilizables de validación.
 *
 * Todo lo que llega de un `FormData` es `string`, así que los helpers se
 * encargan de convertir cadenas vacías en `null`/`undefined` y de castear
 * números, fechas y casillas.
 */

/** Texto obligatorio, ya recortado. */
export function texto(
  min: number,
  max: number,
  etiqueta: string,
): z.ZodString {
  return z
    .string({ required_error: `${etiqueta} es obligatorio.` })
    .trim()
    .min(min, `${etiqueta} debe tener al menos ${min} caracteres.`)
    .max(max, `${etiqueta} no puede superar los ${max} caracteres.`);
}

/** Texto opcional: la cadena vacía se guarda como `null`. */
export function textoOpcional(max: number, etiqueta = "El texto") {
  return z
    .string()
    .trim()
    .max(max, `${etiqueta} no puede superar los ${max} caracteres.`)
    .optional()
    .transform((valor) => (valor && valor.length > 0 ? valor : null));
}

/** Casilla de un formulario HTML: ausente = false, "on"/"true" = true. */
export const casilla = z.preprocess(
  (valor) => valor === "on" || valor === "true" || valor === true,
  z.boolean(),
);

/** Importe en pesos. Acepta coma o punto como separador decimal. */
export function importe(etiqueta: string) {
  return z.preprocess(
    (valor) =>
      typeof valor === "string" ? valor.trim().replace(",", ".") : valor,
    z.coerce
      .number({ invalid_type_error: `${etiqueta} debe ser un número.` })
      .min(0, `${etiqueta} no puede ser negativo.`)
      .max(999_999_999, `${etiqueta} es demasiado grande.`),
  );
}

/** Entero dentro de un rango. */
export function entero(min: number, max: number, etiqueta: string) {
  return z.coerce
    .number({ invalid_type_error: `${etiqueta} debe ser un número.` })
    .int(`${etiqueta} debe ser un número entero.`)
    .min(min, `${etiqueta} no puede ser menor a ${min}.`)
    .max(max, `${etiqueta} no puede ser mayor a ${max}.`);
}

/**
 * Fecha de un `<input type="date">`.
 *
 * Se interpreta a medianoche UTC porque las columnas son `DATE`: si se usara
 * la zona local, en Argentina (UTC-3) la fecha se correría un día.
 */
export function fecha(etiqueta: string) {
  return z
    .string({ required_error: `${etiqueta} es obligatoria.` })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${etiqueta} no es válida.`)
    .transform((valor) => new Date(`${valor}T00:00:00.000Z`));
}

/** Igual que `fecha` pero admite el campo vacío. */
export function fechaOpcional(etiqueta: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor && valor.length > 0 ? valor : null))
    .refine(
      (valor) => valor === null || /^\d{4}-\d{2}-\d{2}$/.test(valor),
      `${etiqueta} no es válida.`,
    )
    .transform((valor) =>
      valor === null ? null : new Date(`${valor}T00:00:00.000Z`),
    );
}

/** Coordenada opcional dentro de un rango razonable. */
export function coordenadaOpcional(min: number, max: number, etiqueta: string) {
  return z.preprocess(
    (valor) =>
      valor === "" || valor === null || valor === undefined ? undefined : valor,
    z.coerce
      .number({ invalid_type_error: `${etiqueta} debe ser un número.` })
      .min(min, `${etiqueta} debe estar entre ${min} y ${max}.`)
      .max(max, `${etiqueta} debe estar entre ${min} y ${max}.`)
      .optional(),
  );
}

/** Correo electrónico normalizado a minúsculas. */
export const email = z
  .string({ required_error: "El correo electrónico es obligatorio." })
  .trim()
  .toLowerCase()
  .min(1, "El correo electrónico es obligatorio.")
  .email("Ingresá un correo electrónico válido.")
  .max(160, "El correo electrónico es demasiado largo.");

/**
 * Contraseña. El mínimo de 8 es nuestro (Supabase acepta 6 por defecto);
 * el máximo de 72 lo impone bcrypt, que es lo que usa Supabase Auth por debajo.
 */
export const password = z
  .string({ required_error: "La contraseña es obligatoria." })
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede superar los 72 caracteres.");

/** Número de WhatsApp: se valida y se guarda normalizado para `wa.me`. */
export const whatsapp = z
  .string({ required_error: "El WhatsApp es obligatorio." })
  .trim()
  .min(1, "El WhatsApp es obligatorio.")
  .transform((valor, ctx) => {
    const normalizado = normalizarWhatsapp(valor);
    if (!normalizado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Número de WhatsApp inválido. Ejemplo: 381 512-3456 o +54 9 381 512-3456.",
      });
      return z.NEVER;
    }
    return normalizado;
  });

/** Teléfono fijo o alternativo. Se guarda tal cual lo escribieron. */
export const telefonoOpcional = textoOpcional(40, "El teléfono");

/** Usuario de Instagram: acepta "@juan", "juan" o la URL completa. */
export const instagramOpcional = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((valor) => {
    if (!valor) return null;
    const limpio = valor
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/\/+$/, "")
      .replace(/^@/, "")
      .trim();
    return limpio.length > 0 ? limpio : null;
  });

/** Página de Facebook: acepta URL completa o el nombre de usuario. */
export const facebookOpcional = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((valor) => {
    if (!valor) return null;
    const limpio = valor
      .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
      .replace(/\/+$/, "")
      .replace(/^@/, "")
      .trim();
    return limpio.length > 0 ? limpio : null;
  });

/** Sitio web: se le agrega `https://` si vino sin protocolo. */
export const sitioWebOpcional = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((valor) => {
    if (!valor) return null;
    const conProtocolo = /^https?:\/\//i.test(valor) ? valor : `https://${valor}`;
    return conProtocolo;
  })
  .refine(
    (valor) => {
      if (valor === null) return true;
      try {
        new URL(valor);
        return true;
      } catch {
        return false;
      }
    },
    { message: "El sitio web no es una dirección válida." },
  );

/** Identificador (cuid) que llega desde un campo oculto. */
export const id = z.string().trim().min(1, "Falta el identificador.");

/** Identificador opcional: la cadena vacía significa "sin asignar". */
export const idOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor && valor.length > 0 ? valor : null));
