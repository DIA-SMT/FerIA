import { cookies } from "next/headers";
import type { Rol } from "@prisma/client";

import { NOMBRE_COOKIE, opcionesCookie, opcionesParaBorrar } from "@/lib/auth/cookie";
import { emitirToken, leerToken, type Credencial } from "@/lib/auth/token";

/**
 * Leer y escribir la sesión en la cookie, del lado del servidor.
 *
 * Es la capa de abajo: acá no se consulta la base ni se decide nada sobre
 * permisos. Quien combina esto con `public.usuarios` y resuelve el rol real es
 * `src/lib/session.ts`.
 */

/** La credencial que trae la petición, o `null` si no hay sesión válida. */
export async function leerCredencial(): Promise<Credencial | null> {
  const almacen = await cookies();
  return leerToken(almacen.get(NOMBRE_COOKIE)?.value);
}

/**
 * Emite un token y lo deja en la cookie.
 *
 * Sólo se puede llamar desde una Server Action o un Route Handler: un Server
 * Component no puede escribir cookies.
 */
export async function abrirSesion(usuarioId: string, rol: Rol): Promise<void> {
  const token = await emitirToken(usuarioId, rol);
  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, token, opcionesCookie());
}

/** Borra la cookie de sesión. */
export async function cerrarSesionCookie(): Promise<void> {
  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, "", opcionesParaBorrar());
}

/**
 * El instante desde el cual valen los tokens de una cuenta.
 *
 * Se trunca al segundo a propósito. El `iat` de un JWT se mide en segundos
 * enteros, así que un token emitido a las 10:00:00.800 declara haber nacido a
 * las 10:00:00.000. Si acá se guardara el instante con milisegundos, una
 * invalidación hecha a las 10:00:00.500 dejaría afuera al token que se emite
 * inmediatamente después —el del cambio de contraseña, por ejemplo— y la
 * persona quedaría deslogueada justo cuando acaba de autenticarse.
 *
 * El costo es que un token emitido en el mismo segundo que la invalidación
 * sobrevive. Es un segundo, y en los dos casos en que esto se usa —cambio de
 * contraseña y cambio de rol— acto seguido se emite un token nuevo igual.
 */
export function instanteDeInvalidacion(ahora = new Date()): Date {
  return new Date(Math.floor(ahora.getTime() / 1000) * 1000);
}

/**
 * ¿El token se emitió después de la última invalidación de esa cuenta?
 *
 * Es la revocación. Un JWT no se puede retirar de circulación antes de que
 * venza —tampoco los de Supabase se podían—, así que en vez de perseguir el
 * token se mueve la fecha contra la que se lo compara.
 */
export function tokenSigueValiendo(
  credencial: Credencial,
  sesionesValidasDesde: Date,
): boolean {
  return credencial.emitidoEn.getTime() >= sesionesValidasDesde.getTime();
}
