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
import {
  descartarCambio,
  type DatosPorSeccion,
  proponerCambio,
} from "@/lib/revision";
import { guardarImagenOpcional } from "@/lib/storage";
import {
  aprobarVendedorSchema,
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
    seccion: "IDENTIDAD",
    esquema: perfilVendedorSchema.pick({ emprendimiento: true, rubro: true }),
  },
  descripcion: {
    seccion: "DESCRIPCION",
    esquema: perfilVendedorSchema.pick({ descripcion: true }),
  },
  contacto: {
    seccion: "CONTACTO",
    esquema: perfilVendedorSchema.pick({
      whatsapp: true,
      telefono: true,
      email: true,
      instagram: true,
      facebook: true,
      sitioWeb: true,
      direccion: true,
    }),
  },
} as const;

const SECCIONES_DE_IMAGEN = {
  portada: { campo: "imagenPortada", lado: undefined },
  logo: { campo: "logo", lado: LADO_LOGO },
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

/** Lo que se le dice al feriante al mandar algo: que no salió todavía. */
const ENVIADO_A_REVISION =
  "Listo, quedó en revisión. Los vecinos ven lo anterior hasta que la Dirección lo apruebe.";

/**
 * Manda a revisión una sola parte de la vidriera: la que dice el campo
 * `seccion`.
 *
 * No publica nada: deja un `CambioDelStand` pendiente (ver `src/lib/revision.ts`)
 * y el vecino sigue viendo lo anterior hasta que la administración lo aprueba.
 * El feriante, en cambio, ve lo nuevo en «Mi stand», con el cartel «En
 * revisión».
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
      const { campo, lado } = SECCIONES_DE_IMAGEN[seccion];
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

      if (campo === "logo") {
        await proponerCambio({
          vendedorId: vendedor.id,
          seccion: "LOGO",
          datos: { logo: nueva },
        });
      } else {
        await proponerCambio({
          vendedorId: vendedor.id,
          seccion: "PORTADA",
          datos: { imagenPortada: nueva },
        });
      }

      revalidatePath("/mi-stand");
      revalidatePath("/admin/revisiones");
      return estadoDeExito(ENVIADO_A_REVISION);
    }

    // ----------------------------- Secciones de texto ------------------------
    if (!esSeccionDeTexto(seccion)) {
      return estadoDeError("No sabemos qué parte del stand querés guardar.");
    }
    const { esquema, seccion: tipo } = SECCIONES_DE_TEXTO[seccion];

    const validacion = esquema.safeParse(Object.fromEntries(datos));
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    await proponerCambio({
      vendedorId: vendedor.id,
      seccion: tipo,
      datos: validacion.data as DatosPorSeccion[typeof tipo],
    });

    revalidatePath("/mi-stand");
    revalidatePath("/admin/revisiones");
    return estadoDeExito(ENVIADO_A_REVISION);
  });
}

/**
 * El feriante retira un cambio que todavía no se revisó, o da por visto uno
 * que le rechazaron. Lo publicado no se toca.
 */
export async function descartarCambioDelStand(datos: FormData): Promise<void> {
  const { vendedor } = await obtenerVendedorActual();
  const cambioId = String(datos.get("cambioId") ?? "");
  if (!cambioId) return;

  if (await descartarCambio(cambioId, vendedor.id)) {
    revalidatePath("/mi-stand");
    revalidatePath("/mi-stand/modo-feria");
    revalidatePath("/admin/revisiones");
  }
}
