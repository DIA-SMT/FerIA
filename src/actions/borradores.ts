"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  borradorCompleto,
  fotosDelProducto,
  fotosQueSobran,
  MAXIMO_BORRADORES,
} from "@/lib/borradores";
import { prisma } from "@/lib/db";
import { esControlDeFlujoDeNext } from "@/lib/errores";
import { carpetaDelVendedor } from "@/lib/fotos-producto";
import { aplicarInsigniaMunicipal, procesarFotoProducto } from "@/lib/imagenes";
import { podarSinFrenar } from "@/lib/poda-de-borradores";
import { proponerCambio } from "@/lib/revision";
import { requerirVendedorAprobado } from "@/lib/session";
import { almacenamiento, validarImagen } from "@/lib/storage";
import {
  casilla,
  enteroOpcional,
  textoOpcional,
} from "@/lib/validations/comunes";

/*
  Los borradores de productos (ver `src/lib/borradores.ts`). Se guardan solos
  mientras el feriante los arma, así que estas acciones devuelven un
  resultado en vez de redirigir: la pantalla sigue donde estaba.

  Mandar uno solo a revisión es `crearProducto` con su `productoId`, desde el
  formulario completo; mandar todos los terminados juntos es
  `enviarBorradores`.
*/

export type ResultadoBorrador =
  { ok: true; productoId: string } | { ok: false; mensaje: string };

/** Lo que se puede guardar a medias: el nombre todavía puede estar vacío. */
const textoDelBorrador = z.object({
  nombre: z
    .string()
    .trim()
    .max(140, "El nombre no puede superar los 140 caracteres.")
    .optional()
    .transform((valor) => valor ?? ""),
  descripcion: textoOpcional(1500, "La descripción"),
});

/** Lo demás del formulario completo, con las mismas reglas que el alta. */
const restoDelFormulario = z.object({
  stock: enteroOpcional(0, 1_000_000, "La cantidad").optional(),
  disponible: casilla,
  destacado: casilla,
});

function revalidar(slug: string): void {
  revalidatePath("/mi-stand");
  revalidatePath("/mi-stand/productos/borradores");
  revalidatePath(`/stands/${slug}`);
}

function leerRutas(datos: FormData, campo: string): string[] {
  return String(datos.get(campo) ?? "")
    .split(",")
    .map((ruta) => ruta.trim())
    .filter(Boolean);
}

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisá los datos.";
}

/**
 * Guarda un borrador: lo crea si todavía no existe, o lo actualiza.
 *
 * Desde el formulario completo (`formularioCompleto`) guarda todo, fotos
 * incluidas. Desde la lista de borradores guarda sólo el nombre y la
 * descripción, y deja lo demás como estaba.
 */
export async function guardarBorrador(
  datos: FormData,
): Promise<ResultadoBorrador> {
  try {
    const { vendedor } = await requerirVendedorAprobado();
    await podarSinFrenar();

    const texto = textoDelBorrador.safeParse({
      nombre: datos.get("nombre") ?? undefined,
      descripcion: datos.get("descripcion") ?? undefined,
    });
    if (!texto.success) return { ok: false, mensaje: primerError(texto.error) };

    const completo = datos.get("formularioCompleto") === "1";
    const resto = completo
      ? restoDelFormulario.safeParse(Object.fromEntries(datos))
      : null;
    if (resto && !resto.success) {
      return { ok: false, mensaje: primerError(resto.error) };
    }

    const productoId = String(datos.get("productoId") ?? "");
    const actual = productoId
      ? await prisma.producto.findFirst({
          where: { id: productoId, vendedorId: vendedor.id, borrador: true },
          select: { id: true, imagenes: true },
        })
      : null;
    if (productoId && !actual) {
      return {
        ok: false,
        mensaje:
          "Este borrador ya no existe: se borró, o ya lo mandaste a revisión.",
      };
    }
    if (!actual) {
      const cuantos = await prisma.producto.count({
        where: { vendedorId: vendedor.id, borrador: true },
      });
      if (cuantos >= MAXIMO_BORRADORES) {
        return {
          ok: false,
          mensaje: `Ya tenés ${MAXIMO_BORRADORES} borradores. Mandá a revisión o borrá alguno para seguir.`,
        };
      }
    }

    const antes = actual?.imagenes ?? [];
    const imagenes = completo
      ? fotosDelProducto({
          enElProducto: antes,
          conservadas: leerRutas(datos, "imagenesActuales"),
          nuevas: leerRutas(datos, "imagenesNuevas"),
          vendedorId: vendedor.id,
        })
      : antes;

    const campos = {
      nombre: texto.data.nombre,
      descripcion: texto.data.descripcion,
      ...(resto?.success
        ? {
            stock: resto.data.stock ?? null,
            disponible: resto.data.disponible,
            destacado: resto.data.destacado,
            imagenes,
          }
        : {}),
    };

    const producto = actual
      ? await prisma.producto.update({
          where: { id: actual.id },
          data: campos,
          select: { id: true },
        })
      : await prisma.producto.create({
          data: {
            ...campos,
            imagenes,
            vendedorId: vendedor.id,
            publicado: false,
            borrador: true,
          },
          select: { id: true },
        });

    if (completo) {
      const sobran = fotosQueSobran({
        antes,
        descartadas: leerRutas(datos, "imagenesDescartadas"),
        ahora: imagenes,
        vendedorId: vendedor.id,
      });
      for (const ruta of sobran) await almacenamiento.eliminar(ruta);
    }

    revalidar(vendedor.slug);
    return { ok: true, productoId: producto.id };
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;
    console.error("[borradores] no se pudo guardar", error);
    return { ok: false, mensaje: "No se pudo guardar el borrador." };
  }
}

/**
 * Una foto, un borrador: para subir varias de una vez. La foto pasa por el
 * mismo arreglo que en el alta (cuadrada, con la luz levantada y la insignia).
 * El nombre y la descripción se ponen después.
 */
export async function crearBorradorConFoto(
  datos: FormData,
): Promise<ResultadoBorrador> {
  try {
    const { vendedor } = await requerirVendedorAprobado();
    await podarSinFrenar();

    const archivo = datos.get("foto");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, mensaje: "No llegó la foto." };
    }
    validarImagen(archivo);

    const cuantos = await prisma.producto.count({
      where: { vendedorId: vendedor.id, borrador: true },
    });
    if (cuantos >= MAXIMO_BORRADORES) {
      return {
        ok: false,
        mensaje: `Ya tenés ${MAXIMO_BORRADORES} borradores. Mandá a revisión o borrá alguno para seguir.`,
      };
    }

    const procesada = await procesarFotoProducto(
      Buffer.from(await archivo.arrayBuffer()),
    );
    const conInsignia = await aplicarInsigniaMunicipal(procesada.contenido);
    const ruta = await almacenamiento.guardarBuffer(
      conInsignia.contenido,
      "productos",
      { carpeta: carpetaDelVendedor(vendedor.id) },
    );

    const producto = await prisma.producto.create({
      data: {
        vendedorId: vendedor.id,
        nombre: "",
        imagenes: [ruta],
        publicado: false,
        borrador: true,
      },
      select: { id: true },
    });

    revalidar(vendedor.slug);
    return { ok: true, productoId: producto.id };
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;
    return {
      ok: false,
      mensaje:
        error instanceof Error ? error.message : "No se pudo subir la foto.",
    };
  }
}

/**
 * Manda a revisión todos los borradores terminados (con nombre). Los que no
 * tienen nombre se quedan como borradores.
 */
export async function enviarBorradores(): Promise<{
  ok: boolean;
  enviados: number;
  sinNombre: number;
  mensaje?: string;
}> {
  try {
    const { vendedor } = await requerirVendedorAprobado();

    const borradores = await prisma.producto.findMany({
      where: { vendedorId: vendedor.id, borrador: true },
      select: { id: true, nombre: true },
    });
    const listos = borradores.filter((producto) =>
      borradorCompleto(producto.nombre),
    );

    for (const producto of listos) {
      // `borrador: true` en el filtro: si ya lo mandó desde otra pestaña, no
      // se manda dos veces.
      const { count } = await prisma.producto.updateMany({
        where: { id: producto.id, borrador: true },
        data: { borrador: false, nombre: producto.nombre.trim() },
      });
      if (count === 0) continue;
      await proponerCambio({
        vendedorId: vendedor.id,
        seccion: "PRODUCTO",
        productoId: producto.id,
        datos: { nuevo: true },
      });
    }

    revalidar(vendedor.slug);
    revalidatePath("/admin/revisiones");
    return {
      ok: true,
      enviados: listos.length,
      sinNombre: borradores.length - listos.length,
    };
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;
    console.error("[borradores] no se pudieron enviar", error);
    return {
      ok: false,
      enviados: 0,
      sinNombre: 0,
      mensaje: "No se pudieron mandar a revisión. Probá de nuevo.",
    };
  }
}
