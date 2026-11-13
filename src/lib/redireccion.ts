import { NextResponse } from "next/server";

/**
 * Redirección con `Location` relativa, para los route handlers.
 *
 * Detrás de nginx, `request.url` en un route handler vale
 * `http://localhost:3003/...`: Next 15 no lo arma con las cabeceras
 * `X-Forwarded-*`. Con `new URL(ruta, request.url)`, la primera persona que
 * entró con CiDiTuc terminó en `localhost:3003/encuesta`. Una `Location`
 * relativa la resuelve el navegador contra la dirección que tiene en la barra,
 * así que anda igual en feria.smt.gob.ar, en local y en cualquier dominio
 * nuevo. `NextResponse.redirect` no sirve acá porque exige una URL absoluta.
 *
 * Sólo acepta rutas propias. `//otro.sitio` también es una URL relativa —sin
 * esquema— y el navegador la sigue a otro dominio: sería una redirección
 * abierta servida desde un sitio municipal.
 */
export function redireccionRelativa(ruta: string): NextResponse {
  if (!ruta.startsWith("/") || ruta.startsWith("//") || ruta.startsWith("/\\")) {
    throw new Error(`Ruta de redirección inválida: ${ruta}`);
  }

  return new NextResponse(null, { status: 307, headers: { Location: ruta } });
}
