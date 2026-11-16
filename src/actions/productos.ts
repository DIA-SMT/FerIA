"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { rutaEsDelVendedor } from "@/lib/fotos-producto";
import {
  esProductoNuevo,
  imagenesDelCambio,
  leerDatos,
  proponerCambio,
} from "@/lib/revision";
import { requerirVendedorAprobado } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";
import { productoSchema } from "@/lib/validations/producto";

/*
  Los productos pasan por la revisión de la administración (ver
  `src/lib/revision.ts`): uno nuevo nace sin publicar, y los cambios a uno
  publicado esperan aprobación mientras el vecino ve el de antes. Marcarlo sin
  stock y eliminarlo, en cambio, son inmediatos: sólo sacan algo de la vista.
*/

const MAXIMO_IMAGENES = 4;

function revalidarCatalogo(slug: string): void {
  revalidatePath("/mi-stand");
  revalidatePath("/stands");
  revalidatePath(`/stands/${slug}`);
  revalidatePath("/admin/revisiones");
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

    // Nace sin publicar: el vecino lo ve recién cuando se aprueba su alta.
    const producto = await prisma.producto.create({
      data: {
        vendedorId: vendedor.id,
        nombre: entrada.nombre,
        descripcion: entrada.descripcion,
        precio: entrada.precio,
        stock: entrada.stock,
        disponible: entrada.disponible,
        destacado: entrada.destacado,
        imagenes,
        publicado: false,
      },
      select: { id: true },
    });
    await proponerCambio({
      vendedorId: vendedor.id,
      seccion: "PRODUCTO",
      productoId: producto.id,
      datos: { nuevo: true },
    });

    // Recién con el producto guardado se borran las variantes sin elegir: si el
    // guardado falla, siguen ahí y el feriante puede reintentar sin rehacerlas.
    await descartarVariantes(datos, vendedor.id);

    revalidarCatalogo(vendedor.slug);

    // A «Mi stand», al catálogo, donde se ve el producto recién agregado.
    // Quedarse en el formulario lo dejaba con el nombre y las fotos todavía
    // cargados, y un segundo toque creaba otro producto con los mismos
    // archivos: al borrar uno, el otro se quedaba sin fotos.
    redirect("/mi-stand?agregado=1#catalogo");
  });
}

export async function actualizarProducto(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await requerirVendedorAprobado();

    const productoId = String(datos.get("productoId") ?? "");
    if (!productoId)
      return estadoDeError("Falta el identificador del producto.");

    const actual = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true, vendedorId: true, imagenes: true, publicado: true },
    });

    // Un feriante sólo puede tocar su propio catálogo.
    if (!actual || actual.vendedorId !== vendedor.id) {
      return estadoDeError("El producto no existe o no te pertenece.");
    }

    const validacion = productoSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    // La versión que el feriante tenía en pantalla: la propuesta pendiente si
    // había una, o la publicada. Sus fotos son las que puede conservar.
    const pendiente = actual.publicado
      ? await prisma.cambioDelStand.findFirst({
          where: { productoId, seccion: "PRODUCTO", estado: "PENDIENTE" },
          select: { datos: true },
        })
      : null;
    const propuesta = pendiente ? leerDatos("PRODUCTO", pendiente.datos) : null;
    const imagenesEnPantalla =
      propuesta && !esProductoNuevo(propuesta)
        ? propuesta.imagenes
        : actual.imagenes;

    // Las que el feriante dejó marcadas + las que eligió en el selector.
    const conservadas = entrada.imagenesActuales.filter((ruta) =>
      imagenesEnPantalla.includes(ruta),
    );
    const nuevas = fotosElegidas(datos, vendedor.id, conservadas.length);
    const imagenes = [...conservadas, ...nuevas];

    if (!actual.publicado) {
      // Todavía no lo ve nadie: se corrige en su propia fila y vuelve a
      // revisión (si lo habían rechazado, con esto queda pendiente de nuevo).
      await prisma.producto.update({
        where: { id: productoId },
        data: {
          nombre: entrada.nombre,
          descripcion: entrada.descripcion,
          precio: entrada.precio,
          stock: entrada.stock,
          disponible: entrada.disponible,
          destacado: entrada.destacado,
          imagenes,
        },
      });
      for (const ruta of actual.imagenes) {
        if (!conservadas.includes(ruta)) await almacenamiento.eliminar(ruta);
      }
      await proponerCambio({
        vendedorId: vendedor.id,
        seccion: "PRODUCTO",
        productoId,
        datos: { nuevo: true },
      });
    } else {
      // Publicado: el vecino lo sigue viendo como está hasta que se apruebe.
      // La disponibilidad y la cantidad se aplican ya, como el botón «Marcar
      // sin stock»: son el día a día del puesto, no contenido nuevo, y esperar
      // una revisión las dejaría desactualizadas. Las fotos publicadas que el
      // feriante sacó no se borran todavía: se siguen viendo.
      await prisma.producto.update({
        where: { id: productoId },
        data: { disponible: entrada.disponible, stock: entrada.stock ?? null },
      });
      await proponerCambio({
        vendedorId: vendedor.id,
        seccion: "PRODUCTO",
        productoId,
        datos: {
          nombre: entrada.nombre,
          descripcion: entrada.descripcion,
          imagenes,
          precio: entrada.precio ?? null,
          stock: entrada.stock ?? null,
          destacado: entrada.destacado,
        },
      });
    }
    await descartarVariantes(datos, vendedor.id);

    revalidarCatalogo(vendedor.slug);

    // De vuelta al stand, para ver cómo quedó entre los demás: la edición se
    // abre desde la tarjeta del catálogo y ahí vuelve.
    redirect("/mi-stand?actualizado=1#catalogo");
  });
}

export async function eliminarProducto(datos: FormData): Promise<void> {
  const { vendedor } = await requerirVendedorAprobado();

  const productoId = String(datos.get("productoId") ?? "");
  if (!productoId) return;

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: {
      vendedorId: true,
      imagenes: true,
      cambios: { select: { seccion: true, datos: true } },
    },
  });

  if (!producto || producto.vendedorId !== vendedor.id) return;

  // Se van con el producto: los cambios en revisión caen en cascada.
  await prisma.producto.delete({ where: { id: productoId } });

  const fotos = new Set([
    ...producto.imagenes,
    ...producto.cambios.flatMap((cambio) =>
      imagenesDelCambio(cambio.seccion, cambio.datos),
    ),
  ]);
  for (const ruta of fotos) {
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
