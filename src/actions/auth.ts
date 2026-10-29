"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import type { Rol } from "@prisma/client";

import { hashearPassword, verificarPassword } from "@/lib/auth/password";
import { abrirSesion, cerrarSesionCookie } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { generarSlugUnico } from "@/lib/slug";
import { credencialesSchema } from "@/lib/validations/auth";
import { registroVendedorSchema } from "@/lib/validations/vendedor";

/** Destino según el rol, respetando el `volverA` del middleware si es coherente. */
function destinoSegunRol(rol: Rol, volverA: string): string {
  const panel = rol === "ADMIN" ? "/admin" : "/mi-stand";

  // Sólo aceptamos rutas internas del panel que le corresponde al rol:
  // así un `volverA` manipulado no puede usarse como redirección abierta.
  if (volverA.startsWith(panel)) return volverA;
  return panel;
}

export async function iniciarSesion(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const validacion = credencialesSchema.safeParse({
      email: datos.get("email"),
      password: datos.get("password"),
    });

    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const usuario = await prisma.usuario.findUnique({
      where: { email: validacion.data.email },
      select: { id: true, rol: true, passwordHash: true },
    });

    // `verificarPassword` se llama **siempre**, exista o no la cuenta: con
    // `null` corre igual un bcrypt contra un hash de descarte. Si se saliera
    // antes, el tiempo de respuesta diría qué correos están registrados.
    const correcta = await verificarPassword(
      validacion.data.password,
      usuario?.passwordHash,
    );

    if (!usuario || !correcta) {
      // El mensaje no distingue "no existe" de "contraseña incorrecta", y está
      // bien que así sea: no filtra qué correos están registrados.
      return estadoDeError(
        "El correo electrónico o la contraseña no son correctos.",
      );
    }

    await abrirSesion(usuario.id, usuario.rol);

    const volverA = String(datos.get("volverA") ?? "");
    redirect(destinoSegunRol(usuario.rol, volverA));
  });
}

export async function cerrarSesion(): Promise<void> {
  await cerrarSesionCookie();
  redirect("/");
}

export async function registrarFeriante(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarAccion(async () => {
    const validacion = registroVendedorSchema.safeParse(
      Object.fromEntries(datos),
    );
    if (!validacion.success) return estadoDesdeZod(validacion.error);

    const entrada = validacion.data;

    const yaExiste = await prisma.usuario.findUnique({
      where: { email: entrada.email },
      select: { id: true },
    });

    if (yaExiste) {
      return {
        ok: false,
        mensaje: "Ya hay una cuenta registrada con ese correo electrónico.",
        errores: { email: ["Ese correo ya está registrado."] },
      };
    }

    const slug = await generarSlugUnico(
      entrada.emprendimiento,
      async (candidato) =>
        (await prisma.vendedor.count({ where: { slug: candidato } })) > 0,
    );

    /*
      Acá antes había dos sistemas que podían desincronizarse: se creaba la
      cuenta en Supabase Auth, después el perfil en nuestra base, y si lo
      segundo fallaba había que borrar lo primero a mano para no dejar una
      cuenta huérfana que impidiera volver a registrarse.

      Con las credenciales en la misma base eso es una sola escritura. No hay
      caso intermedio que limpiar, porque no hay dos lugares.
    */
    const creado = await prisma.usuario.create({
      select: { id: true, rol: true },
      data: {
        // El id lo generamos nosotros desde que no lo asigna Supabase. Sigue
        // siendo un UUID: es lo que esperan las relaciones que ya existen.
        id: randomUUID(),
        email: entrada.email,
        nombre: entrada.nombre,
        rol: "VENDEDOR",
        passwordHash: await hashearPassword(entrada.password),
        vendedor: {
          create: {
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
            dni: entrada.dni,
            direccion: entrada.direccion,
            estado: "PENDIENTE",
          },
        },
      },
    });

    // Lo dejamos adentro para que vea el estado de su solicitud enseguida.
    await abrirSesion(creado.id, creado.rol);

    redirect("/mi-stand");
  });
}
