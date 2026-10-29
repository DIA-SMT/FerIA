/**
 * Trae las credenciales de Supabase Auth a nuestra propia tabla.
 *
 *   npm run db:migrar-credenciales          # dice qué haría
 *   npm run db:migrar-credenciales -- --si  # lo hace
 *
 * Copia dos cosas de `auth.users` a `public.usuarios`, emparejando por `id`:
 *
 *   · `encrypted_password` → `passwordHash`. Son bcrypt estándar (`$2a$10$`),
 *     así que **nadie tiene que cambiar su contraseña**. Ese fue el motivo de
 *     seguir usando bcrypt y no algo más moderno.
 *   · `raw_user_meta_data->>'documento'` → `documento`. Es el DNI que CiDiTuc
 *     verificó, que vivía en el metadata de la cuenta.
 *
 * **Corre contra la base que tenga el esquema `auth`**, o sea la de Supabase.
 * Ahí están las contraseñas; en un Postgres propio ese esquema no existe. En la
 * VPS los datos llegan con el volcado del corte, no con este script.
 *
 * Es idempotente: una fila que ya tenga `passwordHash` no se vuelve a tocar, así
 * que se puede correr de nuevo sin pisar una contraseña cambiada después.
 *
 * Ver docs/autenticacion.md.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APLICAR = process.argv.includes("--si");

interface FilaDeAuth {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  documento: string | null;
}

/** ¿Esta base tiene el esquema `auth`? Si no, el script no tiene de dónde leer. */
async function hayEsquemaAuth(): Promise<boolean> {
  const filas = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'
    ) AS existe
  `;
  return filas[0]?.existe === true;
}

async function main(): Promise<void> {
  if (!(await hayEsquemaAuth())) {
    throw new Error(
      "Esta base no tiene el esquema `auth`, así que no hay credenciales que traer. " +
        "Este script corre contra la base de Supabase; a la VPS los datos llegan con el volcado.",
    );
  }

  const deAuth = await prisma.$queryRaw<FilaDeAuth[]>`
    SELECT id::text,
           email,
           encrypted_password,
           raw_user_meta_data->>'documento' AS documento
    FROM auth.users
  `;

  const perfiles = await prisma.usuario.findMany({
    select: { id: true, email: true, passwordHash: true, documento: true },
  });
  const porId = new Map(perfiles.map((p) => [p.id, p]));

  const aEscribir: { id: string; email: string; password: boolean; documento: boolean }[] = [];
  let sinPerfil = 0;
  let yaEstaban = 0;

  for (const fila of deAuth) {
    const perfil = porId.get(fila.id);

    if (!perfil) {
      // Una cuenta en Auth sin perfil en la aplicación. No se inventa el
      // perfil: puede ser un registro que se cortó a la mitad, y crearlo acá
      // sería adivinar nombre y rol.
      sinPerfil++;
      continue;
    }

    const password = Boolean(fila.encrypted_password) && !perfil.passwordHash;
    const documento = Boolean(fila.documento) && !perfil.documento;

    if (!password && !documento) {
      yaEstaban++;
      continue;
    }

    aEscribir.push({ id: fila.id, email: perfil.email, password, documento });
  }

  console.log();
  console.log(`Cuentas en auth.users:        ${deAuth.length}`);
  console.log(`Perfiles en public.usuarios:  ${perfiles.length}`);
  console.log(`Sin nada que copiar:          ${yaEstaban}`);
  console.log(`Sin perfil (se saltean):      ${sinPerfil}`);
  console.log(`A completar:                  ${aEscribir.length}`);
  console.log();

  for (const u of aEscribir) {
    const que = [u.password && "contraseña", u.documento && "documento"]
      .filter(Boolean)
      .join(" + ");
    console.log(`  ${u.email.padEnd(42)} ${que}`);
  }

  // Las cuentas sin contraseña no son un error: son las de CiDiTuc, que entran
  // sin elegir una. Conviene verlas igual para no confundirlas con una falla.
  const sinPassword = deAuth.filter((f) => !f.encrypted_password).length;
  if (sinPassword > 0) {
    console.log();
    console.log(
      `(${sinPassword} cuentas no tienen contraseña en Supabase: son las que entran por CiDiTuc.)`,
    );
  }

  if (!APLICAR) {
    console.log();
    console.log("Simulación: no se escribió nada. Agregá --si para aplicar.");
    return;
  }

  let escritas = 0;
  for (const fila of deAuth) {
    const pendiente = aEscribir.find((u) => u.id === fila.id);
    if (!pendiente) continue;

    await prisma.usuario.update({
      where: { id: fila.id },
      data: {
        ...(pendiente.password ? { passwordHash: fila.encrypted_password } : {}),
        ...(pendiente.documento ? { documento: fila.documento } : {}),
      },
    });
    escritas++;
  }

  console.log();
  console.log(`✓ Listo. ${escritas} cuentas completadas.`);
  console.log("  Nadie tiene que cambiar su contraseña.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
