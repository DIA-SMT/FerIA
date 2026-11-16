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
import { LADO_LOGO } from "@/lib/imagenes";
import { obtenerVendedorActual, requerirAdmin } from "@/lib/session";
import { generarSlugUnico } from "@/lib/slug";
import { almacenamiento, guardarImagenOpcional } from "@/lib/storage";
import {
  aprobarVendedorSchema,
  type PerfilVendedor,
  perfilVendedorSchema,
  rechazarVendedorSchema,
} from "@/lib/validations/vendedor";

function revalidarVendedores(slug?: string): void {
  revalidatePath("/");
  revalidatePath("/stands");
  revalidatePath("/admin");
  revalidatePath("/admin/postulaciones");
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

/**
 * Las partes del stand que se editan por separado, cada una desde su lápiz en
 * «Mi stand». Cada sección valida sólo sus campos: guardar el contacto no puede
 * fallar por un nombre que no se tocó, ni pisar una descripción que no viajó.
 */
const SECCIONES_DE_TEXTO = {
  identidad: {
    esquema: perfilVendedorSchema.pick({ emprendimiento: true, rubro: true }),
    exito: "Nombre y rubro actualizados.",
  },
  descripcion: {
    esquema: perfilVendedorSchema.pick({ descripcion: true }),
    exito: "Descripción actualizada.",
  },
  contacto: {
    esquema: perfilVendedorSchema.pick({
      whatsapp: true,
      telefono: true,
      email: true,
      instagram: true,
      facebook: true,
      sitioWeb: true,
      direccion: true,
    }),
    exito: "Contacto actualizado.",
  },
} as const;

const SECCIONES_DE_IMAGEN = {
  portada: {
    campo: "imagenPortada",
    lado: undefined,
    exito: "Portada actualizada.",
  },
  logo: { campo: "logo", lado: LADO_LOGO, exito: "Logo actualizado." },
} as const;

function esSeccionDeTexto(
  seccion: string,
): seccion is keyof typeof SECCIONES_DE_TEXTO {
  return Object.hasOwn(SECCIONES_DE_TEXTO, seccion);
}

function esSeccionDeImagen(
  seccion: string,
): seccion is keyof typeof SECCIONES_DE_IMAGEN {
  return Object.hasOwn(SECCIONES_DE_IMAGEN, seccion);
}

/**
 * Guarda una sola parte de la vidriera: la que dice el campo `seccion`.
 *
 * Reemplaza al formulario único de «Mi vidriera», que mandaba todo junto. Ahora
 * el feriante edita sobre su propio stand, una parte por vez, y cada lápiz abre
 * sólo los campos de esa parte.
 */
export async function actualizarSeccionDelStand(
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

    const seccion = String(datos.get("seccion") ?? "");

    // ------------------------------ Portada o logo ---------------------------
    if (esSeccionDeImagen(seccion)) {
      const { campo, lado, exito } = SECCIONES_DE_IMAGEN[seccion];
      const nueva = await guardarImagenOpcional(
        datos.get(campo),
        "vendedores",
        lado,
      );
      if (!nueva) {
        return {
          ok: false,
          mensaje: "Elegí una foto para guardar.",
          errores: { [campo]: ["Elegí una foto."] },
        };
      }

      const anterior = campo === "logo" ? vendedor.logo : vendedor.imagenPortada;
      await prisma.vendedor.update({
        where: { id: vendedor.id },
        data: campo === "logo" ? { logo: nueva } : { imagenPortada: nueva },
      });
      if (anterior) await almacenamiento.eliminar(anterior);

      revalidatePath("/mi-stand");
      revalidarVendedores(vendedor.slug);
      return estadoDeExito(exito);
    }

    // ----------------------------- Secciones de texto ------------------------
    if (!esSeccionDeTexto(seccion)) {
      return estadoDeError("No sabemos qué parte del stand querés guardar.");
    }
    const { esquema, exito } = SECCIONES_DE_TEXTO[seccion];

    const validacion = esquema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);
    const entrada: Partial<PerfilVendedor> = validacion.data;

    // El slug acompaña al nombre del emprendimiento (es la URL pública).
    let slug = vendedor.slug;
    if (
      entrada.emprendimiento &&
      entrada.emprendimiento !== vendedor.emprendimiento
    ) {
      slug = await generarSlugUnico(
        entrada.emprendimiento,
        async (candidato) =>
          (await prisma.vendedor.count({
            where: { slug: candidato, id: { not: vendedor.id } },
          })) > 0,
      );
    }

    await prisma.vendedor.update({
      where: { id: vendedor.id },
      data: { ...entrada, slug },
    });

    revalidatePath("/mi-stand");
    revalidarVendedores(slug);
    if (slug !== vendedor.slug) revalidatePath(`/stands/${vendedor.slug}`);

    return estadoDeExito(exito);
  });
}
