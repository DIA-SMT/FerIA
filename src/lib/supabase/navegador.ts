import { createBrowserClient } from "@supabase/ssr";

import { anonKeySupabase, urlSupabase } from "@/lib/supabase/config";

/**
 * Cliente de Supabase para componentes del navegador.
 *
 * Hoy la aplicación resuelve todo el flujo de autenticación con Server
 * Actions, así que este cliente no se usa. Queda disponible para cuando haga
 * falta suscribirse a cambios en tiempo real o escuchar `onAuthStateChange`.
 */
export function crearClienteNavegador() {
  return createBrowserClient(urlSupabase(), anonKeySupabase());
}
