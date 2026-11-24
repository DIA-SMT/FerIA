"use server";

import sharp from "sharp";

import { prisma } from "@/lib/db";
import { esControlDeFlujoDeNext } from "@/lib/errores";
import { proximasFechasComerciales } from "@/lib/fechas-comerciales";
import { hoyEnZona } from "@/lib/format";
import { carpetaDelVendedor, rutaEsDelVendedor } from "@/lib/fotos-producto";
import { ErrorDeIA } from "@/lib/ia-imagenes";
import { generarEscenaPublicitaria } from "@/lib/ia-publicidad";
import { titularPublicitario } from "@/lib/ia-texto";
import { RUBROS } from "@/lib/labels";
import { crearLimiteDeRitmo } from "@/lib/limite-de-ritmo";
import {
  MAXIMO_PRODUCTOS_PUBLICIDAD,
  PUBLICIDADES_POR_DIA,
} from "@/lib/publicidad";
import { requerirVendedorAprobado } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";

/*
  La imagen publicitaria de «Compartir»: la IA arma una escena de campaña con
  las fotos reales de hasta tres productos, y propone un título. El texto de la
  imagen lo pone el código después (`/mi-stand/compartir/publicidad`).

  La escena se guarda en la carpeta del feriante, en `publicidad/`, porque el
  título se puede cambiar sin volver a pagar la imagen. Cuando genera otra, la
  anterior se borra.
*/

export interface EstadoPublicidad {
  ok: boolean;
  mensaje?: string;
  /** La ruta de la escena guardada. */
  fondo?: string;
  titular?: string;
}

/** Un tope por día y por feriante: con diez alcanza para probar varias. */
const superaElLimite = crearLimiteDeRitmo({
  ventanaMs: 24 * 60 * 60 * 1000,
  maximo: PUBLICIDADES_POR_DIA,
});

export async function generarPublicidad(pedido: {
  productos: string[];
  /** La escena anterior, para borrarla. */
  anterior?: string | null;
}): Promise<EstadoPublicidad> {
  try {
    const { vendedor } = await requerirVendedorAprobado();

    const ids = (Array.isArray(pedido.productos) ? pedido.productos : [])
      .filter((id): id is string => typeof id === "string" && id.length <= 40)
      .slice(0, MAXIMO_PRODUCTOS_PUBLICIDAD);
    if (ids.length === 0) {
      return { ok: false, mensaje: "Elegí al menos un producto." };
    }

    const productos = await prisma.producto.findMany({
      where: { id: { in: ids }, vendedorId: vendedor.id, publicado: true },
      select: { id: true, nombre: true, descripcion: true, imagenes: true },
    });
    const elegidos = ids
      .map((id) => productos.find((producto) => producto.id === id))
      .filter((producto) => producto && producto.imagenes.length > 0);
    if (elegidos.length === 0) {
      return { ok: false, mensaje: "Esos productos no tienen foto." };
    }

    if (superaElLimite(vendedor.id)) {
      return {
        ok: false,
        mensaje: `Llegaste a las ${PUBLICIDADES_POR_DIA} imágenes de hoy. Mañana podés generar más; mientras tanto podés cambiar el título de la última.`,
      };
    }

    const fotos = (
      await Promise.all(
        elegidos.map(
          async (producto) =>
            (await almacenamiento.abrir(producto!.imagenes[0]!))?.contenido,
        ),
      )
    ).filter((foto): foto is Buffer => Boolean(foto));
    if (fotos.length === 0) {
      return { ok: false, mensaje: "No se pudieron leer las fotos." };
    }

    const ocasion =
      proximasFechasComerciales(hoyEnZona(), 21)[0]?.nombre ?? null;
    const rubro = RUBROS[vendedor.rubro];

    const [escena, titular] = await Promise.all([
      generarEscenaPublicitaria(fotos, {
        productos: elegidos.map((p) => p!.nombre),
        rubro,
        ocasion,
      }),
      // El título es un extra: si falla, se escribe a mano.
      titularPublicitario({
        emprendimiento: vendedor.emprendimiento,
        rubro,
        productos: elegidos.map((p) => ({
          nombre: p!.nombre,
          descripcion: p!.descripcion,
        })),
        ocasion,
      }).catch(() => ""),
    ]);

    const webp = await sharp(escena)
      .resize({ width: 1080, withoutEnlargement: false })
      .webp({ quality: 88 })
      .toBuffer();
    const fondo = await almacenamiento.guardarBuffer(webp, "productos", {
      tipoMime: "image/webp",
      carpeta: `${carpetaDelVendedor(vendedor.id)}/publicidad`,
    });

    const anterior = pedido.anterior ?? "";
    if (
      rutaEsDelVendedor(anterior, vendedor.id) &&
      anterior.includes("/publicidad/")
    ) {
      await almacenamiento.eliminar(anterior);
    }

    return { ok: true, fondo, titular };
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;
    return {
      ok: false,
      mensaje:
        error instanceof ErrorDeIA
          ? error.message
          : "No se pudo generar la imagen. Probá de nuevo en un momento.",
    };
  }
}
