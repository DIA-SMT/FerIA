"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buscarFeriantes } from "@/lib/busqueda-feriantes";
import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDeExito,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import {
  esPropuestaNueva,
  imagenesDelCambio,
  leerDatos,
  proponerCambio,
} from "@/lib/revision";
import { requerirAdmin, requerirVendedorAprobado } from "@/lib/session";
import { almacenamiento, guardarImagenOpcional } from "@/lib/storage";
import { titularDe } from "@/lib/titular";
import {
  propuestaPropiaSchema,
  propuestaSelloPropioSchema,
} from "@/lib/validations/sello-propio";

/*
  «Modo Feria»: regalos y servicios con sello propio.

  Entran por dos lados. El feriante la carga desde Mi stand y pasa por la
  revisión, como un producto (ver `src/lib/revision.ts`): la nueva nace sin
  publicar, y los cambios a una publicada esperan mientras se sigue viendo la
  anterior. El equipo también la puede cargar desde el panel, para quien
  todavía no tiene cuenta: esa ya está revisada, y se publica con la casilla.
*/

/** Un feriante tal como lo ofrece el buscador del formulario del panel. */
export interface FerianteElegible {
  id: string;
  emprendimiento: string;
  responsable: string;
  ferias: string[];
}

/** Todo lo que muestra una propuesta o cuenta las que esperan revisión. */
function revalidarModoFeria(): void {
  revalidatePath("/");
  revalidatePath("/modo-feria", "layout");
  revalidatePath("/mi-stand/modo-feria");
  revalidatePath("/admin/modo-feria");
  revalidatePath("/admin/revisiones");
  // El contador de «Revisiones» del menú del panel.
  revalidatePath("/admin", "layout");
}

/** Las fotos de una propuesta y de sus cambios abiertos, para borrarlas con ella. */
async function fotosDe(propuestaId: string): Promise<string[]> {
  const propuesta = await prisma.propuestaSelloPropio.findUnique({
    where: { id: propuestaId },
    select: {
      imagen: true,
      cambios: { select: { seccion: true, datos: true } },
    },
  });
  if (!propuesta) return [];
  return [
    ...new Set([
      ...(propuesta.imagen ? [propuesta.imagen] : []),
      ...propuesta.cambios.flatMap((cambio) =>
        imagenesDelCambio(cambio.seccion, cambio.datos),
      ),
    ]),
  ];
}

async function eliminarConFotos(propuestaId: string): Promise<void> {
  const fotos = await fotosDe(propuestaId);
  // Los cambios abiertos se van en cascada (ver schema.prisma).
  await prisma.propuestaSelloPropio.delete({ where: { id: propuestaId } });
  await Promise.all(fotos.map((ruta) => almacenamiento.eliminar(ruta)));
}

// ---------------------------------------------------------------------------
// Desde el panel municipal
// ---------------------------------------------------------------------------

/**
 * El feriante tiene que estar aprobado: la tarjeta lleva a su stand y a su
 * WhatsApp, y una ficha sin aprobar no tiene ni lo uno ni lo otro en público.
 */
async function verificarFeriante(vendedorId: string): Promise<string | null> {
  const vendedor = await prisma.vendedor.findUnique({
    where: { id: vendedorId },
    select: { estado: true },
  });
  if (!vendedor) return "Ese feriante no existe.";
  if (vendedor.estado !== "APROBADO") {
    return "Ese feriante no está aprobado: su stand no es público y la propuesta no se vería.";
  }
  return null;
}

export async function crearPropuestaSelloPropio(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    await requerirAdmin();

    const validacion = propuestaSelloPropioSchema.safeParse(
      Object.fromEntries(datos),
    );
    if (!validacion.success) return estadoDesdeZod(validacion.error);
    const entrada = validacion.data;

    const problema = await verificarFeriante(entrada.vendedorId);
    if (problema) {
      return { ok: false, errores: { vendedorId: [problema] } };
    }

    const imagen = await guardarImagenOpcional(
      datos.get("imagen"),
      "sello-propio",
    );

    await prisma.propuestaSelloPropio.create({
      data: { ...entrada, imagen },
    });

    revalidarModoFeria();
    redirect("/admin/modo-feria");
  });
}

export async function actualizarPropuestaSelloPropio(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const sesion = await requerirAdmin();

    const propuestaId = String(datos.get("propuestaId") ?? "");
    const actual = propuestaId
      ? await prisma.propuestaSelloPropio.findUnique({
          where: { id: propuestaId },
          select: { imagen: true },
        })
      : null;
    if (!actual) return estadoDeError("La propuesta no existe.");

    const validacion = propuestaSelloPropioSchema.safeParse(
      Object.fromEntries(datos),
    );
    if (!validacion.success) return estadoDesdeZod(validacion.error);
    const entrada = validacion.data;

    const problema = await verificarFeriante(entrada.vendedorId);
    if (problema) {
      return { ok: false, errores: { vendedorId: [problema] } };
    }

    const imagenNueva = await guardarImagenOpcional(
      datos.get("imagen"),
      "sello-propio",
    );

    await prisma.$transaction([
      prisma.propuestaSelloPropio.update({
        where: { id: propuestaId },
        data: { ...entrada, ...(imagenNueva ? { imagen: imagenNueva } : {}) },
      }),
      // Publicarla desde acá es aprobar su alta: si el feriante la había
      // mandado a revisión, deja de esperar en «Revisiones».
      ...(entrada.publicada
        ? [
            prisma.cambioDelStand.updateMany({
              where: {
                propuestaId,
                estado: "PENDIENTE",
                datos: { equals: { nueva: true } },
              },
              data: {
                estado: "APROBADO",
                revisadoEn: new Date(),
                revisadoPorId: sesion.id,
              },
            }),
          ]
        : []),
    ]);

    // La foto anterior se borra recién con la propuesta ya guardada: si algo
    // falla en el medio, lo peor que queda es un archivo de más.
    if (imagenNueva && actual.imagen) {
      await almacenamiento.eliminar(actual.imagen);
    }

    revalidarModoFeria();
    return estadoDeExito("Propuesta guardada.");
  });
}

export async function eliminarPropuestaSelloPropio(
  datos: FormData,
): Promise<void> {
  await requerirAdmin();

  const propuestaId = String(datos.get("propuestaId") ?? "");
  if (propuestaId) await eliminarConFotos(propuestaId);

  revalidarModoFeria();
  redirect("/admin/modo-feria");
}

/**
 * El buscador del formulario del panel: los feriantes aprobados que coinciden
 * con lo escrito. Usa la misma búsqueda que «Feriantes» y Migue, así encuentra
 * con las mismas palabras («doña rosita», sin tildes, con un error de tipeo).
 */
export async function buscarFeriantesElegibles(
  texto: string,
): Promise<FerianteElegible[]> {
  await requerirAdmin();

  const ids = await buscarFeriantes(texto, 12);
  if (ids.length === 0) return [];

  const fichas = await prisma.vendedor.findMany({
    where: { id: { in: ids }, estado: "APROBADO" },
    select: {
      id: true,
      emprendimiento: true,
      nombreResponsable: true,
      email: true,
      usuario: { select: { nombre: true, email: true } },
      postulaciones: {
        where: { estado: "ACEPTADA" },
        select: { feria: { select: { nombre: true } } },
      },
    },
  });

  // `findMany` no respeta el orden del `in`: se vuelve al de la búsqueda.
  const porId = new Map(fichas.map((ficha) => [ficha.id, ficha]));
  return ids.flatMap((id) => {
    const ficha = porId.get(id);
    if (!ficha) return [];
    return [
      {
        id: ficha.id,
        emprendimiento: ficha.emprendimiento,
        responsable: titularDe(ficha).nombre,
        ferias: ficha.postulaciones.map(
          (postulacion) => postulacion.feria.nombre,
        ),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Desde Mi stand
// ---------------------------------------------------------------------------

export async function crearPropuestaPropia(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await requerirVendedorAprobado();

    const validacion = propuestaPropiaSchema.safeParse(
      Object.fromEntries(datos),
    );
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const imagen = await guardarImagenOpcional(
      datos.get("imagen"),
      "sello-propio",
    );

    const propuesta = await prisma.propuestaSelloPropio.create({
      data: {
        ...validacion.data,
        imagen,
        vendedorId: vendedor.id,
        publicada: false,
      },
      select: { id: true },
    });
    await proponerCambio({
      vendedorId: vendedor.id,
      seccion: "SELLO_PROPIO",
      propuestaId: propuesta.id,
      datos: { nueva: true },
    });

    revalidarModoFeria();
    redirect("/mi-stand/modo-feria?enviada=1");
  });
}

export async function actualizarPropuestaPropia(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const { vendedor } = await requerirVendedorAprobado();

    const propuestaId = String(datos.get("propuestaId") ?? "");
    const actual = propuestaId
      ? await prisma.propuestaSelloPropio.findUnique({
          where: { id: propuestaId },
          select: { vendedorId: true, imagen: true, publicada: true },
        })
      : null;
    if (!actual || actual.vendedorId !== vendedor.id) {
      return estadoDeError("La propuesta no existe o no es tuya.");
    }

    const validacion = propuestaPropiaSchema.safeParse(
      Object.fromEntries(datos),
    );
    if (!validacion.success) return estadoDesdeZod(validacion.error);
    const entrada = validacion.data;

    const imagenNueva = await guardarImagenOpcional(
      datos.get("imagen"),
      "sello-propio",
    );

    if (!actual.publicada) {
      // Todavía no la ve nadie: se corrige en su lugar y vuelve a la cola de
      // revisión (si la habían rechazado, ahora espera de nuevo).
      await prisma.propuestaSelloPropio.update({
        where: { id: propuestaId },
        data: { ...entrada, ...(imagenNueva ? { imagen: imagenNueva } : {}) },
      });
      if (imagenNueva && actual.imagen) {
        await almacenamiento.eliminar(actual.imagen);
      }
      await proponerCambio({
        vendedorId: vendedor.id,
        seccion: "SELLO_PROPIO",
        propuestaId,
        datos: { nueva: true },
      });
    } else {
      // Publicada: el cambio espera revisión y mientras tanto se sigue viendo
      // la de antes. La foto que el feriante tiene en pantalla es la de su
      // propuesta pendiente, si hay una, y si no subió otra se conserva esa.
      const pendiente = await prisma.cambioDelStand.findFirst({
        where: { propuestaId, seccion: "SELLO_PROPIO", estado: "PENDIENTE" },
        select: { datos: true },
      });
      const enEspera = pendiente
        ? leerDatos("SELLO_PROPIO", pendiente.datos)
        : null;
      const imagenEnPantalla =
        enEspera && !esPropuestaNueva(enEspera)
          ? enEspera.imagen
          : actual.imagen;

      await proponerCambio({
        vendedorId: vendedor.id,
        seccion: "SELLO_PROPIO",
        propuestaId,
        datos: {
          modalidad: entrada.modalidad,
          titulo: entrada.titulo,
          descripcion: entrada.descripcion,
          imagen: imagenNueva ?? imagenEnPantalla,
          precio: entrada.precio,
          precioUnidad: entrada.precioUnidad,
          minimo: entrada.minimo,
          capacidad: entrada.capacidad,
          anticipacion: entrada.anticipacion,
        },
      });
    }

    revalidarModoFeria();
    redirect("/mi-stand/modo-feria?enviada=1");
  });
}

/** Eliminar es inmediato, como con un producto: sólo saca algo de la vista. */
export async function eliminarPropuestaPropia(datos: FormData): Promise<void> {
  const { vendedor } = await requerirVendedorAprobado();

  const propuestaId = String(datos.get("propuestaId") ?? "");
  const propuesta = propuestaId
    ? await prisma.propuestaSelloPropio.findUnique({
        where: { id: propuestaId },
        select: { vendedorId: true },
      })
    : null;
  if (propuesta?.vendedorId === vendedor.id) {
    await eliminarConFotos(propuestaId);
  }

  revalidarModoFeria();
  redirect("/mi-stand/modo-feria");
}
