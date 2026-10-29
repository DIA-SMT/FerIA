import { randomUUID } from "node:crypto";

import { abrirSesion } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import type { PersonaCidituc } from "@/lib/cidituc";

/**
 * De una identidad de CiDiTuc a una sesión de FerIA.
 *
 * Es la parte que el documento de la Dirección no puede cubrir, porque depende
 * de cómo autentica cada app. Lo que hay que evitar es terminar con dos
 * sistemas de sesión conviviendo: CiDiTuc no reemplaza al nuestro, sino que
 * prueba quién es la persona, y con eso se abre una sesión como cualquier otra.
 *
 * Hasta la mudanza el puente eran dos pasos contra Supabase: el servidor se
 * emitía a sí mismo un enlace mágico con `generateLink` y lo canjeaba en el
 * acto con `verifyOtp`, que era lo que escribía las cookies. Con sesiones
 * propias eso desaparece: probada la identidad, se emite el token y listo.
 *
 * **La identidad es el documento, no el correo.** El correo es apenas la clave
 * con la que se indexa la cuenta, y puede no ser el mismo que el feriante usó
 * al registrarse a mano. Por eso primero se busca la ficha por documento: si ya
 * tiene cuenta, se entra a esa cuenta y no se crea otra.
 */

/** El token de CiDiTuc ya cumplió: de acá en adelante manda el documento. */
export type MotivoVinculo = "sin-cuenta" | "sesion";

export type ResultadoVinculo =
  { ok: true; tieneFicha: boolean } | { ok: false; motivo: MotivoVinculo };

interface FichaMinima {
  id: string;
  usuarioId: string | null;
}

/**
 * Busca la ficha del feriante por documento.
 *
 * La comparación normaliza a dígitos de los dos lados porque el padrón
 * importado y el registro a mano guardan el DNI como vino escrito: «20.123.456»
 * y «20123456» son la misma persona y un `=` no los ve iguales.
 *
 * Si alguien tuviera dos fichas con el mismo documento —dos emprendimientos—
 * se engancha una sola, la que ya tenga cuenta o, si ninguna la tiene, la más
 * antigua. La otra la reasigna la Dirección a mano; es un caso raro y adivinar
 * sería peor.
 */
async function fichaPorDocumento(
  documento: string,
): Promise<FichaMinima | null> {
  const filas = await prisma.$queryRaw<FichaMinima[]>`
    SELECT id, "usuarioId"
    FROM vendedores
    WHERE regexp_replace(coalesce(dni, ''), '[^0-9]', '', 'g') = ${documento}
    ORDER BY ("usuarioId" IS NULL), "creadoEn" ASC
    LIMIT 1
  `;
  return filas[0] ?? null;
}

/**
 * Correo con el que se indexa la cuenta cuando CiDiTuc no trae uno.
 *
 * CiDiTuc exige un correo válido al registrarse, así que esto casi nunca pasa;
 * existe para que la ausencia del dato no deje a la persona afuera. No recibe
 * mensajes y no se usa para recuperar nada: quien entra por CiDiTuc, entra por
 * CiDiTuc.
 */
function correoDeRespaldo(documento: string): string {
  return `cidituc-${documento}@no-reply.smt.gob.ar`;
}

/**
 * Deja el documento verificado en una cuenta que ya existía.
 *
 * No es crítico: si falla, lo único que pasa es que la encuesta va a crear la
 * ficha sin DNI, igual que antes. Por eso no corta el ingreso —la persona se
 * autenticó bien y merece entrar— y sólo queda registrado en el log.
 */
async function completarDocumento(
  usuarioId: string,
  documento: string,
): Promise<void> {
  try {
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { documento },
    });
  } catch (causa) {
    console.error("[cidituc] no se pudo guardar el documento:", causa);
  }
}

/**
 * Encuentra o crea la cuenta de esta persona y le deja la sesión abierta.
 *
 * Devuelve si la persona tiene ficha de feriante. No tenerla no es un error:
 * puede ser alguien que todavía no se postuló, y en ese caso entra con cuenta
 * creada y `/mi-stand` lo manda a completar el alta.
 */
export async function vincularFeriante(
  persona: PersonaCidituc,
): Promise<ResultadoVinculo> {
  const ficha = await fichaPorDocumento(persona.documento);

  // Si la ficha ya está reclamada, la cuenta existe: se entra a esa y no se
  // crea una nueva aunque CiDiTuc traiga otro correo.
  if (ficha?.usuarioId) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: ficha.usuarioId },
      select: { id: true, rol: true },
    });

    if (usuario) {
      await completarDocumento(usuario.id, persona.documento);
      await abrirSesion(usuario.id, usuario.rol);
      return { ok: true, tieneFicha: true };
    }
  }

  const email = persona.email ?? correoDeRespaldo(persona.documento);
  const nombre = persona.nombre ?? "Feriante";

  const existente = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });

  let usuarioId = existente?.id ?? null;

  if (!usuarioId) {
    /*
      Cuenta sin contraseña: a ésta se entra por CiDiTuc y nada más.
      `passwordHash` queda nulo y el formulario de ingreso no la abre nunca.

      El documento se guarda acá porque la ficha todavía no existe: se crea
      recién cuando la persona completa la encuesta, y para entonces el token de
      CiDiTuc ya se consumió. Sin esto el DNI que CiDiTuc verificó se pierde, y
      es justo la clave con la que `fichaPorDocumento` reconoce a alguien que
      vuelve —aunque haya cambiado el correo en CiDiTuc— y con la que el padrón
      de Feria Digital engancha su ficha cuando se importe.
    */
    const creado = await prisma.usuario.create({
      select: { id: true },
      data: {
        id: randomUUID(),
        email,
        nombre,
        rol: "VENDEDOR",
        documento: persona.documento,
      },
    });

    usuarioId = creado.id;
  } else {
    // La cuenta ya existía: puede venir de antes de que guardáramos el
    // documento, o del registro a mano. Se completa ahora, que es el único
    // momento en que lo tenemos verificado.
    await completarDocumento(usuarioId, persona.documento);
  }

  // El enganche con el padrón: la ficha existía sin dueño y esta persona
  // acaba de probar, con el documento, que es suya.
  if (ficha && !ficha.usuarioId) {
    await prisma.vendedor.update({
      where: { id: ficha.id },
      data: { usuarioId },
    });
  }

  await abrirSesion(usuarioId, "VENDEDOR");

  return { ok: true, tieneFicha: ficha !== null };
}
