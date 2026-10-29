import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { comprimirImagen, LADO_PORTADA } from "@/lib/imagenes";
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
  /**
   * Lee un archivo de un bucket privado, para entregarlo desde un endpoint que
   * ya verificó los permisos.
   *
   * Antes esto era `urlFirmada`, que devolvía una URL temporal de Supabase a la
   * que el endpoint redirigía. Se cambió por dos motivos. Uno práctico: en un
   * disco propio no existe tal cosa como una URL firmada, así que la operación
   * no se podía implementar. Y uno de fondo: la URL firmada terminaba en la
   * barra de direcciones y en el historial del navegador, apuntando a un
   * documento de un vecino. Leer y entregar deja el archivo donde tiene que
   * estar —en la respuesta— y no en ningún lado más.
   */
  abrir(ruta: string): Promise<{ contenido: Buffer; tipoMime: string } | null>;
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

/**
 * Cuánto puede cachear el navegador cada archivo, en segundos.
 *
 * Un año para lo público, y es seguro por cómo se nombran los objetos: cada uno
 * lleva un UUID y se sube con `upsert: false`, así que **el contenido de una
 * ruta nunca cambia**. Cambiar la foto de un stand no reescribe el archivo,
 * sube otro con otro nombre y actualiza la columna. Estaba en una hora, que
 * obligaba a volver a bajar la misma portada cada vez que alguien abría el
 * stand después de un rato.
 *
 * Los comprobantes de canon van aparte, y no por el contenido —también son
 * inmutables— sino por dónde quedan: son documentos de un vecino y la máquina
 * desde la que se mira el panel puede ser compartida. Una hora alcanza para que
 * no se baje dos veces en la misma sesión.
 */
const CACHE_PUBLICO = "31536000";
const CACHE_PRIVADO = "3600";

function cachePara(bucket: Bucket): string {
  return bucket === BUCKET_COMPROBANTES ? CACHE_PRIVADO : CACHE_PUBLICO;
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
        cacheControl: cachePara(bucket),
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

  async abrir(
    ruta: string,
  ): Promise<{ contenido: Buffer; tipoMime: string } | null> {
    const partes = partirRuta(ruta);
    if (!partes) return null;

    const { data, error } = await clienteAdmin()
      .storage.from(partes.bucket)
      .download(partes.objeto);

    if (error || !data) return null;

    return {
      contenido: Buffer.from(await data.arrayBuffer()),
      tipoMime: data.type || "application/octet-stream",
    };
  }
}

/**
 * Almacenamiento en el disco del propio servidor.
 *
 * Guarda cada objeto en `<raíz>/<bucket>/<objeto>`, así que la ruta que queda
 * en la base es exactamente la misma que con Supabase (`productos/abc.webp`) y
 * la mudanza no toca un solo dato. Lo que cambia es dónde está el archivo y
 * quién lo sirve: los buckets públicos los entrega nginx desde la raíz, y
 * `comprobantes` **no se publica**: sale únicamente por `/api/comprobantes`,
 * que verifica permisos antes de leerlo.
 *
 * La raíz vive fuera del directorio de la versión desplegada a propósito: si
 * estuviera adentro, cada despliegue estrenaría un disco vacío y las fotos de
 * los feriantes desaparecerían.
 */
class AlmacenamientoLocal implements AlmacenamientoArchivos {
  constructor(private readonly raiz: string) {}

  /**
   * Convierte una ruta lógica en una del sistema de archivos, verificando que
   * no se escape de la raíz.
   *
   * Hoy ninguna ruta llega de afuera sin pasar antes por la base —el endpoint
   * de comprobantes consulta el pago antes de leer el archivo— pero esto es una
   * función que recibe un string y abre un archivo: la comprobación va acá, al
   * lado de la operación peligrosa, y no en cada llamador.
   */
  private rutaEnDisco(ruta: string): string | null {
    const partes = partirRuta(ruta);
    if (!partes) return null;

    const destino = path.resolve(this.raiz, partes.bucket, partes.objeto);
    const raizNormalizada = path.resolve(this.raiz) + path.sep;

    return destino.startsWith(raizNormalizada) ? destino : null;
  }

  private async escribir(
    bucket: Bucket,
    objeto: string,
    contenido: Buffer,
  ): Promise<string> {
    const ruta = `${bucket}/${objeto}`;
    const destino = this.rutaEnDisco(ruta);
    if (!destino) throw new ErrorDeArchivo("Ruta de archivo inválida.");

    try {
      await mkdir(path.dirname(destino), { recursive: true });
      // `wx` falla si el archivo ya existe, igual que el `upsert: false` de
      // Supabase. Con nombres UUID no debería pasar nunca; si pasa, es mejor
      // enterarse que pisar en silencio el archivo de otra persona.
      await writeFile(destino, contenido, { flag: "wx" });
    } catch (error) {
      throw new ErrorDeArchivo(
        `No se pudo guardar el archivo en el disco: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return ruta;
  }

  async guardar(archivo: File, bucket: Bucket, carpeta?: string): Promise<string> {
    const extension = EXTENSIONES[archivo.type] ?? ".bin";
    const nombre = `${randomUUID()}${extension}`;
    const objeto = carpeta ? `${carpeta}/${nombre}` : nombre;

    return this.escribir(
      bucket,
      objeto,
      Buffer.from(await archivo.arrayBuffer()),
    );
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

    return this.escribir(bucket, objeto, contenido);
  }

  async eliminar(ruta: string): Promise<void> {
    const destino = this.rutaEnDisco(ruta);
    if (!destino) return;

    // Igual que en Supabase: es limpieza, no parte del negocio. Que el archivo
    // ya no esté no puede tumbar la operación que lo estaba borrando.
    await rm(destino, { force: true }).catch(() => undefined);
  }

  async abrir(
    ruta: string,
  ): Promise<{ contenido: Buffer; tipoMime: string } | null> {
    const destino = this.rutaEnDisco(ruta);
    if (!destino) return null;

    try {
      return {
        contenido: await readFile(destino),
        tipoMime: TIPO_POR_EXTENSION[path.extname(destino).toLowerCase()] ??
          "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
}

/** La inversa de `EXTENSIONES`, para devolver el tipo al leer del disco. */
const TIPO_POR_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONES).map(([tipo, extension]) => [extension, tipo]),
);

/**
 * Qué implementación se usa.
 *
 * `ALMACENAMIENTO_LOCAL` es la ruta de la carpeta donde guardar. Si está
 * cargada manda el disco; si no, sigue Supabase. El default es Supabase para
 * que nada cambie en un entorno que no la declare.
 *
 * Va de la mano con `NEXT_PUBLIC_ARCHIVOS_URL` en `src/lib/media.ts`: una dice
 * dónde se escribe y la otra con qué URL se lee. Tienen que estar las dos o
 * ninguna, porque las lee gente distinta —ésta sólo el servidor, aquélla
 * también el navegador— y por eso no pueden ser la misma variable.
 */
const RAIZ_LOCAL = process.env.ALMACENAMIENTO_LOCAL;

export const almacenamiento: AlmacenamientoArchivos = RAIZ_LOCAL
  ? new AlmacenamientoLocal(RAIZ_LOCAL)
  : new AlmacenamientoSupabase();

/**
 * Guarda una imagen opcional venida de un `FormData`, comprimida.
 *
 * Devuelve `null` si el campo vino vacío (el usuario no subió nada).
 *
 * La compresión no es un agregado: antes esto subía el `File` tal cual llegaba
 * del navegador, así que un PNG de 2,9 MB quedaba de 2,9 MB en el bucket y
 * bajaba entero cada vez que alguien abría el stand. Ver `comprimirImagen` para
 * qué se le hace y qué no.
 */
export async function guardarImagenOpcional(
  valor: FormDataEntryValue | null,
  bucket: Bucket,
  ladoMaximo: number = LADO_PORTADA,
): Promise<string | null> {
  if (!(valor instanceof File) || valor.size === 0) return null;
  validarImagen(valor);

  const entrada = Buffer.from(await valor.arrayBuffer());
  const comprimida = await comprimirImagen(entrada, ladoMaximo);

  return almacenamiento.guardarBuffer(comprimida, bucket);
}

/** Igual que `guardarImagenOpcional` pero admitiendo PDF, al bucket privado. */
export async function guardarComprobanteOpcional(
  valor: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(valor instanceof File) || valor.size === 0) return null;
  validarComprobante(valor);
  return almacenamiento.guardar(valor, BUCKET_COMPROBANTES);
}
