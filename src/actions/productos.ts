"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { rutaEsDelVendedor } from "@/lib/fotos-producto";
import { requerirVendedorAprobado } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";
import { productoSchema } from "@/lib/validations/producto";

const MAXIMO_IMAGENES = 4;

function revalidarCatalogo(slug: string): void {
  revalidatePath("/mi-stand/productos");
  revalidatePath("/stands");
  revalidatePath(`/stands/${slug}`);
}

/** Separa un campo de rutas separadas por coma. */
function leerRutas(datos: FormData, campo: string): string[] {
  return String(datos.get(campo) ?? "")
    .split(",")
    .map((ruta) => ruta.trim())
    .filter(Boolean);
}

/**
 * Rutas de las fotos nuevas elegidas en el selector, ya subidas a Storage.
 *
 * **Se filtra por propiedad.** Las rutas viajan al cliente y vuelven en el
 * formulario, así que hay que verificar que cada una esté dentro de la carpeta
 * de quien la manda. Sin esto, un feriante podría mandar la ruta de la foto de
 * otro y hacérnosla guardar en su catálogo —o borrar, más abajo.
 */
function fotosElegidas(
  datos: FormData,
  vendedorId: string,
  yaCargadas: number,
): string[] {
  const disponibles = Math.max(0, MAXIMO_IMAGENES - yaCargadas);

  return leerRutas(datos, "imagenesNuevas")
    .filter((ruta) => rutaEsDelVendedor(ruta, vendedorId))
    .slice(0, disponibles);
}

/**
 * Borra las variantes que el feriante no eligió.
 *
 * Es limpieza, no parte del negocio: si alguna falla, la operación principal
 * sigue. Mismo filtro de propiedad que arriba, y por el mismo motivo.
 */
async function descartarVariantes(
  datos: FormData,
  vendedorId: string,
): Promise<void> {
  const rutas = leerRutas(datos, "imagenesDescartadas").filter((ruta) =>
    rutaEsDelVendedor(ruta, vendedorId),
  );

  await Promise.all(rutas.map((ruta) => almacenamiento.eliminar(ruta)));
}

export async function crearProducto(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await requerirVendedorAprobado();

    const validacion = productoSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;
    const imagenes = fotosElegidas(datos, vendedor.id, 0);

    await prisma.producto.create({
      data: {
        vendedorId: vendedor.id,
        nombre: entrada.nombre,
        descripcion: entrada.descripcion,
        disponible: entrada.disponible,
        destacado: entrada.destacado,
        imagenes,
      },
    });

    // Recién con el producto guardado se borran las variantes sin elegir: si el
    // guardado falla, siguen ahí y el feriante puede reintentar sin rehacerlas.
    await descartarVariantes(datos, vendedor.id);

    revalidarCatalogo(vendedor.slug);
    return estadoDeExito("Producto agregado al catálogo.");
  });
}

export async function actualizarProducto(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await requerirVendedorAprobado();

    const productoId = String(datos.get("productoId") ?? "");
    if (!productoId) return estadoDeError("Falta el identificador del producto.");

    const actual = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true, vendedorId: true, imagenes: true },
    });

    // Un feriante sólo puede tocar su propio catálogo.
    if (!actual || actual.vendedorId !== vendedor.id) {
      return estadoDeError("El producto no existe o no te pertenece.");
    }

    const validacion = productoSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    // Las que el feriante dejó marcadas + las que eligió en el selector.
    const conservadas = entrada.imagenesActuales.filter((ruta) =>
      actual.imagenes.includes(ruta),
    );
    const nuevas = fotosElegidas(datos, vendedor.id, conservadas.length);

    await prisma.producto.update({
      where: { id: productoId },
      data: {
        nombre: entrada.nombre,
        descripcion: entrada.descripcion,
        disponible: entrada.disponible,
        destacado: entrada.destacado,
        imagenes: [...conservadas, ...nuevas],
      },
    });

    // Borramos del disco las fotos que se quitaron y las variantes sin elegir.
    for (const ruta of actual.imagenes) {
      if (!conservadas.includes(ruta)) await almacenamiento.eliminar(ruta);
    }
    await descartarVariantes(datos, vendedor.id);

    revalidarCatalogo(vendedor.slug);
    return estadoDeExito("Producto actualizado.");
  });
}

export async function eliminarProducto(datos: FormData): Promise<void> {
  const { vendedor } = await requerirVendedorAprobado();

  const productoId = String(datos.get("productoId") ?? "");
  if (!productoId) return;

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { vendedorId: true, imagenes: true },
  });

  if (!producto || producto.vendedorId !== vendedor.id) return;

  await prisma.producto.delete({ where: { id: productoId } });

  for (const ruta of producto.imagenes) {
    await almacenamiento.eliminar(ruta);
  }

  revalidarCatalogo(vendedor.slug);
}

/** Marca o desmarca un producto como disponible desde el listado. */
export async function alternarDisponibilidad(datos: FormData): Promise<void> {
  const { vendedor } = await requerirVendedorAprobado();

  const productoId = String(datos.get("productoId") ?? "");
  if (!productoId) return;

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { vendedorId: true, disponible: true },
  });

  if (!producto || producto.vendedorId !== vendedor.id) return;

  await prisma.producto.update({
    where: { id: productoId },
    data: { disponible: !producto.disponible },
  });

  revalidarCatalogo(vendedor.slug);
}
