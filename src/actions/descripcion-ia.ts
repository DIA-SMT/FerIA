"use server";

import { Rubro } from "@prisma/client";

import { esControlDeFlujoDeNext } from "@/lib/errores";
import { ErrorDeRedaccion, redactarDescripcionConIA } from "@/lib/ia-texto";
import { RUBROS } from "@/lib/labels";
import { crearLimiteDeRitmo } from "@/lib/limite-de-ritmo";
import {
  modoSegunTexto,
  type EstadoRedaccion,
} from "@/lib/redaccion";
import { requerirSesion, requerirVendedorAprobado } from "@/lib/session";

/**
 * Redacción asistida de la descripción del emprendimiento.
 *
 * Devuelve una propuesta y nada más: no toca la base. El feriante la acepta, la
 * descarta o pide otra, y si la acepta puede volver a su texto anterior. Guardar
 * sigue siendo cosa del formulario donde está el campo.
 *
 * Hay dos puertas, una por pantalla: el perfil del feriante aprobado y la
 * encuesta del alta, donde todavía no hay ficha.
 *
 * Los tipos están en `@/lib/redaccion` porque este módulo es `"use server"` y
 * sólo puede exportar funciones async.
 */

/** Desde el perfil de un feriante aprobado. */
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

    return await proponer(nombre, rubro, String(datos.get("descripcion") ?? ""));
  } catch (error) {
    return comoEstado(error);
  }
}

/**
 * Diez propuestas cada diez minutos por cuenta, en el alta.
 *
 * El perfil no lo necesita: ahí entra sólo quien la Dirección ya aprobó. En la
 * encuesta alcanza con haber entrado por CiDiTuc, y cada propuesta es una
 * llamada paga al modelo. Diez da para probar varias redacciones de sobra.
 */
const superaElLimiteDelAlta = crearLimiteDeRitmo({
  ventanaMs: 10 * 60 * 1000,
  maximo: 10,
});

/**
 * Desde la encuesta del alta, cuando todavía no hay ficha.
 *
 * Sin ficha no hay nada guardado a qué caer: el nombre y el rubro tienen que
 * venir del formulario, y el botón no se ofrece hasta que estén.
 */
export async function redactarDescripcionDelAlta(
  _estado: EstadoRedaccion,
  datos: FormData,
): Promise<EstadoRedaccion> {
  try {
    const sesion = await requerirSesion();

    const nombre = String(datos.get("emprendimiento") ?? "").trim().slice(0, 120);
    const rubroEnviado = String(datos.get("rubro") ?? "");
    if (!nombre || !(rubroEnviado in Rubro)) {
      return {
        ok: false,
        mensaje: "Completá el nombre y el rubro, así la IA sabe de qué escribir.",
      };
    }

    if (superaElLimiteDelAlta(sesion.id)) {
      return {
        ok: false,
        mensaje:
          "Pediste muchas redacciones seguidas. Esperá unos minutos y probá de nuevo.",
      };
    }

    return await proponer(
      nombre,
      rubroEnviado as Rubro,
      String(datos.get("descripcion") ?? ""),
    );
  } catch (error) {
    return comoEstado(error);
  }
}

async function proponer(
  nombre: string,
  rubro: Rubro,
  escrito: string,
): Promise<EstadoRedaccion> {
  // El modo lo decide el servidor a partir del texto real, no el cliente: es
  // lo que determina si hay que conservar lo escrito o armar la estructura.
  const modo = modoSegunTexto(escrito);

  const sugerencia = await redactarDescripcionConIA(modo, {
    nombre,
    categoria: RUBROS[rubro],
    descripcion: escrito,
  });

  return { ok: true, sugerencia, modo };
}

function comoEstado(error: unknown): EstadoRedaccion {
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
