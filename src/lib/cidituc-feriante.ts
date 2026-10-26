import { prisma } from "@/lib/db";
import type { PersonaCidituc } from "@/lib/cidituc";
import { clienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * De una identidad de CiDiTuc a una sesión de FerIA.
 *
 * Es la parte que el documento de la Dirección no puede cubrir, porque depende
 * de cómo autentica cada app. Acá las sesiones las administra Supabase Auth, y
 * lo que hay que evitar es terminar con dos sistemas de sesión conviviendo: el
 * middleware, el rol en el JWT y `obtenerVendedorActual()` ya funcionan sobre
 * Supabase. Así que CiDiTuc no reemplaza a Supabase: prueba quién es la
 * persona, y con eso se abre una sesión de Supabase como siempre.
 *
 * El puente es `generateLink` + `verifyOtp`, que es la forma estándar de
 * federar una identidad externa: el servidor se emite a sí mismo un enlace
 * mágico y lo canjea en el acto, sin que nadie reciba un correo.
 *
 * **La identidad es el documento, no el correo.** El correo es apenas la clave
 * con la que Supabase indexa la cuenta, y puede no ser el mismo que el
 * feriante usó al registrarse a mano. Por eso primero se busca la ficha por
 * documento: si ya tiene cuenta, se entra a esa cuenta y no se crea otra.
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
 * Abre la sesión de Supabase sin contraseña.
 *
 * `generateLink` no manda ningún correo: devuelve el token ya hasheado y acá
 * mismo se canjea con `verifyOtp`, que es lo que escribe las cookies de sesión.
 */
async function abrirSesion(email: string): Promise<boolean> {
  const admin = clienteAdmin();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const hash = data?.properties?.hashed_token;
  if (error || !hash) {
    console.error("[cidituc] no se pudo emitir el enlace:", error?.message);
    return false;
  }

  const supabase = await crearClienteServidor();
  const { error: errorCanje } = await supabase.auth.verifyOtp({
    token_hash: hash,
    type: "email",
  });

  if (errorCanje) {
    console.error("[cidituc] no se pudo abrir la sesión:", errorCanje.message);
    return false;
  }

  return true;
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
      select: { email: true },
    });

    if (usuario) {
      const abierta = await abrirSesion(usuario.email);
      return abierta
        ? { ok: true, tieneFicha: true }
        : { ok: false, motivo: "sesion" };
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
    const admin = clienteAdmin();

    // Sin contraseña: esta cuenta se abre por CiDiTuc. El rol va en
    // `app_metadata` porque sólo se escribe con la service role key —el
    // usuario no puede ascenderse a sí mismo— y el middleware lo lee del JWT.
    const { data: creado, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { rol: "VENDEDOR" },
      user_metadata: { nombre, cidituc: persona.id },
    });

    if (error || !creado.user) {
      console.error("[cidituc] no se pudo crear la cuenta:", error?.message);
      return { ok: false, motivo: "sin-cuenta" };
    }

    usuarioId = creado.user.id;

    try {
      await prisma.usuario.create({
        data: { id: usuarioId, email, nombre, rol: "VENDEDOR" },
      });
    } catch (causa) {
      // Igual que en el registro a mano: una cuenta en Auth sin perfil en la
      // base impediría volver a entrar, así que se deshace.
      await admin.auth.admin.deleteUser(usuarioId);
      throw causa;
    }
  }

  // El enganche con el padrón: la ficha existía sin dueño y esta persona
  // acaba de probar, con el documento, que es suya.
  if (ficha && !ficha.usuarioId) {
    await prisma.vendedor.update({
      where: { id: ficha.id },
      data: { usuarioId },
    });
  }

  const abierta = await abrirSesion(email);
  if (!abierta) return { ok: false, motivo: "sesion" };

  return { ok: true, tieneFicha: ficha !== null };
}
