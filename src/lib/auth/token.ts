import { SignJWT, jwtVerify } from "jose";
import type { Rol } from "@prisma/client";

/**
 * El token de sesión.
 *
 * Es un JWT firmado con HS256 que viaja en una cookie. Lleva lo justo para que
 * el middleware decida sin consultar la base: quién es y qué rol tiene. Todo lo
 * demás se resuelve en `src/lib/session.ts`, que sí consulta.
 *
 * Esa división es deliberada y es la que ya existía con Supabase: el middleware
 * es la primera barrera y puede equivocarse hacia el lado permisivo sin que eso
 * sea una brecha, porque cada página y cada Server Action vuelven a verificar
 * contra `public.usuarios`. Ver docs/autenticacion.md.
 *
 * Se firma con `jose` y no con `jsonwebtoken` porque el middleware de Next corre
 * en el runtime Edge, donde no están los módulos de Node. `jose` anda en los dos.
 */

/**
 * Tres días.
 *
 * Con la renovación deslizante de abajo, para quien entra seguido se comporta
 * como una sesión que no se cae nunca. Lo que acorta es la ventana de una sesión
 * olvidada: el panel municipal aprueba feriantes y registra pagos, y se abre
 * desde máquinas de oficina compartidas.
 */
export const DURACION_SEGUNDOS = 3 * 24 * 60 * 60;

/** Datos que viajan adentro del token. */
export interface Credencial {
  usuarioId: string;
  rol: Rol;
  /** Cuándo se emitió. Se compara contra `usuarios.sesionesValidasDesde`. */
  emitidoEn: Date;
}

/** Los roles válidos, para no confiar en lo que diga el token. */
const ROLES: readonly string[] = ["ADMIN", "VENDEDOR"];

/**
 * El secreto de firma.
 *
 * No tiene valor por defecto y no lo va a tener: un secreto por defecto es un
 * sistema sin autenticación, porque cualquiera que lea el repositorio —que es
 * público— podría firmarse un token de ADMIN.
 *
 * Se exige una longitud mínima porque HS256 no se queja de una clave corta:
 * firma igual, sólo que se puede romper a fuerza bruta.
 */
function secreto(): Uint8Array {
  const valor = process.env.SESION_SECRETO;

  if (!valor || valor.length < 32) {
    throw new Error(
      "Falta SESION_SECRETO, o es más corta que 32 caracteres. Generá una con: openssl rand -hex 32",
    );
  }

  return new TextEncoder().encode(valor);
}

/** Firma un token nuevo para esta cuenta. */
export async function emitirToken(usuarioId: string, rol: Rol): Promise<string> {
  return new SignJWT({ rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(secreto());
}

/**
 * Verifica un token y devuelve lo que trae, o `null` si no sirve.
 *
 * Devuelve `null` y no lanza para todos los casos malos —firma inválida,
 * vencido, manipulado, ausente— porque para quien llama son todos lo mismo: no
 * hay sesión. Distinguirlos sólo serviría para contarle a quien lo intenta
 * cuánto le faltó.
 *
 * El algoritmo va fijado a propósito. Sin eso, un token que declare `alg: none`
 * o un algoritmo distinto podría pasar la verificación sin firma válida.
 */
export async function leerToken(
  token: string | undefined | null,
): Promise<Credencial | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secreto(), {
      algorithms: ["HS256"],
    });

    const rol = payload["rol"];

    // El token está firmado por nosotros, pero igual se valida la forma: un rol
    // desconocido tiene que ser "sin sesión" y no un valor raro circulando por
    // las comparaciones de más arriba.
    if (!payload.sub || typeof rol !== "string" || !ROLES.includes(rol)) {
      return null;
    }

    return {
      usuarioId: payload.sub,
      rol: rol as Rol,
      emitidoEn: new Date((payload.iat ?? 0) * 1000),
    };
  } catch {
    return null;
  }
}

/**
 * ¿Conviene emitir un token nuevo?
 *
 * Renovación deslizante: pasada la mitad de la vida del token, el middleware
 * emite otro. Quien usa la plataforma no se desloguea nunca y quien la abandona
 * caduca a los tres días, sin necesidad de un refresh token aparte.
 */
export function convieneRenovar(credencial: Credencial, ahora = new Date()): boolean {
  const vividos = (ahora.getTime() - credencial.emitidoEn.getTime()) / 1000;
  return vividos > DURACION_SEGUNDOS / 2;
}
