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
import { consultarCupoDePublicidad } from "@/lib/imagen-del-feriante";
import {
  cuandoPuedeOtra,
  DIAS_DEL_PERIODO,
  MAXIMO_PRODUCTOS_PUBLICIDAD,
  PUBLICIDADES_POR_PERIODO,
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
  /** Cuántas le quedan después de esta. */
  restantes?: number;
  /** Desde cuándo puede otra, si ya no le quedan (ISO). */
  proxima?: string | null;
}

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

    // El tope se cuenta en la base: la ventana es de días y el proceso se
    // reinicia con cada despliegue. Lo que falla no cuenta: se registra recién
    // con la imagen guardada.
    const cupo = await consultarCupoDePublicidad(vendedor.id);
    if (cupo.restantes === 0) {
      return {
        ok: false,
        restantes: 0,
        proxima: cupo.proxima?.toISOString() ?? null,
        mensaje: `Ya generaste ${PUBLICIDADES_POR_PERIODO} imágenes en los últimos ${DIAS_DEL_PERIODO} días. Vas a poder generar otra ${cupo.proxima ? cuandoPuedeOtra(cupo.proxima) : "en unos días"}; mientras tanto podés cambiar el título y el formato de la última.`,
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

    await prisma.publicidadGenerada.create({
      data: { vendedorId: vendedor.id },
    });
    const despues = await consultarCupoDePublicidad(vendedor.id);

    return {
      ok: true,
      fondo,
      titular,
      restantes: despues.restantes,
      proxima: despues.proxima?.toISOString() ?? null,
    };
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
