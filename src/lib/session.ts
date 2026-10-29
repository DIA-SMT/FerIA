import { redirect } from "next/navigation";
import type { Rol, Vendedor } from "@prisma/client";

import { leerCredencial, tokenSigueValiendo } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { esControlDeFlujoDeNext } from "@/lib/errores";

/**
 * Sesión de la aplicación.
 *
 * Combina la identidad que viaja en el token con el perfil de `public.usuarios`,
 * que es la **fuente de verdad del rol**.
 *
 * El rol también viaja en el token para que el middleware pueda filtrar sin
 * consultar la base. Si alguna vez divergen, gana esta consulta: el middleware
 * es la primera barrera, no la última. Ver docs/autenticacion.md.
 */
export interface SesionApp {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

/**
 * Sesión completa, o `null` si no hay nadie autenticado.
 *
 * Verifica tres cosas, y las tres hacen falta:
 *
 *  1. Que el token esté bien firmado y no haya vencido.
 *  2. Que la cuenta siga existiendo. Sin perfil no hay sesión válida, aunque el
 *     token sea impecable: puede ser una cuenta borrada, o un registro que se
 *     cortó a la mitad.
 *  3. Que el token sea posterior a la última invalidación de esa cuenta. Es la
 *     revocación, porque un JWT emitido no se puede retirar de circulación.
 */
export async function obtenerSesion(): Promise<SesionApp | null> {
  let credencial;

  try {
    credencial = await leerCredencial();
  } catch (error) {
    // `cookies()` lanza durante la compilación para marcar la ruta como
    // dinámica: eso no es una falla y tiene que seguir subiendo.
    if (esControlDeFlujoDeNext(error)) throw error;
    console.error("[auth] no se pudo leer la sesión:", error);
    return null;
  }

  if (!credencial) return null;

  const perfil = await prisma.usuario.findUnique({
    where: { id: credencial.usuarioId },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      sesionesValidasDesde: true,
    },
  });

  if (!perfil) return null;
  if (!tokenSigueValiendo(credencial, perfil.sesionesValidasDesde)) return null;

  const { sesionesValidasDesde: _invalidadas, ...sesion } = perfil;
  return sesion;
}

/**
 * El documento que CiDiTuc verificó para esta cuenta, si entró por ahí.
 *
 * Devuelve `null` para quien entró con correo y contraseña: ahí nadie verificó
 * nada contra el padrón municipal, y un DNI escrito a mano no es lo mismo que
 * uno validado. Preferible una ficha sin DNI que una con un DNI que dice tener
 * un respaldo que no tiene.
 */
export async function documentoVerificado(): Promise<string | null> {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: sesion.id },
    select: { documento: true },
  });

  const valor = usuario?.documento;
  return valor && /^\d{6,11}$/.test(valor) ? valor : null;
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
    // Dejó de ser un caso raro y pasó a ser el camino normal: quien entra por
    // CiDiTuc por primera vez tiene cuenta y no tiene ficha, así que lo que
    // falta no es rehacer un registro a medias sino completar la encuesta.
    redirect("/encuesta");
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
