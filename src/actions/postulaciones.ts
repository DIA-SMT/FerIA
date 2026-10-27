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
  retirarmeSchema,
} from "@/lib/validations/postulacion";

/**
 * El circuito de alta y de ferias presenciales.
 *
 * Son **dos permisos distintos** y antes estaban pegados en uno:
 *
 * 1. **Ser feriante** (`Vendedor.estado`). Lo pide la encuesta y lo resuelve la
 *    Dirección. Aprobarlo habilita el stand virtual: la vidriera y el catálogo.
 * 2. **Estar en una feria presencial** (`Postulacion.estado`). Lo pide el
 *    feriante desde su panel, una vez que ya tiene stand virtual, y lo resuelve
 *    la Dirección feria por feria. Es opcional: se puede ser feriante del
 *    municipio y no ir a ninguna plaza.
 *
 * Antes la encuesta obligaba a elegir una feria para poder existir, así que
 * quien sólo quería su vidriera tenía que pedir un lugar físico que no pensaba
 * usar; y aceptar una postulación aprobaba la ficha de rebote, con lo cual las
 * dos decisiones se tomaban con un solo click y la Dirección no podía decir
 * «sí, es feriante» sin decir también «sí, va a esta plaza».
 *
 * Aceptar una postulación tampoco reserva un puesto: el número de stand se
 * asigna después, por `Stand`, al armar el mapa de cada edición.
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
 * La encuesta de alta: crea la ficha del emprendimiento.
 *
 * Es el reemplazo del registro para los feriantes. No pide ni correo ni
 * contraseña porque quien llega acá ya está autenticado —por CiDiTuc, que
 * además ya verificó su documento—, así que la cuenta existe y lo único que
 * falta es de qué es su emprendimiento.
 *
 * La feria es opcional y, si viene, queda **encolada**: la postulación se crea
 * `PENDIENTE` junto con la ficha, pero la bandeja del panel no la muestra como
 * pedido de feria hasta que el alta esté aprobada. Así el feriante dice todo de
 * una vez y no tiene que volver a entrar, y la Dirección igual resuelve las dos
 * cosas por separado y en orden.
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

    const feria = entrada.feriaId
      ? await prisma.feria.findFirst({
          where: { id: entrada.feriaId, activa: true },
          select: { id: true, nombre: true },
        })
      : null;

    if (entrada.feriaId && !feria) {
      return estadoDeError("Esa feria ya no está disponible.");
    }

    const existente = await prisma.vendedor.findUnique({
      where: { usuarioId: sesion.id },
      select: { id: true },
    });

    if (existente) {
      // Ya tiene ficha. `/encuesta` manda a /mi-stand en ese caso, así que acá
      // sólo se llega por una carrera —dos pestañas abiertas, el botón tocado
      // dos veces—. Si eligió feria se trata como una postulación más; si no,
      // no hay nada que crear.
      if (!feria) redirect("/mi-stand");
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
        // aprueba el alta: nadie aparece en la vidriera por haber completado un
        // formulario.
        estado: "PENDIENTE",
        ...(feria
          ? {
              postulaciones: {
                create: { feriaId: feria.id, mensaje: entrada.mensaje },
              },
            }
          : {}),
      },
    });

    revalidarPostulaciones();
    redirect("/mi-stand?postulacion=enviada");
  });
}

/**
 * Pedir estar en una feria presencial, con el stand virtual ya habilitado.
 *
 * Exige la ficha aprobada y no sólo existente: pedir un lugar físico es el
 * segundo permiso, y el primero es ser feriante. Mientras el alta esté en
 * revisión no hay nada que pedir, y dejar entrar un pedido antes pondría a la
 * Dirección a decidir sobre una plaza para alguien que todavía no aprobó.
 */
export async function postularme(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const sesion = await requerirVendedor();
    const entrada = postulacionSchema.parse(Object.fromEntries(datos));

    const vendedor = await prisma.vendedor.findUnique({
      where: { usuarioId: sesion.id },
      select: { id: true, estado: true },
    });
    if (!vendedor) return estadoDeError("Todavía no completaste tu ficha.");
    if (vendedor.estado !== "APROBADO") {
      return estadoDeError(
        "Tu alta todavía está en revisión. Cuando la aprueben vas a poder pedir ferias.",
      );
    }

    const feria = await prisma.feria.findFirst({
      where: { id: entrada.feriaId, activa: true },
      select: { id: true },
    });
    if (!feria) return estadoDeError("Esa feria ya no está disponible.");

    return postularAFeria(vendedor.id, feria.id, entrada.mensaje);
  });
}

/**
 * Crea o reabre el pedido de un feriante para una feria.
 *
 * Reabre en vez de acumular: el índice único es (vendedor, feria), así que
 * quien fue rechazado —o quien se bajó y se quiere volver a anotar— actualiza
 * la misma fila. Dos filas contando la misma historia obligarían al panel a
 * decidir cuál mirar.
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
    return estadoDeError("Ya tenés un pedido para esa feria esperando respuesta.");
  }
  if (previa?.estado === "ACEPTADA") {
    return estadoDeError("Ya estás habilitado en esa feria.");
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
  return estadoDeExito("Enviamos tu pedido. Te avisamos cuando lo revisen.");
}

/**
 * El feriante se baja de una feria presencial.
 *
 * **No libera el puesto.** Si la Dirección ya le asignó un stand en una edición
 * que todavía no pasó, ese stand sigue ahí y la bandeja del panel lo muestra
 * marcado para que lo liberen al revisar el mapa. Es deliberado: un click del
 * feriante no tiene que modificar un mapa que la Dirección ya armó y publicó, y
 * sobre todo no tiene que hacerlo sin que nadie se entere.
 *
 * No toca `revisadoEn`, que es cuándo lo revisó la Dirección. Cuándo se bajó
 * queda en `actualizadoEn`: meter las dos cosas en la misma columna borraría
 * quién tomó la última decisión.
 */
export async function retirarmeDeFeria(datos: FormData): Promise<void> {
  const sesion = await requerirVendedor();

  const entrada = retirarmeSchema.safeParse(Object.fromEntries(datos));
  if (!entrada.success) return;

  const vendedor = await prisma.vendedor.findUnique({
    where: { usuarioId: sesion.id },
    select: { id: true },
  });
  if (!vendedor) return;

  const postulacion = await prisma.postulacion.findUnique({
    where: { id: entrada.data.postulacionId },
    select: { id: true, estado: true, vendedorId: true, feria: { select: { slug: true } } },
  });

  // El filtro por `vendedorId` evita que alguien baje a otro de una feria.
  // Las salidas silenciosas son todas carreras —doble click, pestaña vieja— y
  // el resultado se ve en la pantalla: la feria pasa a «Se bajó».
  if (!postulacion || postulacion.vendedorId !== vendedor.id) return;
  if (postulacion.estado !== "PENDIENTE" && postulacion.estado !== "ACEPTADA") {
    return;
  }

  await prisma.postulacion.update({
    where: { id: postulacion.id },
    data: { estado: "RETIRADA" },
  });

  revalidarPostulaciones();
  revalidatePath(`/ferias/${postulacion.feria.slug}`);
}

/**
 * La Dirección habilita o rechaza a un feriante en una feria presencial.
 *
 * **Ya no aprueba la ficha de rebote.** Antes lo hacía: aceptar una postulación
 * ponía el `Vendedor` en APROBADO si estaba pendiente, con lo cual las dos
 * decisiones —«es feriante» y «va a esta plaza»— se tomaban con un solo click y
 * no había forma de dar una sin la otra. Ahora el alta se resuelve antes, en su
 * propia sección de la bandeja, y acá se da por hecha: de ahí el guard.
 *
 * Lo que sigue sin hacer es asignarle un stand. Eso es logística de cada
 * edición y se resuelve en /admin/ediciones, para no obligar a tener el mapa
 * resuelto antes de poder contestar.
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

    if (!postulacion) return estadoDeError("Ese pedido no existe.");
    if (postulacion.estado === "RETIRADA") {
      return estadoDeError(
        `${postulacion.vendedor.emprendimiento} se bajó de esa feria por su cuenta.`,
      );
    }
    if (postulacion.estado !== "PENDIENTE") {
      return estadoDeError("Ese pedido ya fue resuelto.");
    }

    // El alta es el primer permiso y se resuelve aparte. La bandeja no muestra
    // pedidos de feria de una ficha sin aprobar, así que acá sólo se llega con
    // una pantalla vieja abierta.
    if (postulacion.vendedor.estado !== "APROBADO") {
      return estadoDeError(
        `Primero hay que aprobar el alta de ${postulacion.vendedor.emprendimiento}, en «Altas esperando respuesta».`,
      );
    }

    const acepta = entrada.decision === "ACEPTADA";

    await prisma.postulacion.update({
      where: { id: postulacion.id },
      data: {
        estado: entrada.decision,
        motivoRechazo: acepta ? null : entrada.motivoRechazo,
        revisadoEn: new Date(),
      },
    });

    revalidarPostulaciones();
    revalidatePath("/stands");
    revalidatePath(`/stands/${postulacion.vendedor.slug}`);
    revalidatePath(`/ferias/${postulacion.feria.slug}`);

    return estadoDeExito(
      acepta
        ? `${postulacion.vendedor.emprendimiento} quedó habilitado en ${postulacion.feria.nombre}. Falta asignarle un stand en la edición que corresponda.`
        : `Se rechazó el pedido de ${postulacion.vendedor.emprendimiento} para ${postulacion.feria.nombre}.`,
    );
  });
}
