"use server";

import { redirect } from "next/navigation";
import type { Rol } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  ejecutarAccion,
  estadoDeError,
  estadoDesdeZod,
  type EstadoFormulario,
} from "@/lib/form";
import { generarSlugUnico } from "@/lib/slug";
import { clienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
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

    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validacion.data.email,
      password: validacion.data.password,
    });

    if (error || !data.user) {
      // Supabase no distingue "usuario inexistente" de "contraseña incorrecta",
      // y está bien que así sea: no filtra qué correos están registrados.
      return estadoDeError(
        "El correo electrónico o la contraseña no son correctos.",
      );
    }

    // El rol autoritativo es el del perfil, no el del token.
    const perfil = await prisma.usuario.findUnique({
      where: { id: data.user.id },
      select: { rol: true },
    });

    if (!perfil) {
      await supabase.auth.signOut();
      return estadoDeError(
        "Tu cuenta existe pero le falta el perfil de la plataforma. Comunicate con la Dirección de Ferias y Mercados.",
      );
    }

    const volverA = String(datos.get("volverA") ?? "");
    redirect(destinoSegunRol(perfil.rol, volverA));
  });
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
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

    const admin = clienteAdmin();

    // El rol va en `app_metadata` porque sólo se puede escribir con la service
    // role key: el usuario no puede ascenderse a sí mismo. El middleware lo lee
    // del JWT para filtrar en el Edge sin consultar la base.
    const { data: creado, error: errorAuth } = await admin.auth.admin.createUser(
      {
        email: entrada.email,
        password: entrada.password,
        // La verificación real la hace la Dirección de Ferias al aprobar la
        // solicitud, así que no exigimos confirmar el correo (evita depender
        // de un SMTP configurado). Ver el README para activarla.
        email_confirm: true,
        app_metadata: { rol: "VENDEDOR" },
        user_metadata: { nombre: entrada.nombre },
      },
    );

    if (errorAuth || !creado.user) {
      return estadoDeError(
        errorAuth?.message.includes("already registered")
          ? "Ya hay una cuenta registrada con ese correo electrónico."
          : "No pudimos crear la cuenta. Intentá de nuevo en unos minutos.",
      );
    }

    try {
      await prisma.usuario.create({
        data: {
          id: creado.user.id,
          email: entrada.email,
          nombre: entrada.nombre,
          rol: "VENDEDOR",
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
    } catch (error) {
      // El usuario quedó creado en Auth pero sin perfil: lo damos de baja para
      // no dejar una cuenta huérfana que impida volver a registrarse.
      await admin.auth.admin.deleteUser(creado.user.id);
      throw error;
    }

    // Iniciamos sesión para que vea el estado de su solicitud enseguida.
    const supabase = await crearClienteServidor();
    await supabase.auth.signInWithPassword({
      email: entrada.email,
      password: entrada.password,
    });

    redirect("/mi-stand");
  });
}
