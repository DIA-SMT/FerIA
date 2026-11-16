import type {
  CambioDelStand,
  Prisma,
  Rubro,
  SeccionDelStand,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { generarSlugUnico } from "@/lib/slug";
import { almacenamiento } from "@/lib/storage";
import type { TipoDeCambio } from "@/lib/tipos-de-cambio";

/*
  Revisión de los cambios del stand.

  Todo lo que el feriante cambia en su stand pasa por la administración antes
  de publicarse: la portada, el logo, el nombre y el rubro, la descripción, el
  contacto y cada producto. Mientras tanto el vecino ve la última versión
  aprobada y el feriante ve la suya con el cartel «En revisión».

  Lo propuesto vive en `CambioDelStand.datos` y recién al aprobarse se copia a
  `Vendedor` o a `Producto`. Un producto nuevo es la excepción: nace como fila
  de `Producto` con `publicado = false`, y aprobarlo es prenderle esa marca.

  Dos cosas no pasan por acá, a propósito: marcar un producto sin stock y
  eliminarlo. Sólo sacan algo de la vista, no publican nada nuevo.

  Las fotos son la parte delicada. Una foto propuesta ya está subida, pero no
  se ve; una publicada se ve aunque haya una propuesta que la saque. Así que:
    · al aprobar, se borran las publicadas que la propuesta dejó afuera;
    · al rechazar o descartar, se borran las propuestas que no están publicadas;
    · al reemplazar una propuesta por otra, se borran las de la vieja que la
      nueva ya no usa (y que tampoco están publicadas).
*/

export interface DatosContacto {
  whatsapp: string;
  telefono: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  sitioWeb: string | null;
  direccion: string | null;
}

/** Lo que el feriante propone para un producto que ya está publicado. */
export interface DatosProducto {
  nombre: string;
  descripcion: string | null;
  imagenes: string[];
  precio: number | null;
  stock: number | null;
  destacado: boolean;
}

/** La forma de `CambioDelStand.datos` según la sección. */
export interface DatosPorSeccion {
  PORTADA: { imagenPortada: string };
  LOGO: { logo: string };
  IDENTIDAD: { emprendimiento: string; rubro: Rubro };
  DESCRIPCION: { descripcion: string | null };
  CONTACTO: DatosContacto;
  /** `nuevo`: el alta de un producto, cuyos datos están en su propia fila. */
  PRODUCTO: { nuevo: true } | DatosProducto;
}

export function leerDatos<S extends SeccionDelStand>(
  _seccion: S,
  datos: unknown,
): DatosPorSeccion[S] {
  return datos as unknown as DatosPorSeccion[S];
}

export function esProductoNuevo(
  datos: DatosPorSeccion["PRODUCTO"],
): datos is { nuevo: true } {
  return "nuevo" in datos;
}

/** Las fotos que nombra un cambio. */
export function imagenesDelCambio(
  seccion: SeccionDelStand,
  datos: unknown,
): string[] {
  if (seccion === "PORTADA") return [leerDatos("PORTADA", datos).imagenPortada];
  if (seccion === "LOGO") return [leerDatos("LOGO", datos).logo];
  if (seccion === "PRODUCTO") {
    const producto = leerDatos("PRODUCTO", datos);
    return esProductoNuevo(producto) ? [] : producto.imagenes;
  }
  return [];
}

async function borrar(rutas: string[], salvo: Iterable<string> = []) {
  const quedan = new Set(salvo);
  await Promise.all(
    rutas
      .filter((ruta) => ruta && !quedan.has(ruta))
      .map((ruta) => almacenamiento.eliminar(ruta)),
  );
}

/** Las fotos publicadas que un cambio de esta sección podría estar usando. */
async function imagenesPublicadas(
  cambio: Pick<CambioDelStand, "seccion" | "vendedorId" | "productoId">,
): Promise<string[]> {
  if (cambio.seccion === "PRODUCTO" && cambio.productoId) {
    const producto = await prisma.producto.findUnique({
      where: { id: cambio.productoId },
      select: { imagenes: true },
    });
    return producto?.imagenes ?? [];
  }
  if (cambio.seccion === "PORTADA" || cambio.seccion === "LOGO") {
    const vendedor = await prisma.vendedor.findUnique({
      where: { id: cambio.vendedorId },
      select: { imagenPortada: true, logo: true },
    });
    return [vendedor?.imagenPortada, vendedor?.logo].filter(
      (ruta): ruta is string => Boolean(ruta),
    );
  }
  return [];
}

// ---------------------------------------------------------------------------
// Tipos de cambio, para filtrar la bandeja de la administración
// ---------------------------------------------------------------------------

export function tipoDelCambio(
  seccion: SeccionDelStand,
  datos: unknown,
): TipoDeCambio {
  switch (seccion) {
    case "PORTADA":
      return "portada";
    case "LOGO":
      return "logo";
    case "IDENTIDAD":
      return "identidad";
    case "DESCRIPCION":
      return "descripcion";
    case "CONTACTO":
      return "contacto";
    case "PRODUCTO":
      return esProductoNuevo(leerDatos("PRODUCTO", datos))
        ? "producto-nuevo"
        : "producto";
  }
}

// ---------------------------------------------------------------------------
// Del lado del feriante
// ---------------------------------------------------------------------------

/**
 * Deja un cambio esperando revisión. Si esa parte ya tenía uno pendiente o
 * rechazado, lo reemplaza: hay a lo sumo uno por sección (y por producto).
 */
export async function proponerCambio<S extends SeccionDelStand>({
  vendedorId,
  seccion,
  productoId = null,
  datos,
}: {
  vendedorId: string;
  seccion: S;
  productoId?: string | null;
  datos: DatosPorSeccion[S];
}): Promise<void> {
  const json = datos as unknown as Prisma.InputJsonValue;
  const anterior = await prisma.cambioDelStand.findFirst({
    where: {
      vendedorId,
      seccion,
      productoId,
      estado: { in: ["PENDIENTE", "RECHAZADO"] },
    },
    orderBy: { creadoEn: "desc" },
  });

  if (!anterior) {
    await prisma.cambioDelStand.create({
      data: { vendedorId, seccion, productoId, datos: json },
    });
    return;
  }

  await prisma.cambioDelStand.update({
    where: { id: anterior.id },
    data: {
      datos: json,
      estado: "PENDIENTE",
      motivoRechazo: null,
      revisadoEn: null,
      revisadoPorId: null,
    },
  });

  // Las fotos de la propuesta vieja que la nueva ya no usa, y que tampoco
  // están publicadas, no las va a ver nadie nunca.
  await borrar(imagenesDelCambio(seccion, anterior.datos), [
    ...imagenesDelCambio(seccion, json),
    ...(await imagenesPublicadas(anterior)),
  ]);
}

/**
 * El feriante retira un cambio pendiente, o da por visto uno rechazado. Un
 * producto nuevo no se descarta: se elimina, que es lo mismo y más claro.
 */
export async function descartarCambio(
  cambioId: string,
  vendedorId: string,
): Promise<boolean> {
  const cambio = await prisma.cambioDelStand.findUnique({
    where: { id: cambioId },
  });
  if (
    !cambio ||
    cambio.vendedorId !== vendedorId ||
    cambio.estado === "APROBADO"
  ) {
    return false;
  }
  if (
    cambio.seccion === "PRODUCTO" &&
    esProductoNuevo(leerDatos("PRODUCTO", cambio.datos))
  ) {
    return false;
  }

  await prisma.cambioDelStand.delete({ where: { id: cambio.id } });
  await borrar(
    imagenesDelCambio(cambio.seccion, cambio.datos),
    await imagenesPublicadas(cambio),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Del lado de la administración
// ---------------------------------------------------------------------------

export type ResultadoRevision =
  | { ok: true; slugs: string[] }
  | { ok: false; mensaje: string };

/**
 * Aprueba un cambio: lo copia a lo publicado y lo marca como aprobado. Devuelve
 * las direcciones de stand que hay que refrescar (dos si cambió el nombre).
 */
export async function aprobarCambio(
  cambioId: string,
  revisadoPorId: string,
): Promise<ResultadoRevision> {
  const cambio = await prisma.cambioDelStand.findUnique({
    where: { id: cambioId },
    include: { vendedor: true, producto: true },
  });
  if (!cambio || cambio.estado !== "PENDIENTE") {
    return { ok: false, mensaje: "Ese cambio ya fue revisado o no existe." };
  }

  const vendedor = cambio.vendedor;
  const marca = prisma.cambioDelStand.update({
    where: { id: cambio.id },
    data: {
      estado: "APROBADO",
      revisadoEn: new Date(),
      revisadoPorId,
      motivoRechazo: null,
    },
  });

  let aBorrar: string[] = [];
  let slug = vendedor.slug;

  switch (cambio.seccion) {
    case "PORTADA": {
      const { imagenPortada } = leerDatos("PORTADA", cambio.datos);
      await prisma.$transaction([
        prisma.vendedor.update({
          where: { id: vendedor.id },
          data: { imagenPortada },
        }),
        marca,
      ]);
      if (vendedor.imagenPortada && vendedor.imagenPortada !== imagenPortada) {
        aBorrar = [vendedor.imagenPortada];
      }
      break;
    }
    case "LOGO": {
      const { logo } = leerDatos("LOGO", cambio.datos);
      await prisma.$transaction([
        prisma.vendedor.update({ where: { id: vendedor.id }, data: { logo } }),
        marca,
      ]);
      if (vendedor.logo && vendedor.logo !== logo) aBorrar = [vendedor.logo];
      break;
    }
    case "IDENTIDAD": {
      const { emprendimiento, rubro } = leerDatos("IDENTIDAD", cambio.datos);
      // El slug acompaña al nombre del emprendimiento: es la URL pública.
      if (emprendimiento !== vendedor.emprendimiento) {
        slug = await generarSlugUnico(
          emprendimiento,
          async (candidato) =>
            (await prisma.vendedor.count({
              where: { slug: candidato, id: { not: vendedor.id } },
            })) > 0,
        );
      }
      await prisma.$transaction([
        prisma.vendedor.update({
          where: { id: vendedor.id },
          data: { emprendimiento, rubro, slug },
        }),
        marca,
      ]);
      break;
    }
    case "DESCRIPCION": {
      const { descripcion } = leerDatos("DESCRIPCION", cambio.datos);
      await prisma.$transaction([
        prisma.vendedor.update({
          where: { id: vendedor.id },
          data: { descripcion },
        }),
        marca,
      ]);
      break;
    }
    case "CONTACTO": {
      const contacto = leerDatos("CONTACTO", cambio.datos);
      await prisma.$transaction([
        prisma.vendedor.update({
          where: { id: vendedor.id },
          data: contacto,
        }),
        marca,
      ]);
      break;
    }
    case "PRODUCTO": {
      const producto = cambio.producto;
      if (!producto) {
        return { ok: false, mensaje: "Ese producto ya no existe." };
      }
      const datos = leerDatos("PRODUCTO", cambio.datos);
      if (esProductoNuevo(datos)) {
        await prisma.$transaction([
          prisma.producto.update({
            where: { id: producto.id },
            data: { publicado: true },
          }),
          marca,
        ]);
      } else {
        // La cantidad no se toma de la propuesta: se aplica en el momento en
        // que el feriante la cambia, y la de la propuesta puede estar vieja.
        const { stock: _cantidad, ...contenido } = datos;
        await prisma.$transaction([
          prisma.producto.update({
            where: { id: producto.id },
            data: { ...contenido, publicado: true },
          }),
          marca,
        ]);
        aBorrar = producto.imagenes.filter(
          (ruta) => !datos.imagenes.includes(ruta),
        );
      }
      break;
    }
  }

  await borrar(aBorrar);
  return { ok: true, slugs: [...new Set([vendedor.slug, slug])] };
}

/**
 * Rechaza un cambio. Lo publicado queda como estaba, y el feriante ve el motivo
 * para corregirlo. Las fotos propuestas se borran, salvo las de un producto
 * nuevo: esas son las del producto, que sigue ahí para que lo arregle.
 */
export async function rechazarCambio(
  cambioId: string,
  revisadoPorId: string,
  motivoRechazo: string,
): Promise<ResultadoRevision> {
  const cambio = await prisma.cambioDelStand.findUnique({
    where: { id: cambioId },
    include: { vendedor: { select: { slug: true } } },
  });
  if (!cambio || cambio.estado !== "PENDIENTE") {
    return { ok: false, mensaje: "Ese cambio ya fue revisado o no existe." };
  }

  await prisma.cambioDelStand.update({
    where: { id: cambio.id },
    data: {
      estado: "RECHAZADO",
      motivoRechazo,
      revisadoEn: new Date(),
      revisadoPorId,
    },
  });

  await borrar(
    imagenesDelCambio(cambio.seccion, cambio.datos),
    await imagenesPublicadas(cambio),
  );
  return { ok: true, slugs: [cambio.vendedor.slug] };
}

// ---------------------------------------------------------------------------
// Lo que ve el feriante en «Mi stand»
// ---------------------------------------------------------------------------

export interface EstadoDeRevision {
  id: string;
  estado: "PENDIENTE" | "RECHAZADO";
  motivo: string | null;
}

type CambioAbierto = Pick<
  CambioDelStand,
  "id" | "seccion" | "productoId" | "datos" | "estado" | "motivoRechazo"
>;

function estadoDe(cambio: CambioAbierto): EstadoDeRevision {
  return {
    id: cambio.id,
    estado: cambio.estado === "RECHAZADO" ? "RECHAZADO" : "PENDIENTE",
    motivo: cambio.motivoRechazo,
  };
}

/**
 * El stand como lo ve su dueño: lo publicado con sus cambios pendientes
 * encima, y el estado de revisión de cada parte. Lo rechazado no se aplica:
 * se muestra lo publicado y, al lado, el motivo.
 */
export function standDelDueno<
  V extends {
    imagenPortada: string | null;
    logo: string | null;
    emprendimiento: string;
    rubro: Rubro;
    descripcion: string | null;
  } & DatosContacto,
>(vendedor: V, cambios: CambioAbierto[]) {
  const visto = { ...vendedor };
  const estados: Partial<
    Record<Exclude<SeccionDelStand, "PRODUCTO">, EstadoDeRevision>
  > = {};

  for (const cambio of cambios) {
    if (cambio.seccion === "PRODUCTO") continue;
    estados[cambio.seccion] = estadoDe(cambio);
    if (cambio.estado !== "PENDIENTE") continue;
    Object.assign(visto, leerDatos(cambio.seccion, cambio.datos));
  }

  return { vendedor: visto, estados };
}

/** Lo mismo, para un producto. */
export function productoDelDueno<
  P extends { id: string; publicado: boolean } & Omit<DatosProducto, "precio"> & {
      precio: unknown;
    },
>(producto: P, cambios: CambioAbierto[]) {
  const cambio = cambios.find(
    (c) => c.seccion === "PRODUCTO" && c.productoId === producto.id,
  );
  if (!cambio) return { producto, revision: null, nuevo: false };

  const datos = leerDatos("PRODUCTO", cambio.datos);
  const nuevo = esProductoNuevo(datos);
  const visto =
    cambio.estado === "PENDIENTE" && !nuevo ? { ...producto, ...datos } : producto;
  return { producto: visto, revision: estadoDe(cambio), nuevo };
}

/** Los cambios abiertos de un feriante: pendientes y rechazados sin ver. */
export function cambiosAbiertos(vendedorId: string) {
  return prisma.cambioDelStand.findMany({
    where: { vendedorId, estado: { in: ["PENDIENTE", "RECHAZADO"] } },
    select: {
      id: true,
      seccion: true,
      productoId: true,
      datos: true,
      estado: true,
      motivoRechazo: true,
    },
  });
}
