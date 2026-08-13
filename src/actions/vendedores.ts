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
import { obtenerVendedorActual, requerirAdmin } from "@/lib/session";
import { generarSlugUnico } from "@/lib/slug";
import { almacenamiento, guardarImagenOpcional } from "@/lib/storage";
import {
  aprobarVendedorSchema,
  perfilVendedorSchema,
  rechazarVendedorSchema,
} from "@/lib/validations/vendedor";

function revalidarVendedores(slug?: string): void {
  revalidatePath("/");
  revalidatePath("/stands");
  revalidatePath("/admin");
  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin/canon");
  if (slug) revalidatePath(`/stands/${slug}`);
}

// ---------------------------------------------------------------------------
// Panel municipal — aprobación de solicitudes
// ---------------------------------------------------------------------------

export async function aprobarVendedor(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = aprobarVendedorSchema.safeParse({
      vendedorId: datos.get("vendedorId"),
    });
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const vendedor = await prisma.vendedor.update({
      where: { id: validacion.data.vendedorId },
      data: {
        estado: "APROBADO",
        motivoRechazo: null,
        revisadoEn: new Date(),
      },
      select: { emprendimiento: true, slug: true },
    });

    revalidarVendedores(vendedor.slug);
    return estadoDeExito(
      `${vendedor.emprendimiento} fue aprobado y ya aparece en el market.`,
    );
  });
}

export async function rechazarVendedor(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = rechazarVendedorSchema.safeParse({
      vendedorId: datos.get("vendedorId"),
      motivoRechazo: datos.get("motivoRechazo"),
    });
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const vendedor = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.vendedor.update({
        where: { id: validacion.data.vendedorId },
        data: {
          estado: "RECHAZADO",
          motivoRechazo: validacion.data.motivoRechazo,
          revisadoEn: new Date(),
        },
        select: { id: true, emprendimiento: true, slug: true },
      });

      // Un feriante rechazado no puede seguir ocupando stands.
      await tx.stand.updateMany({
        where: { vendedorId: actualizado.id },
        data: { vendedorId: null, asignadoEn: null },
      });

      return actualizado;
    });

    revalidarVendedores(vendedor.slug);
    return estadoDeExito(
      `La solicitud de ${vendedor.emprendimiento} fue rechazada.`,
    );
  });
}

/** Vuelve a dejar una solicitud rechazada como pendiente, para revisarla de nuevo. */
export async function reabrirSolicitud(datos: FormData): Promise<void> {
  await requerirAdmin();

  const vendedorId = String(datos.get("vendedorId") ?? "");
  if (!vendedorId) return;

  const vendedor = await prisma.vendedor.update({
    where: { id: vendedorId },
    data: { estado: "PENDIENTE", motivoRechazo: null, revisadoEn: null },
    select: { slug: true },
  });

  revalidarVendedores(vendedor.slug);
}

// ---------------------------------------------------------------------------
// Panel del feriante — su propia vidriera
// ---------------------------------------------------------------------------

export async function actualizarPerfilVendedor(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await obtenerVendedorActual();

    if (vendedor.estado !== "APROBADO") {
      return estadoDeError(
        "Tu solicitud todavía no fue aprobada, no podés editar la vidriera.",
      );
    }

    const validacion = perfilVendedorSchema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    // El slug acompaña al nombre del emprendimiento (es la URL pública).
    let slug = vendedor.slug;
    if (entrada.emprendimiento !== vendedor.emprendimiento) {
      slug = await generarSlugUnico(
        entrada.emprendimiento,
        async (candidato) =>
          (await prisma.vendedor.count({
            where: { slug: candidato, id: { not: vendedor.id } },
          })) > 0,
      );
    }

    const portadaNueva = await guardarImagenOpcional(
      datos.get("imagenPortada"),
      "vendedores",
    );
    const logoNuevo = await guardarImagenOpcional(
      datos.get("logo"),
      "vendedores",
    );

    await prisma.vendedor.update({
      where: { id: vendedor.id },
      data: {
        emprendimiento: entrada.emprendimiento,
        slug,
        rubro: entrada.rubro,
        descripcion: entrada.descripcion,
        whatsapp: entrada.whatsapp,
        telefono: entrada.telefono,
        email: entrada.email,
        instagram: entrada.instagram,
        facebook: entrada.facebook,
        sitioWeb: entrada.sitioWeb,
        direccion: entrada.direccion,
        ...(portadaNueva ? { imagenPortada: portadaNueva } : {}),
        ...(logoNuevo ? { logo: logoNuevo } : {}),
      },
    });

    if (portadaNueva && vendedor.imagenPortada) {
      await almacenamiento.eliminar(vendedor.imagenPortada);
    }
    if (logoNuevo && vendedor.logo) {
      await almacenamiento.eliminar(vendedor.logo);
    }

    revalidatePath("/mi-stand/perfil");
    revalidarVendedores(slug);
    if (slug !== vendedor.slug) revalidatePath(`/stands/${vendedor.slug}`);

    return estadoDeExito("Perfil actualizado.");
  });
}
