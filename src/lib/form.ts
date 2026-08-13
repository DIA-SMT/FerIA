import { ZodError } from "zod";

import { esControlDeFlujoDeNext } from "@/lib/errores";

/**
 * Estado que devuelven todas las Server Actions de formularios.
 * Se consume desde el cliente con `useActionState`.
 */
export interface EstadoFormulario {
  ok?: boolean;
  mensaje?: string;
  /** Errores por campo, tal como los agrupa Zod. */
  errores?: Record<string, string[]>;
}

export const ESTADO_INICIAL: EstadoFormulario = {};

/** Convierte un `ZodError` en el estado que espera el formulario. */
export function estadoDesdeZod(error: ZodError): EstadoFormulario {
  const porCampo = error.flatten().fieldErrors;
  const errores: Record<string, string[]> = {};

  for (const [campo, mensajes] of Object.entries(porCampo)) {
    if (mensajes && mensajes.length > 0) errores[campo] = mensajes;
  }

  // Errores que no corresponden a un campo puntual (ej. reglas cruzadas).
  const generales = error.flatten().formErrors;

  return {
    ok: false,
    mensaje: generales[0] ?? "Revisá los datos ingresados.",
    errores,
  };
}

export function estadoDeError(mensaje: string): EstadoFormulario {
  return { ok: false, mensaje };
}

export function estadoDeExito(mensaje: string): EstadoFormulario {
  return { ok: true, mensaje };
}

/**
 * Envuelve el cuerpo de una Server Action para no repetir el try/catch.
 *
 * Traduce los errores de Zod y los de restricciones únicas de Prisma en
 * mensajes legibles, y deja pasar los `redirect()` de Next.js.
 */
export async function ejecutarAccion(
  cuerpo: () => Promise<EstadoFormulario>,
): Promise<EstadoFormulario> {
  try {
    return await cuerpo();
  } catch (error) {
    // `redirect()` y `notFound()` funcionan lanzando: hay que dejarlos subir.
    if (esControlDeFlujoDeNext(error)) throw error;

    if (error instanceof ZodError) {
      return estadoDesdeZod(error);
    }

    if (esErrorDeUnicidad(error)) {
      return estadoDeError(
        "Ya existe un registro con esos datos. Revisá los campos únicos.",
      );
    }

    console.error("[accion]", error);
    return estadoDeError(
      error instanceof Error && error.message
        ? error.message
        : "Ocurrió un error inesperado. Intentá de nuevo.",
    );
  }
}

/** Detecta el código P2002 de Prisma (violación de restricción única). */
function esErrorDeUnicidad(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
