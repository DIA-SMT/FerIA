/**
 * Cambia la contraseña de una cuenta.
 *
 *   npm run db:clave -- correo@ejemplo.com         # dice qué haría
 *   npm run db:clave -- correo@ejemplo.com --si    # la cambia
 *
 * Existe porque la plataforma **no tiene recuperación de contraseña**. Nunca la
 * tuvo del lado de la aplicación: la resolvía Supabase mandando un correo, y al
 * mudar la autenticación a credenciales propias eso se fue con él. Mientras no
 * haya un flujo de "olvidé mi contraseña" —que necesita un SMTP y una decisión
 * sobre quién puede pedirlo—, éste es el único camino de vuelta, y pasa por
 * alguien con acceso al servidor.
 *
 * LA CONTRASEÑA SALE DEL ENTORNO, NUNCA DE UN ARGUMENTO, igual que en
 * `crear-admin.ts`: en la línea de comandos quedaría en el historial del shell
 * y en la lista de procesos, donde la ve cualquiera que corra `ps`.
 *
 * La forma recomendada de pasarla, que no deja rastro en el historial:
 *
 *   read -s PASSWORD_NUEVA && export PASSWORD_NUEVA
 *   npm run db:clave -- correo@ejemplo.com --si
 *   unset PASSWORD_NUEVA
 *
 * Cambiar la contraseña **cierra todas las sesiones abiertas de esa cuenta**,
 * moviendo `sesionesValidasDesde`. Es lo correcto: si se cambia porque alguien
 * más la sabía, dejar sus sesiones vivas no arregla nada.
 *
 * El script es autocontenido a propósito, como el seed: no importa nada de
 * `src/`, así corre bajo `tsx` sin depender de los alias de TypeScript.
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** El mismo costo que usa la aplicación, y el que traían los hash heredados. */
const COSTO = 10;
const LARGO_MINIMO = 8;

async function main(): Promise<void> {
  const argumentos = process.argv.slice(2);
  const aplicar = argumentos.includes("--si");
  const email = argumentos.find((a) => !a.startsWith("--"))?.toLowerCase();

  if (!email) {
    throw new Error(
      "Falta el correo.\n\n" +
        "  npm run db:clave -- correo@ejemplo.com         (simulación)\n" +
        "  npm run db:clave -- correo@ejemplo.com --si    (la cambia)",
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      passwordHash: true,
    },
  });

  if (!usuario) {
    throw new Error(`No hay ninguna cuenta con el correo ${email}.`);
  }

  console.log();
  console.log(`Cuenta:   ${usuario.nombre} <${usuario.email}>`);
  console.log(`Rol:      ${usuario.rol}`);
  console.log(
    `Hoy:      ${usuario.passwordHash ? "tiene contraseña" : "SIN contraseña (entra sólo por CiDiTuc)"}`,
  );

  if (!aplicar) {
    console.log();
    console.log("Simulación: no se escribió nada.");
    console.log("Para cambiarla, sin dejarla en el historial del shell:");
    console.log();
    console.log("  read -s PASSWORD_NUEVA && export PASSWORD_NUEVA");
    console.log(`  npm run db:clave -- ${email} --si`);
    console.log("  unset PASSWORD_NUEVA");
    return;
  }

  const nueva = process.env["PASSWORD_NUEVA"];

  if (!nueva) {
    throw new Error(
      "Falta PASSWORD_NUEVA.\n\n" +
        "  read -s PASSWORD_NUEVA && export PASSWORD_NUEVA\n" +
        `  npm run db:clave -- ${email} --si\n` +
        "  unset PASSWORD_NUEVA",
    );
  }

  if (nueva.length < LARGO_MINIMO) {
    throw new Error(
      `PASSWORD_NUEVA tiene que tener al menos ${LARGO_MINIMO} caracteres.`,
    );
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash: await bcrypt.hash(nueva, COSTO),
      // Se trunca al segundo porque el `iat` de un JWT se mide en segundos
      // enteros. Ver `instanteDeInvalidacion` en src/lib/auth/sesion.ts.
      sesionesValidasDesde: new Date(Math.floor(Date.now() / 1000) * 1000),
    },
  });

  console.log();
  console.log(`✓ Listo. ${usuario.email} ya puede entrar con la contraseña nueva.`);
  console.log("  Las sesiones que tuviera abiertas se cerraron.");
  console.log("  Acordate de hacer `unset PASSWORD_NUEVA`.");
}

main()
  .catch((error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
