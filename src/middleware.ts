import { NextResponse, type NextRequest } from "next/server";

import { actualizarSesion } from "@/lib/supabase/middleware";

/**
 * Refresca la sesión de Supabase y protege las rutas por rol.
 *
 *   /admin/*     → sólo ADMIN
 *   /mi-stand/*  → sólo VENDEDOR
 *   /ingresar, /registro → redirigen al panel si ya hay sesión
 *
 * El rol se lee de `app_metadata` del JWT, que sólo se puede escribir con la
 * service role key: un usuario no puede modificarse el suyo. Igual es sólo la
 * primera barrera — las páginas y las Server Actions vuelven a verificar
 * contra `public.usuarios` con los helpers de `src/lib/session.ts`.
 */
export async function middleware(peticion: NextRequest) {
  const { respuesta, usuario } = await actualizarSesion(peticion);

  const { nextUrl } = peticion;
  const rol = usuario?.app_metadata?.["rol"];

  const esRutaAdmin = nextUrl.pathname.startsWith("/admin");
  const esRutaVendedor = nextUrl.pathname.startsWith("/mi-stand");
  const esRutaDeAcceso =
    nextUrl.pathname === "/ingresar" || nextUrl.pathname === "/registro";

  function redirigirA(destino: string): NextResponse {
    const redireccion = NextResponse.redirect(new URL(destino, nextUrl));
    // Sin esto se perderían las cookies de sesión que acaba de refrescar
    // `actualizarSesion`, y el usuario quedaría deslogueado.
    for (const cookie of respuesta.cookies.getAll()) {
      redireccion.cookies.set(cookie);
    }
    return redireccion;
  }

  // Ya autenticado: no tiene sentido volver a ver login o registro.
  if (esRutaDeAcceso && usuario) {
    return redirigirA(rol === "ADMIN" ? "/admin" : "/mi-stand");
  }

  if (esRutaAdmin || esRutaVendedor) {
    if (!usuario) {
      const url = new URL("/ingresar", nextUrl);
      // Para volver a donde quería entrar después de iniciar sesión.
      url.searchParams.set("volverA", nextUrl.pathname + nextUrl.search);
      return redirigirA(url.pathname + url.search);
    }

    if (esRutaAdmin && rol !== "ADMIN") return redirigirA("/mi-stand");
    if (esRutaVendedor && rol !== "VENDEDOR") return redirigirA("/admin");
  }

  return respuesta;
}

export const config = {
  matcher: ["/admin/:path*", "/mi-stand/:path*", "/ingresar", "/registro"],
};
