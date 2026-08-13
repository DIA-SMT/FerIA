"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { guardarUbicacion, limpiarUbicacion } from "@/lib/geo";
import { requerirAdmin } from "@/lib/session";
import { generarSlugUnico } from "@/lib/slug";
import { almacenamiento, guardarImagenOpcional } from "@/lib/storage";
import { feriaSchema } from "@/lib/validations/feria";

/** Refresca el market público y el panel después de tocar una feria. */
function revalidarFerias(slug?: string): void {
  revalidatePath("/");
  revalidatePath("/ferias");
  revalidatePath("/stands");
  revalidatePath("/admin/ferias");
  revalidatePath("/admin");
  if (slug) revalidatePath(`/ferias/${slug}`);
}

export async function crearFeria(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = feriaSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    const slug = await generarSlugUnico(
      entrada.nombre,
      async (candidato) =>
        (await prisma.feria.count({ where: { slug: candidato } })) > 0,
    );

    const imagen = await guardarImagenOpcional(datos.get("imagen"), "ferias");

    const feria = await prisma.$transaction(async (tx) => {
      const creada = await tx.feria.create({
        data: {
          nombre: entrada.nombre,
          slug,
          descripcion: entrada.descripcion,
          categoria: entrada.categoria,
          direccion: entrada.direccion,
          latitud: entrada.latitud ?? null,
          longitud: entrada.longitud ?? null,
          activa: entrada.activa,
          imagen,
        },
      });

      if (entrada.latitud !== undefined && entrada.longitud !== undefined) {
        await guardarUbicacion(tx, creada.id, entrada.latitud, entrada.longitud);
      }

      return creada;
    });

    revalidarFerias(feria.slug);
    redirect(`/admin/ferias/${feria.id}`);
  });
}

export async function actualizarFeria(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const feriaId = String(datos.get("feriaId") ?? "");
    if (!feriaId) return estadoDeError("Falta el identificador de la feria.");

    const actual = await prisma.feria.findUnique({ where: { id: feriaId } });
    if (!actual) return estadoDeError("La feria no existe.");

    const validacion = feriaSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    // Si cambió el nombre, recalculamos el slug (la URL pública sigue al nombre).
    let slug = actual.slug;
    if (entrada.nombre !== actual.nombre) {
      slug = await generarSlugUnico(
        entrada.nombre,
        async (candidato) =>
          (await prisma.feria.count({
            where: { slug: candidato, id: { not: feriaId } },
          })) > 0,
      );
    }

    const imagenNueva = await guardarImagenOpcional(
      datos.get("imagen"),
      "ferias",
    );

    await prisma.$transaction(async (tx) => {
      await tx.feria.update({
        where: { id: feriaId },
        data: {
          nombre: entrada.nombre,
          slug,
          descripcion: entrada.descripcion,
          categoria: entrada.categoria,
          direccion: entrada.direccion,
          latitud: entrada.latitud ?? null,
          longitud: entrada.longitud ?? null,
          activa: entrada.activa,
          ...(imagenNueva ? { imagen: imagenNueva } : {}),
        },
      });

      if (entrada.latitud !== undefined && entrada.longitud !== undefined) {
        await guardarUbicacion(tx, feriaId, entrada.latitud, entrada.longitud);
      } else {
        await limpiarUbicacion(tx, feriaId);
      }
    });

    // La portada anterior queda huérfana: la borramos recién ahora, con la
    // actualización ya confirmada.
    if (imagenNueva && actual.imagen) {
      await almacenamiento.eliminar(actual.imagen);
    }

    revalidarFerias(slug);
    if (slug !== actual.slug) revalidatePath(`/ferias/${actual.slug}`);

    return estadoDeExito("Feria actualizada.");
  });
}

export async function eliminarFeria(datos: FormData): Promise<void> {
  await requerirAdmin();

  const feriaId = String(datos.get("feriaId") ?? "");
  if (!feriaId) return;

  const feria = await prisma.feria.findUnique({
    where: { id: feriaId },
    select: { imagen: true, slug: true },
  });

  // Las ediciones, stands y pagos se borran en cascada (ver schema.prisma).
  await prisma.feria.delete({ where: { id: feriaId } });

  if (feria?.imagen) await almacenamiento.eliminar(feria.imagen);

  revalidarFerias(feria?.slug);
  redirect("/admin/ferias");
}
