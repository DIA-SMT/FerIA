/**
 * Resolución de URLs de archivos guardados en Supabase Storage.
 *
 * En la base se guarda la **ruta** del objeto con su bucket adelante, por
 * ejemplo `vendedores/8f3a…webp`. La URL se arma acá, así el día que cambie el
 * proyecto de Supabase no hay que migrar ningún dato.
 *
 * Este módulo sólo usa `NEXT_PUBLIC_SUPABASE_URL`, así que puede importarse
 * también desde componentes de cliente. La subida y el borrado, que necesitan
 * la service role key, viven aparte en `src/lib/storage.ts`.
 */

/** Buckets públicos: cualquiera con la URL puede ver el archivo. */
export const BUCKETS_PUBLICOS = ["ferias", "vendedores", "productos"] as const;

/** Bucket privado: se sirve con URL firmada a través de /api/comprobantes. */
export const BUCKET_COMPROBANTES = "comprobantes";

export type BucketPublico = (typeof BUCKETS_PUBLICOS)[number];
export type Bucket = BucketPublico | typeof BUCKET_COMPROBANTES;

/**
 * URL pública de un archivo. Devuelve `null` si no hay ruta cargada, para
 * poder pasarle el resultado directo a los componentes de imagen.
 */
export function urlPublica(ruta: string | null | undefined): string | null {
  if (!ruta) return null;

  // Tolerancia: si alguna vez se guardó una URL completa, la devolvemos tal cual.
  if (/^https?:\/\//i.test(ruta)) return ruta;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${ruta}`;
}

/** Enlace al endpoint que valida permisos y firma la URL del comprobante. */
export function urlComprobante(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return `/api/comprobantes?ruta=${encodeURIComponent(ruta)}`;
}

/** Separa `"vendedores/abc.webp"` en su bucket y el nombre del objeto. */
export function partirRuta(
  ruta: string,
): { bucket: string; objeto: string } | null {
  const separador = ruta.indexOf("/");
  if (separador <= 0 || separador === ruta.length - 1) return null;
  return {
    bucket: ruta.slice(0, separador),
    objeto: ruta.slice(separador + 1),
  };
}
