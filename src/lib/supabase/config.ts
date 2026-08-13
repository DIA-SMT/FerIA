/**
 * Configuración compartida de Supabase.
 *
 * La URL y la anon key son públicas por diseño (viajan al navegador): lo que
 * protege los datos es RLS, y todas nuestras tablas lo tienen habilitado sin
 * políticas, así que PostgREST no expone nada. Ver la migración `init`.
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

export function anonKeySupabase(): string {
  return requerido(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function serviceRoleKeySupabase(): string {
  return requerido(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
