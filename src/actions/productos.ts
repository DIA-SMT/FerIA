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
import { requerirVendedorAprobado } from "@/lib/session";
import { almacenamiento, validarImagen } from "@/lib/storage";
import { productoSchema } from "@/lib/validations/producto";

const MAXIMO_IMAGENES = 4;

function revalidarCatalogo(slug: string): void {
  revalidatePath("/mi-stand/productos");
  revalidatePath("/stands");
  revalidatePath(`/stands/${slug}`);
}

/** Guarda las fotos nuevas de un producto respetando el tope por producto. */
async function guardarFotos(
  datos: FormData,
  yaCargadas: number,
): Promise<string[]> {
  const archivos = datos
    .getAll("imagenes")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);

  const disponibles = Math.max(0, MAXIMO_IMAGENES - yaCargadas);
  const rutas: string[] = [];

  for (const archivo of archivos.slice(0, disponibles)) {
    validarImagen(archivo);
    rutas.push(await almacenamiento.guardar(archivo, "productos"));
  }

  return rutas;
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
    const imagenes = await guardarFotos(datos, 0);

    await prisma.producto.create({
      data: {
        vendedorId: vendedor.id,
        nombre: entrada.nombre,
        descripcion: entrada.descripcion,
        precio: entrada.precio,
        disponible: entrada.disponible,
        destacado: entrada.destacado,
        imagenes,
      },
    });

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

    // Las que el feriante dejó marcadas + las que sube ahora.
    const conservadas = entrada.imagenesActuales.filter((ruta) =>
      actual.imagenes.includes(ruta),
    );
    const nuevas = await guardarFotos(datos, conservadas.length);

    await prisma.producto.update({
      where: { id: productoId },
      data: {
        nombre: entrada.nombre,
        descripcion: entrada.descripcion,
        precio: entrada.precio,
        disponible: entrada.disponible,
        destacado: entrada.destacado,
        imagenes: [...conservadas, ...nuevas],
      },
    });

    // Borramos del disco las fotos que se quitaron.
    for (const ruta of actual.imagenes) {
      if (!conservadas.includes(ruta)) await almacenamiento.eliminar(ruta);
    }

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
