/**
 * Cookies propias de la aplicación.
 *
 * El prefijo `__Host-` no es decorativo. `gob.ar` está en la Public Suffix
 * List, así que para el navegador el sitio es `smt.gob.ar` entero: cualquier
 * otro sistema del municipio puede plantar una cookie con el mismo nombre que
 * las nuestras. Con `__Host-` el navegador sólo la acepta si viene con
 * `Secure`, `Path=/` y sin `Domain`, o sea, escrita por este mismo host.
 *
 * En `http://localhost` no hay `Secure`, y una `__Host-` sin `Secure` el
 * navegador la descarta **en silencio**: la sesión «no se guarda» y no hay
 * ningún error que lo explique. Por eso el prefijo depende del entorno.
 */

function seguras(): boolean {
  return process.env.NODE_ENV === "production";
}

export function nombreCookie(base: string): string {
  return seguras() ? `__Host-${base}` : base;
}

/**
 * `SameSite=Lax` y no `Strict`: la vuelta desde CiDiTuc es una navegación que
 * viene de otro sitio, y con `Strict` el navegador no manda la cookie del
 * `state`, así que el ingreso fallaría siempre.
 */
export function atributosCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: seguras(),
    path: "/",
  };
}

/**
 * Borrar una cookie es escribirla vencida **con los mismos atributos** con que
 * se escribió. Con otros, el navegador ignora el borrado y la cookie queda.
 */
export function borradoCookie(nombre: string) {
  return { name: nombre, ...atributosCookie() };
}
