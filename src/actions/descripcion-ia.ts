"use server";

import { Rubro } from "@prisma/client";

import { esControlDeFlujoDeNext } from "@/lib/errores";
import { ErrorDeRedaccion, redactarDescripcionConIA } from "@/lib/ia-texto";
import { RUBROS } from "@/lib/labels";
import {
  modoSegunTexto,
  type EstadoRedaccion,
} from "@/lib/redaccion";
import { requerirVendedorAprobado } from "@/lib/session";

/**
 * Redacción asistida de la descripción del emprendimiento.
 *
 * Devuelve una propuesta y nada más: no toca la base. El feriante la acepta, la
 * descarta o pide otra, y si la acepta puede volver a su texto anterior. Guardar
 * sigue siendo cosa de `actualizarPerfilVendedor`.
 *
 * Los tipos están en `@/lib/redaccion` porque este módulo es `"use server"` y
 * sólo puede exportar funciones async.
 */
export async function redactarDescripcion(
  _estado: EstadoRedaccion,
  datos: FormData,
): Promise<EstadoRedaccion> {
  try {
    const { vendedor } = await requerirVendedorAprobado();

    // El nombre y el rubro se leen del formulario porque el feriante puede
    // estar editándolos en esta misma pantalla; si vienen inservibles, se cae a
    // lo que hay guardado.
    const nombreEnviado = String(datos.get("emprendimiento") ?? "").trim();
    const nombre = nombreEnviado.slice(0, 120) || vendedor.emprendimiento;

    const rubroEnviado = String(datos.get("rubro") ?? "");
    const rubro =
      rubroEnviado in Rubro ? (rubroEnviado as Rubro) : vendedor.rubro;

    // El modo lo decide el servidor a partir del texto real, no el cliente: es
    // lo que determina si hay que conservar lo escrito o armar la estructura.
    const escrito = String(datos.get("descripcion") ?? "");
    const modo = modoSegunTexto(escrito);

    const sugerencia = await redactarDescripcionConIA(modo, {
      nombre,
      categoria: RUBROS[rubro],
      descripcion: escrito,
    });

    return { ok: true, sugerencia, modo };
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;

    return {
      ok: false,
      mensaje:
        error instanceof ErrorDeRedaccion
          ? error.message
          : error instanceof Error
            ? error.message
            : "No se pudo redactar la descripción. Probá de nuevo.",
    };
  }
}
