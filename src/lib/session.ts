import { redirect } from "next/navigation";
import type { Rol, Vendedor } from "@prisma/client";

import { prisma } from "@/lib/db";
import { esControlDeFlujoDeNext } from "@/lib/errores";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Sesión de la aplicación.
 *
 * Combina la identidad que administra Supabase Auth (`auth.users`) con el
 * perfil de la aplicación (`public.usuarios`), que es la **fuente de verdad
 * del rol**.
 *
 * El rol también viaja duplicado en `app_metadata` del JWT para que el
 * middleware pueda filtrar en el Edge sin consultar la base. Si alguna vez
 * divergen, gana esta consulta: el middleware es la primera barrera, no la
 * última.
 */
export interface SesionApp {
  /** UUID compartido con `auth.users.id`. */
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

/**
 * Usuario autenticado según Supabase, sin consultar la base.
 *
 * Si el servicio de Auth no responde devolvemos `null` en lugar de propagar el
 * error: el market público no debería caerse porque Supabase esté intermitente.
 * Las rutas protegidas terminan redirigiendo al login, que es el
 * comportamiento seguro.
 */
export async function obtenerUsuarioAuth() {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    // `cookies()` lanza durante la compilación para marcar la ruta como
    // dinámica: eso no es una falla y tiene que seguir subiendo.
    if (esControlDeFlujoDeNext(error)) throw error;
    console.error("[auth] no se pudo verificar la sesión:", error);
    return null;
  }
}

/** Sesión completa, o `null` si no hay nadie autenticado. */
export async function obtenerSesion(): Promise<SesionApp | null> {
  const usuario = await obtenerUsuarioAuth();
  if (!usuario) return null;

  const perfil = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { id: true, email: true, nombre: true, rol: true },
  });

  // Sin perfil no hay sesión de aplicación válida, aunque exista en auth.users
  // (por ejemplo, si el registro se cortó a la mitad).
  if (!perfil) return null;

  return perfil;
}

/** Exige sesión iniciada. Redirige a `/ingresar` si no la hay. */
export async function requerirSesion(): Promise<SesionApp> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar");
  return sesion;
}

/** Exige rol ADMIN. Los feriantes van a su propio panel. */
export async function requerirAdmin(): Promise<SesionApp> {
  const sesion = await requerirSesion();
  if (sesion.rol !== "ADMIN") redirect("/mi-stand");
  return sesion;
}

/** Exige rol VENDEDOR. El personal municipal va al panel de administración. */
export async function requerirVendedor(): Promise<SesionApp> {
  const sesion = await requerirSesion();
  if (sesion.rol !== "VENDEDOR") redirect("/admin");
  return sesion;
}

/**
 * Perfil del feriante autenticado.
 *
 * Devuelve también el estado de aprobación, porque casi todas las pantallas de
 * `/mi-stand` cambian según esté PENDIENTE, APROBADO o RECHAZADO.
 */
export async function obtenerVendedorActual(): Promise<{
  sesion: SesionApp;
  vendedor: Vendedor;
}> {
  const sesion = await requerirVendedor();

  const vendedor = await prisma.vendedor.findUnique({
    where: { usuarioId: sesion.id },
  });

  if (!vendedor) {
    // Un usuario con rol VENDEDOR siempre debería tener perfil; si no lo tiene,
    // el registro quedó a medias y hay que rehacerlo.
    redirect("/registro?error=perfil-incompleto");
  }

  return { sesion, vendedor };
}

/**
 * Igual que `obtenerVendedorActual` pero además exige estar aprobado.
 * Las pantallas de catálogo y perfil no tienen sentido antes de la aprobación.
 */
export async function requerirVendedorAprobado(): Promise<{
  sesion: SesionApp;
  vendedor: Vendedor;
}> {
  const { sesion, vendedor } = await obtenerVendedorActual();
  if (vendedor.estado !== "APROBADO") redirect("/mi-stand");
  return { sesion, vendedor };
}
