/**
 * Next.js usa excepciones para señalizar control de flujo, no sólo fallas:
 *
 *   · `redirect()` y `notFound()` lanzan para cortar el render.
 *   · Leer `cookies()` o `headers()` durante la compilación lanza
 *     `DynamicServerError` para marcar la ruta como dinámica.
 *
 * Todas se distinguen por su propiedad `digest`. Cualquier `catch` amplio
 * tiene que dejarlas pasar: atraparlas rompe el redireccionamiento o hace que
 * Next crea que la ruta se puede prerenderizar.
 */
const DIGESTS_DE_CONTROL = [
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
  "DYNAMIC_SERVER_USAGE",
  "NEXT_HTTP_ERROR_FALLBACK",
] as const;

export function esControlDeFlujoDeNext(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;

  return DIGESTS_DE_CONTROL.some((prefijo) => digest.startsWith(prefijo));
}
