/**
 * Configuración de Supabase.
 *
 * Queda poco: desde que la autenticación es propia y los archivos pueden vivir
 * en el disco, Supabase sólo se usa como almacenamiento, y sólo en el deploy
 * que todavía no se mudó. La `anon key` se fue con los clientes de auth, que
 * eran los únicos que la usaban.
 */

function requerido(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copiá .env.example a .env y completala con los datos de tu proyecto de Supabase.`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return requerido(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function serviceRoleKeySupabase(): string {
  return requerido(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
