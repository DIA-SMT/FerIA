"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  type EstadoFormulario,
} from "@/lib/form";
import {
  obtenerSesion,
  obtenerUsuarioAuth,
  requerirAdmin,
  requerirVendedor,
} from "@/lib/session";
import { generarSlugUnico } from "@/lib/slug";
import {
  encuestaSchema,
  postulacionSchema,
  resolverPostulacionSchema,
} from "@/lib/validations/postulacion";

/**
 * El circuito de postulaciones.
 *
 * El feriante entra por CiDiTuc, completa la encuesta eligiendo una feria, y la
 * Dirección la acepta o la rechaza desde el panel. Aceptar significa «es
 * feriante de esta feria»; el número de puesto se asigna después, por `Stand`.
 */

function revalidarPostulaciones(): void {
  revalidatePath("/admin/postulaciones");
  revalidatePath("/mi-stand");
}

/**
 * El documento que CiDiTuc verificó, guardado en el metadata de la cuenta.
 *
 * Devuelve `null` para quien entró con correo y contraseña: ahí nadie verificó
 * nada, y un DNI escrito a mano no es lo mismo que uno validado contra el
 * padrón municipal. Preferible una ficha sin DNI que una con un DNI que dice
 * tener un respaldo que no tiene.
 */
async function documentoDeLaSesion(): Promise<string | null> {
  const usuario = await obtenerUsuarioAuth();
  const valor = usuario?.user_metadata?.["documento"];
  return typeof valor === "string" && /^\d{6,11}$/.test(valor) ? valor : null;
}

/**
 * Primera encuesta: crea la ficha del emprendimiento y la postulación.
 *
 * Es el reemplazo del registro para los feriantes. No pide ni correo ni
 * contraseña porque quien llega acá ya está autenticado —por CiDiTuc, que
 * además ya verificó su documento—, así que la cuenta existe y lo único que
 * falta es de qué es su emprendimiento y a qué feria quiere ir.
 */
export async function enviarEncuesta(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const sesion = await obtenerSesion();
    if (!sesion) return estadoDeError("Tenés que ingresar para postularte.");

    const entrada = encuestaSchema.parse(Object.fromEntries(datos));

    // El DNI no se pide en el formulario: lo trae CiDiTuc ya verificado y el
    // callback lo dejó en el metadata de la cuenta. Guardarlo en la ficha es lo
    // que permite reconocer a esta persona si vuelve con otro correo, y lo que
    // va a enganchar su ficha con la del padrón de Feria Digital cuando se
    // importe, en vez de duplicarla.
    const documento = await documentoDeLaSesion();

    const feria = await prisma.feria.findFirst({
      where: { id: entrada.feriaId, activa: true },
      select: { id: true, nombre: true },
    });
    if (!feria) return estadoDeError("Esa feria ya no está disponible.");

    const existente = await prisma.vendedor.findUnique({
      where: { usuarioId: sesion.id },
      select: { id: true },
    });

    if (existente) {
      // Ya tiene ficha: esto es una postulación más, no un alta. Se delega
      // para no duplicar la regla de «una por feriante y por feria».
      return postularAFeria(existente.id, feria.id, entrada.mensaje);
    }

    const slug = await generarSlugUnico(
      entrada.emprendimiento,
      async (candidato) =>
        (await prisma.vendedor.count({ where: { slug: candidato } })) > 0,
    );

    await prisma.vendedor.create({
      data: {
        usuarioId: sesion.id,
        emprendimiento: entrada.emprendimiento,
        slug,
        rubro: entrada.rubro,
        descripcion: entrada.descripcion,
        whatsapp: entrada.whatsapp,
        telefono: entrada.telefono,
        email: sesion.email,
        nombreResponsable: sesion.nombre,
        dni: documento,
        instagram: entrada.instagram,
        facebook: entrada.facebook,
        sitioWeb: entrada.sitioWeb,
        direccion: entrada.direccion,
        // La ficha nace PENDIENTE y se publica recién cuando la Dirección
        // acepta la postulación: nadie aparece en la vidriera por haber
        // completado un formulario.
        estado: "PENDIENTE",
        postulaciones: {
          create: { feriaId: feria.id, mensaje: entrada.mensaje },
        },
      },
    });

    revalidarPostulaciones();
    redirect("/mi-stand?postulacion=enviada");
  });
}

/** Postularse a otra feria, con la ficha ya creada. */
export async function postularme(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const sesion = await requerirVendedor();
    const entrada = postulacionSchema.parse(Object.fromEntries(datos));

    const vendedor = await prisma.vendedor.findUnique({
      where: { usuarioId: sesion.id },
      select: { id: true },
    });
    if (!vendedor) return estadoDeError("Todavía no completaste tu ficha.");

    const feria = await prisma.feria.findFirst({
      where: { id: entrada.feriaId, activa: true },
      select: { id: true },
    });
    if (!feria) return estadoDeError("Esa feria ya no está disponible.");

    return postularAFeria(vendedor.id, feria.id, entrada.mensaje);
  });
}

/**
 * Crea o reabre la postulación de un feriante a una feria.
 *
 * Reabre en vez de acumular: el índice único es (vendedor, feria), así que un
 * rechazado que vuelve a intentar actualiza la misma fila. Dos filas contando
 * la misma historia obligarían al panel a decidir cuál mirar.
 */
async function postularAFeria(
  vendedorId: string,
  feriaId: string,
  mensaje: string | null,
): Promise<EstadoFormulario> {
  const previa = await prisma.postulacion.findUnique({
    where: { vendedorId_feriaId: { vendedorId, feriaId } },
    select: { estado: true },
  });

  if (previa?.estado === "PENDIENTE") {
    return estadoDeError("Ya tenés una postulación a esa feria esperando respuesta.");
  }
  if (previa?.estado === "ACEPTADA") {
    return estadoDeError("Ya sos feriante de esa feria.");
  }

  await prisma.postulacion.upsert({
    where: { vendedorId_feriaId: { vendedorId, feriaId } },
    create: { vendedorId, feriaId, mensaje },
    update: {
      estado: "PENDIENTE",
      mensaje,
      motivoRechazo: null,
      revisadoEn: null,
    },
  });

  revalidarPostulaciones();
  return estadoDeExito("Enviamos tu postulación. Te avisamos cuando la revisen.");
}

/**
 * La Dirección resuelve una postulación.
 *
 * Aceptar hace dos cosas, y la segunda importa: además de marcar la
 * postulación, aprueba la ficha del feriante si todavía estaba pendiente. Son
 * la misma decisión —«esta persona participa»— y tenerlas separadas dejaría a
 * alguien aceptado en una feria pero invisible en la vidriera.
 *
 * Lo que NO hace es asignarle un stand: eso es logística de cada edición y se
 * resuelve en /admin/ediciones, para no obligar a tener el mapa resuelto antes
 * de poder contestar.
 */
export async function resolverPostulacion(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const entrada = resolverPostulacionSchema.parse(Object.fromEntries(datos));

    const postulacion = await prisma.postulacion.findUnique({
      where: { id: entrada.postulacionId },
      select: {
        id: true,
        estado: true,
        vendedorId: true,
        vendedor: { select: { emprendimiento: true, slug: true, estado: true } },
        feria: { select: { nombre: true, slug: true } },
      },
    });

    if (!postulacion) return estadoDeError("Esa postulación no existe.");
    if (postulacion.estado !== "PENDIENTE") {
      return estadoDeError("Esa postulación ya fue resuelta.");
    }

    const acepta = entrada.decision === "ACEPTADA";

    await prisma.$transaction(async (tx) => {
      await tx.postulacion.update({
        where: { id: postulacion.id },
        data: {
          estado: entrada.decision,
          motivoRechazo: acepta ? null : entrada.motivoRechazo,
          revisadoEn: new Date(),
        },
      });

      if (acepta && postulacion.vendedor.estado !== "APROBADO") {
        await tx.vendedor.update({
          where: { id: postulacion.vendedorId },
          data: { estado: "APROBADO", motivoRechazo: null, revisadoEn: new Date() },
        });
      }
    });

    revalidarPostulaciones();
    revalidatePath("/stands");
    revalidatePath(`/stands/${postulacion.vendedor.slug}`);
    revalidatePath(`/ferias/${postulacion.feria.slug}`);

    return estadoDeExito(
      acepta
        ? `${postulacion.vendedor.emprendimiento} ya es feriante de ${postulacion.feria.nombre}. Falta asignarle un stand en la edición que corresponda.`
        : `Se rechazó la postulación de ${postulacion.vendedor.emprendimiento}.`,
    );
  });
}
