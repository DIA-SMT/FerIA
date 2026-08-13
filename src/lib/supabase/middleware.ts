import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { anonKeySupabase, urlSupabase } from "@/lib/supabase/config";

/**
 * Refresca la sesión de Supabase en el middleware.
 *
 * Los tokens de acceso duran una hora. Si nadie los renueva, el usuario queda
 * afuera aunque su sesión siga vigente. `getUser()` valida el token contra el
 * servidor de Auth y, si hace falta, lo renueva; las cookies actualizadas se
 * escriben en la respuesta que devolvemos.
 *
 * Devuelve también el usuario para que el middleware pueda decidir el acceso
 * sin volver a consultar.
 */
export async function actualizarSesion(peticion: NextRequest): Promise<{
  respuesta: NextResponse;
  usuario: User | null;
}> {
  let respuesta = NextResponse.next({ request: peticion });

  const supabase = createServerClient(urlSupabase(), anonKeySupabase(), {
    cookies: {
      getAll() {
        return peticion.cookies.getAll();
      },
      setAll(cookiesAEscribir) {
        for (const { name, value } of cookiesAEscribir) {
          peticion.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request: peticion });
        for (const { name, value, options } of cookiesAEscribir) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  // No usar `getSession()` acá: lee la cookie sin validarla contra el servidor.
  //
  // `getUser()` sale a la red. Si Supabase no responde —o las variables de
  // entorno todavía tienen los valores de ejemplo— preferimos degradar a
  // "sin sesión" antes que devolver un 500 en todo el sitio: el market público
  // sigue funcionando y los paneles redirigen al login.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { respuesta, usuario: user };
  } catch (error) {
    console.error("[auth] no se pudo verificar la sesión:", error);
    return { respuesta, usuario: null };
  }
}
