import bcrypt from "bcryptjs";

/**
 * Contraseñas.
 *
 * Se usa bcrypt y no algo más moderno por una razón concreta: las contraseñas
 * que ya existen vienen de Supabase Auth, que las guardaba en bcrypt
 * (`$2a$10$`). Cambiar de algoritmo obligaría a que las dieciséis personas
 * eligieran una contraseña nueva, y eso convertiría una mudanza invisible en
 * una molestia para todos. Ver docs/autenticacion.md.
 *
 * El costo 10 es el que usaba Supabase, así que los hashes heredados y los
 * nuevos salen del mismo molde.
 */
const COSTO = 10;

/**
 * Hash de descarte, contra el que se compara cuando el usuario no existe.
 *
 * Sin esto, un inicio de sesión con un correo inexistente responde mucho más
 * rápido que uno con la contraseña equivocada, porque se saltea el bcrypt. Esa
 * diferencia de tiempo alcanza para averiguar qué correos están registrados en
 * la plataforma, que es justo lo que el mensaje de error único evita decir.
 *
 * Es el hash de una cadena aleatoria que nadie conoce y que no pertenece a
 * ninguna cuenta: aunque se publique, no abre nada.
 */
const HASH_DE_DESCARTE =
  "$2b$10$6z2fDcbQMYYOkX3Ll3bXq.jnrzw9lqzAbgda4ftdyQHJbsfMDPYZu";

/** Convierte una contraseña en el hash que se guarda en `usuarios`. */
export async function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO);
}

/**
 * ¿La contraseña corresponde a ese hash?
 *
 * Acepta `hash` nulo a propósito, y ése es el punto: una cuenta de CiDiTuc no
 * tiene contraseña, y una cuenta inexistente tampoco. En los dos casos hay que
 * contestar que no **después de haber trabajado lo mismo** que en el caso bueno,
 * así que igual se corre un bcrypt contra el hash de descarte.
 */
export async function verificarPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, HASH_DE_DESCARTE);
    return false;
  }

  return bcrypt.compare(password, hash);
}
