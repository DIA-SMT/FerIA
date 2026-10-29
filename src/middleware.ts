import { NextResponse, type NextRequest } from "next/server";

import { NOMBRE_COOKIE, opcionesCookie } from "@/lib/auth/cookie";
import { convieneRenovar, emitirToken, leerToken } from "@/lib/auth/token";

/**
 * Protege las rutas por rol y renueva el token.
 *
 *   /admin/*     → sólo ADMIN
 *   /mi-stand/*  → sólo VENDEDOR
 *   /encuesta    → cualquiera con sesión (todavía no tiene ficha de feriante)
 *   /ingresar, /registro → redirigen al panel si ya hay sesión
 *
 * El rol se lee del token, que está firmado con un secreto que sólo conoce el
 * servidor: nadie puede escribirse uno propio. Igual es sólo la primera barrera
 * —las páginas y las Server Actions vuelven a verificar contra
 * `public.usuarios` con los helpers de `src/lib/session.ts`—, y eso importa
 * porque acá no se consulta la base: un rol que cambió hace un minuto todavía
 * puede venir viejo en el token. Ver docs/autenticacion.md.
 *
 * Antes esto llamaba a Supabase por HTTP en cada petición protegida. Ahora es
 * una verificación de firma local: más rápido, y el panel no deja de abrirse
 * porque un tercero esté lento.
 */
export async function middleware(peticion: NextRequest) {
  const credencial = await leerToken(peticion.cookies.get(NOMBRE_COOKIE)?.value);
  const rol = credencial?.rol;

  const { nextUrl } = peticion;
  const esRutaAdmin = nextUrl.pathname.startsWith("/admin");
  const esRutaVendedor = nextUrl.pathname.startsWith("/mi-stand");
  // La encuesta es el paso entre el ingreso por CiDiTuc y tener ficha: pide
  // sesión, pero no rol de feriante, porque la ficha todavía no existe.
  const esEncuesta = nextUrl.pathname === "/encuesta";
  const esRutaDeAcceso =
    nextUrl.pathname === "/ingresar" || nextUrl.pathname === "/registro";

  /**
   * Renovación deslizante.
   *
   * Pasada la mitad de la vida del token se emite otro, así quien usa la
   * plataforma no se desloguea nunca y quien la abandona caduca a los tres
   * días. Si la emisión fallara —falta el secreto, por ejemplo— se sigue con la
   * sesión actual en vez de tirar la petición: el token viejo todavía vale.
   */
  async function conTokenRenovado(respuesta: NextResponse): Promise<NextResponse> {
    if (!credencial || !convieneRenovar(credencial)) return respuesta;

    try {
      const token = await emitirToken(credencial.usuarioId, credencial.rol);
      respuesta.cookies.set(NOMBRE_COOKIE, token, opcionesCookie());
    } catch (error) {
      console.error("[auth] no se pudo renovar el token:", error);
    }

    return respuesta;
  }

  function redirigirA(destino: string): Promise<NextResponse> {
    return conTokenRenovado(NextResponse.redirect(new URL(destino, nextUrl)));
  }

  // Ya autenticado: no tiene sentido volver a ver login o registro.
  if (esRutaDeAcceso && credencial) {
    return redirigirA(rol === "ADMIN" ? "/admin" : "/mi-stand");
  }

  if (esRutaAdmin || esRutaVendedor || esEncuesta) {
    if (!credencial) {
      const url = new URL("/ingresar", nextUrl);
      // Para volver a donde quería entrar después de iniciar sesión.
      url.searchParams.set("volverA", nextUrl.pathname + nextUrl.search);
      return redirigirA(url.pathname + url.search);
    }

    if (esRutaAdmin && rol !== "ADMIN") return redirigirA("/mi-stand");
    if (esRutaVendedor && rol !== "VENDEDOR") return redirigirA("/admin");
  }

  return conTokenRenovado(NextResponse.next());
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/mi-stand/:path*",
    "/encuesta",
    "/ingresar",
    "/registro",
  ],
};
