import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serviceRoleKeySupabase, urlSupabase } from "@/lib/supabase/config";

/**
 * Cliente con la service role key: ignora RLS y habilita la Admin API.
 *
 * ⚠️ Sólo puede usarse desde el servidor (Server Actions, Route Handlers,
 * scripts). Si esta clave llegara al navegador, cualquiera tendría acceso
 * total a la base y a la administración de usuarios.
 *
 * Se usa para tres cosas:
 *   · crear usuarios en el registro público y asignarles el rol,
 *   · subir y borrar archivos en Supabase Storage,
 *   · el seed de datos de ejemplo.
 */
let clienteCache: SupabaseClient | null = null;

export function clienteAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "clienteAdmin() no puede usarse en el navegador: expondría la service role key.",
    );
  }

  if (!clienteCache) {
    clienteCache = createClient(urlSupabase(), serviceRoleKeySupabase(), {
      auth: {
        // No hay sesión que mantener: este cliente actúa como servicio.
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return clienteCache;
}
