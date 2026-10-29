import { DURACION_SEGUNDOS } from "@/lib/auth/token";

/**
 * La cookie que lleva el token de sesión.
 *
 * Los atributos de acá son la mitad de la seguridad del sistema, y son el tipo
 * de cosa que alguien "ordena" más adelante sin saber qué estaba sosteniendo.
 * Por eso están en un solo lugar, explicados, y con pruebas que los miran.
 */
export const NOMBRE_COOKIE = "feria_sesion";

export interface OpcionesCookie {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

/**
 * En desarrollo el sitio se sirve por `http://localhost`, y una cookie `secure`
 * no viaja por HTTP: con `secure` fijo en `true` nadie podría iniciar sesión en
 * su máquina. Es la única excepción, y se apoya en `NODE_ENV`, que Next fija
 * solo: no hay forma de prenderla sin querer en un deploy.
 */
function requiereHttps(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Atributos de la cookie de sesión.
 *
 *  · `httpOnly` — el JavaScript de la página no la puede leer. Sin esto, un XSS
 *    en cualquier rincón del sitio se lleva la sesión de quien lo visite.
 *  · `secure` — sólo por HTTPS, así no viaja en claro por la red.
 *  · `sameSite: "lax"` — no se manda en peticiones que origina otro sitio, que
 *    es lo que frena un CSRF. "Lax" y no "strict" porque el ingreso por CiDiTuc
 *    vuelve desde otro dominio: con "strict" la cookie recién puesta no se
 *    mandaría en esa vuelta y la persona aterrizaría deslogueada.
 *  · `maxAge` — tres días, lo mismo que dura el token. Que la cookie sobreviva
 *    al token sólo serviría para mandar basura que igual se va a rechazar.
 */
export function opcionesCookie(): OpcionesCookie {
  return {
    httpOnly: true,
    secure: requiereHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SEGUNDOS,
  };
}

/**
 * Atributos para borrarla.
 *
 * Tienen que coincidir con los de arriba en `path`, `secure` y `sameSite`: el
 * navegador identifica una cookie por nombre, dominio y camino, así que un
 * borrado con otro `path` deja la original viva y la persona sigue autenticada
 * después de haber apretado "cerrar sesión".
 */
export function opcionesParaBorrar(): OpcionesCookie {
  return { ...opcionesCookie(), maxAge: 0 };
}
