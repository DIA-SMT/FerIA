import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { anonKeySupabase, urlSupabase } from "@/lib/supabase/config";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Lee y escribe la sesión en las cookies de la petición. Hay que crear uno
 * nuevo en cada petición: nunca guardarlo en una variable de módulo, porque
 * las cookies son distintas para cada usuario.
 */
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient(urlSupabase(), anonKeySupabase(), {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesAEscribir) {
        try {
          for (const { name, value, options } of cookiesAEscribir) {
            almacen.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies. No es un
          // problema: el middleware ya refresca la sesión en cada petición.
        }
      },
    },
  });
}
