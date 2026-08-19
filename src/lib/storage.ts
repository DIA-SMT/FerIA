import { randomUUID } from "node:crypto";

import {
  BUCKET_COMPROBANTES,
  partirRuta,
  type Bucket,
} from "@/lib/media";
import { clienteAdmin } from "@/lib/supabase/admin";

/**
 * Abstracción de almacenamiento de archivos, sobre Supabase Storage.
 *
 * Guarda y devuelve rutas con el bucket adelante (`"productos/abc.webp"`); las
 * URL se arman en `src/lib/media.ts`. Para cambiar de proveedor alcanza con
 * escribir otra clase que implemente esta interfaz y cambiar la instancia
 * exportada al final del archivo.
 *
 * ⚠️ Sólo servidor: usa la service role key.
 */
export interface AlmacenamientoArchivos {
  /** Guarda el archivo y devuelve su ruta, ej. `productos/abc.webp`. */
  guardar(archivo: File, bucket: Bucket, carpeta?: string): Promise<string>;
  /**
   * Guarda un buffer ya procesado. Lo usan las variantes de foto de producto,
   * que salen de `sharp` o del modelo de imagen y no son un `File` del cliente.
   */
  guardarBuffer(
    contenido: Buffer,
    bucket: Bucket,
    opciones?: { tipoMime?: string; carpeta?: string },
  ): Promise<string>;
  /** Elimina un archivo previamente guardado. Nunca lanza si no existe. */
  eliminar(ruta: string): Promise<void>;
  /** URL temporal para un archivo de un bucket privado. */
  urlFirmada(ruta: string, segundos: number): Promise<string | null>;
}

export const TAMANIO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

const TIPOS_IMAGEN_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const TIPOS_COMPROBANTE_PERMITIDOS = [
  ...TIPOS_IMAGEN_PERMITIDOS,
  "application/pdf",
] as const;

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "application/pdf": ".pdf",
};

export class ErrorDeArchivo extends Error {}

/** Valida tipo y tamaño de una imagen antes de guardarla. */
export function validarImagen(archivo: File): void {
  if (archivo.size === 0) {
    throw new ErrorDeArchivo("El archivo está vacío.");
  }
  if (archivo.size > TAMANIO_MAXIMO_BYTES) {
    throw new ErrorDeArchivo(
      `La imagen supera el tamaño máximo de ${TAMANIO_MAXIMO_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type as never)) {
    throw new ErrorDeArchivo(
      "Formato no permitido. Se aceptan imágenes JPG, PNG, WEBP o AVIF.",
    );
  }
}

/** Igual que `validarImagen` pero además acepta PDF (comprobantes de canon). */
export function validarComprobante(archivo: File): void {
  if (archivo.size === 0) {
    throw new ErrorDeArchivo("El archivo está vacío.");
  }
  if (archivo.size > TAMANIO_MAXIMO_BYTES) {
    throw new ErrorDeArchivo(
      `El comprobante supera el tamaño máximo de ${TAMANIO_MAXIMO_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (!TIPOS_COMPROBANTE_PERMITIDOS.includes(archivo.type as never)) {
    throw new ErrorDeArchivo(
      "Formato no permitido. Se aceptan imágenes (JPG, PNG, WEBP, AVIF) o PDF.",
    );
  }
}

class AlmacenamientoSupabase implements AlmacenamientoArchivos {
  /**
   * Sube el contenido y devuelve la ruta con el bucket adelante.
   *
   * `carpeta` prefija el objeto. Las fotos de producto la usan con el id del
   * feriante (`productos/<vendedorId>/<uuid>.webp`), y ese prefijo no es
   * cosmético: es lo que permite verificar después que una ruta que llega en un
   * formulario le pertenece a quien la manda, antes de borrarla o guardarla.
   */
  private async subir(
    bucket: Bucket,
    objeto: string,
    contenido: File | Buffer,
    tipoMime: string,
  ): Promise<string> {
    const { error } = await clienteAdmin()
      .storage.from(bucket)
      .upload(objeto, contenido, {
        contentType: tipoMime,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new ErrorDeArchivo(
        `No se pudo subir el archivo: ${error.message}. Verificá que el bucket "${bucket}" exista en Supabase Storage.`,
      );
    }

    return `${bucket}/${objeto}`;
  }

  async guardar(archivo: File, bucket: Bucket, carpeta?: string): Promise<string> {
    const extension = EXTENSIONES[archivo.type] ?? ".bin";
    const nombre = `${randomUUID()}${extension}`;
    const objeto = carpeta ? `${carpeta}/${nombre}` : nombre;

    return this.subir(bucket, objeto, archivo, archivo.type);
  }

  async guardarBuffer(
    contenido: Buffer,
    bucket: Bucket,
    opciones: { tipoMime?: string; carpeta?: string } = {},
  ): Promise<string> {
    const tipoMime = opciones.tipoMime ?? "image/webp";
    const extension = EXTENSIONES[tipoMime] ?? ".bin";
    const nombre = `${randomUUID()}${extension}`;
    const objeto = opciones.carpeta ? `${opciones.carpeta}/${nombre}` : nombre;

    return this.subir(bucket, objeto, contenido, tipoMime);
  }

  async eliminar(ruta: string): Promise<void> {
    const partes = partirRuta(ruta);
    if (!partes) return;

    // Si falla (el archivo ya no existe, o la ruta quedó de otro proveedor) no
    // interrumpimos la operación principal: es limpieza, no parte del negocio.
    await clienteAdmin()
      .storage.from(partes.bucket)
      .remove([partes.objeto])
      .catch(() => undefined);
  }

  async urlFirmada(ruta: string, segundos: number): Promise<string | null> {
    const partes = partirRuta(ruta);
    if (!partes) return null;

    const { data, error } = await clienteAdmin()
      .storage.from(partes.bucket)
      .createSignedUrl(partes.objeto, segundos);

    if (error || !data) return null;
    return data.signedUrl;
  }
}

export const almacenamiento: AlmacenamientoArchivos =
  new AlmacenamientoSupabase();

/**
 * Guarda una imagen opcional venida de un `FormData`.
 * Devuelve `null` si el campo vino vacío (el usuario no subió nada).
 */
export async function guardarImagenOpcional(
  valor: FormDataEntryValue | null,
  bucket: Bucket,
): Promise<string | null> {
  if (!(valor instanceof File) || valor.size === 0) return null;
  validarImagen(valor);
  return almacenamiento.guardar(valor, bucket);
}

/** Igual que `guardarImagenOpcional` pero admitiendo PDF, al bucket privado. */
export async function guardarComprobanteOpcional(
  valor: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(valor instanceof File) || valor.size === 0) return null;
  validarComprobante(valor);
  return almacenamiento.guardar(valor, BUCKET_COMPROBANTES);
}
