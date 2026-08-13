import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Utilidades para la columna PostGIS `ferias.ubicacion`.
 *
 * Prisma no puede leer ni escribir columnas `Unsupported`, así que toda
 * interacción con la geometría pasa por SQL crudo desde acá.
 *
 * Convención: la geometría es la fuente de verdad y `latitud`/`longitud` son
 * un espejo legible desde Prisma. `guardarUbicacion` escribe las dos cosas en
 * una sola sentencia, de modo que no puedan quedar desincronizadas.
 *
 * En Supabase la extensión PostGIS vive en el schema `extensions`, no en
 * `public`. Por eso todas las funciones van calificadas (`extensions.ST_…`):
 * así no dependemos del `search_path` que fije el pool de conexiones.
 */

/** Cliente de Prisma o el cliente transaccional dentro de un `$transaction`. */
type ClientePrisma = PrismaClient | Prisma.TransactionClient;

export const LIMITES_TUCUMAN = {
  latMin: -27.0,
  latMax: -26.6,
  lngMin: -65.4,
  lngMax: -65.0,
} as const;

/** Centro aproximado de San Miguel de Tucumán (Plaza Independencia). */
export const CENTRO_SMT = { lat: -26.8354, lng: -65.2038 } as const;

/**
 * Escribe la ubicación de una feria: setea la geometría PostGIS y, en la misma
 * sentencia, las columnas espejo `latitud`/`longitud`.
 */
export async function guardarUbicacion(
  cliente: ClientePrisma,
  feriaId: string,
  latitud: number,
  longitud: number,
): Promise<void> {
  await cliente.$executeRaw`
    UPDATE "ferias"
    SET "ubicacion" = extensions.ST_SetSRID(
          extensions.ST_MakePoint(${longitud}::double precision, ${latitud}::double precision),
          4326
        ),
        "latitud"   = ${latitud}::double precision,
        "longitud"  = ${longitud}::double precision
    WHERE "id" = ${feriaId}
  `;
}

/** Borra la ubicación de una feria (geometría y espejo). */
export async function limpiarUbicacion(
  cliente: ClientePrisma,
  feriaId: string,
): Promise<void> {
  await cliente.$executeRaw`
    UPDATE "ferias"
    SET "ubicacion" = NULL, "latitud" = NULL, "longitud" = NULL
    WHERE "id" = ${feriaId}
  `;
}

/**
 * Lee la ubicación directamente desde la geometría PostGIS.
 *
 * La app usa normalmente las columnas espejo (más baratas), pero este helper
 * queda como referencia de cómo consultar la geometría y sirve para verificar
 * la sincronía entre ambas.
 */
export async function leerUbicacion(
  feriaId: string,
): Promise<{ latitud: number; longitud: number } | null> {
  const filas = await prisma.$queryRaw<
    Array<{ latitud: number | null; longitud: number | null }>
  >`
    SELECT extensions.ST_Y("ubicacion")::double precision AS "latitud",
           extensions.ST_X("ubicacion")::double precision AS "longitud"
    FROM "ferias"
    WHERE "id" = ${feriaId}
  `;

  const fila = filas[0];
  if (!fila || fila.latitud === null || fila.longitud === null) return null;
  return { latitud: fila.latitud, longitud: fila.longitud };
}

/**
 * Ferias activas ordenadas por cercanía a un punto.
 *
 * No se usa todavía en la interfaz: queda lista para el mapa interactivo y
 * para un futuro "ferias cerca mío".
 */
export async function feriasCercanas(
  latitud: number,
  longitud: number,
  limite = 10,
): Promise<Array<{ id: string; nombre: string; slug: string; metros: number }>> {
  return prisma.$queryRaw`
    SELECT "id", "nombre", "slug",
           extensions.ST_Distance(
             "ubicacion"::extensions.geography,
             extensions.ST_SetSRID(
               extensions.ST_MakePoint(${longitud}::double precision, ${latitud}::double precision),
               4326
             )::extensions.geography
           ) AS "metros"
    FROM "ferias"
    WHERE "ubicacion" IS NOT NULL AND "activa" = true
    ORDER BY "metros" ASC
    LIMIT ${limite}
  `;
}

/** Link a Google Maps para una ubicación. `null` si la feria no tiene coordenadas. */
export function linkGoogleMaps(
  latitud: number | null,
  longitud: number | null,
): string | null {
  if (latitud === null || longitud === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}

/** Link de búsqueda por dirección, para ferias sin coordenadas cargadas. */
export function linkGoogleMapsPorDireccion(direccion: string): string {
  const consulta = encodeURIComponent(
    `${direccion}, San Miguel de Tucumán, Tucumán, Argentina`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${consulta}`;
}
