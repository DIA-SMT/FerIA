/**
 * Fija la contraseña de las cuentas de ejemplo del panel de accesos rápidos.
 *
 *   npm run db:clave-demo            (muestra qué haría, sin tocar nada)
 *   npm run db:clave-demo -- --si    (la aplica)
 *
 * Existe porque el panel de `/ingresar` volvió a estar disponible pero necesita
 * que `SEED_PASSWORD_ADMIN` y `SEED_PASSWORD_FERIANTE` sean las contraseñas que
 * esas cuentas tienen **de verdad**, y la única forma de garantizarlo sin
 * acordarse de las viejas es fijarlas de nuevo.
 *
 * La alternativa obvia —`npm run db:seed`— no sirve: el seed borra toda la base
 * antes de correr, y acá adentro están las ferias, el padrón importado y las
 * postulaciones. Esto toca cuatro contraseñas y nada más.
 *
 * Viene bien de paso: las contraseñas originales de estas cuentas estuvieron
 * escritas en el código y en una tabla del README de un repositorio público
 * hasta `812fd58`. Sacarlas del README no las borró del historial de git, así
 * que mientras no se cambien siguen siendo públicas. Esto las cambia.
 *
 * LAS CONTRASEÑAS SALEN DEL ENTORNO, NUNCA DE UN ARGUMENTO: en la línea de
 * comandos quedarían en el historial del shell y en la lista de procesos. Son
 * las mismas dos variables que lee `src/lib/accesos-demo.ts`, así que lo que se
 * fija acá y lo que muestra el panel no se pueden desincronizar.
 *
 * El script es autocontenido a propósito, como el seed: no importa nada de
 * `src/`, así corre bajo `tsx` sin depender de los alias de TypeScript.
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** El mismo costo que usa la aplicación. Ver src/lib/auth/password.ts. */
const COSTO_BCRYPT = 10;

/**
 * La lista está escrita acá y no se arma desde la base a propósito.
 *
 * Un script que cambia contraseñas no tiene que poder apuntarle a una cuenta
 * que no esté en esta lista, ni por un argumento ni por una consulta que
 * devuelva de más. Son exactamente las cuatro que muestra el panel.
 */
const CUENTAS = [
  { email: "admin@smt.gob.ar", variable: "SEED_PASSWORD_ADMIN" },
  { email: "tejidosdelcerro@example.com", variable: "SEED_PASSWORD_FERIANTE" },
  { email: "telarandino@example.com", variable: "SEED_PASSWORD_FERIANTE" },
  { email: "importadoslh@example.com", variable: "SEED_PASSWORD_FERIANTE" },
] as const;

function leerPassword(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    console.error(
      `\n✗ Falta ${nombre}.\n` +
        "  SEED_PASSWORD_ADMIN y SEED_PASSWORD_FERIANTE son las contraseñas de\n" +
        "  las cuentas de ejemplo, y también las que muestra el panel de accesos\n" +
        "  rápidos del login. Ponelas en el .env (está en .gitignore) y volvé a\n" +
        "  correr.\n",
    );
    process.exit(1);
  }

  if (valor.length < 8) {
    console.error(`\n✗ ${nombre} tiene que tener al menos 8 caracteres.\n`);
    process.exit(1);
  }

  return valor;
}

async function main(): Promise<void> {
  const aplicar = process.argv.slice(2).includes("--si");

  // Las dos se leen antes de tocar nada: si falta una, que falle entero y no a
  // mitad de camino con la mitad de las cuentas cambiadas.
  const passwords: Record<string, string> = {
    SEED_PASSWORD_ADMIN: leerPassword("SEED_PASSWORD_ADMIN"),
    SEED_PASSWORD_FERIANTE: leerPassword("SEED_PASSWORD_FERIANTE"),
  };

  console.log();
  console.log(
    aplicar
      ? "Modo: APLICAR — se van a cambiar las contraseñas.\n"
      : "Modo: simulación — no se cambia nada. Agregá --si para aplicar.\n",
  );

  for (const cuenta of CUENTAS) {
    const existente = await prisma.usuario.findUnique({
      where: { email: cuenta.email },
      select: { id: true },
    });

    if (!existente) {
      console.log(`· ${cuenta.email} — no existe, la salteo.`);
      continue;
    }

    if (!aplicar) {
      console.log(`· ${cuenta.email} — le pondría ${cuenta.variable}.`);
      continue;
    }

    await prisma.usuario.update({
      where: { id: existente.id },
      data: {
        passwordHash: await bcrypt.hash(passwords[cuenta.variable]!, COSTO_BCRYPT),
        // Cambiar una contraseña cierra las sesiones abiertas de esa cuenta.
        sesionesValidasDesde: new Date(Math.floor(Date.now() / 1000) * 1000),
      },
    });

    console.log(`✓ ${cuenta.email} — contraseña actualizada.`);
  }

  if (aplicar) {
    console.log(
      "\n✓ Listo. El panel de accesos rápidos de /ingresar ya entra con estas\n" +
        "  cuentas en desarrollo. ACCESOS_DEMO no hace falta localmente, y en\n" +
        "  Vercel no tiene que estar: en producción el panel no se muestra\n" +
        "  aunque esté prendida.\n",
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    "\n✗",
    error instanceof Error ? error.message : String(error),
    "\n",
  );
  process.exitCode = 1;
});
