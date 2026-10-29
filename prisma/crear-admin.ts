/**
 * Alta de una cuenta de administración del panel.
 *
 *   npm run db:admin -- direccionia@smt.gob.ar --nombre "Dirección de Innovación"
 *
 * Existe porque hasta ahora la única cuenta ADMIN la creaba el seed, y el seed
 * **borra toda la base** antes de correr: pedir una cuenta nueva no puede
 * significar perder las ferias, los feriantes y el padrón importado. Esto hace
 * sólo el alta, y nada más.
 *
 * LA CONTRASEÑA SALE DEL ENTORNO, NUNCA DE UN ARGUMENTO. En la línea de
 * comandos quedaría en el historial del shell y en la lista de procesos, donde
 * la ve cualquiera que corra `ps`. Va en `PASSWORD_ADMIN`, en el `.env` —que
 * está en `.gitignore`— o delante del comando en un shell con el historial
 * apagado.
 *
 * Es reejecutable y no pisa nada: si la cuenta ya existe no le toca la
 * contraseña, sólo se asegura de que tenga rol ADMIN. Para **cambiar** una
 * contraseña existente está `npm run db:clave`.
 *
 * Antes esto creaba la cuenta en Supabase Auth y el perfil acá, y tenía que
 * mantener el rol sincronizado en los dos lugares porque el middleware lo leía
 * del JWT de Supabase. Desde que las credenciales son propias hay un solo
 * lugar, así que el script se achicó a la mitad y dejó de poder quedar a medias.
 *
 * El script es autocontenido a propósito, como el seed: no importa nada de
 * `src/`, así corre bajo `tsx` sin depender de los alias de TypeScript.
 */

import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { PrismaClient, Rol } from "@prisma/client";

const prisma = new PrismaClient();

/** El mismo costo que usa la aplicación, y el que traían los hash heredados. */
const COSTO = 10;

interface Argumentos {
  email: string;
  nombre: string;
}

function leerArgumentos(): Argumentos {
  const argumentos = process.argv.slice(2);

  const email = argumentos.find((valor) => !valor.startsWith("--"));
  if (!email || !email.includes("@")) {
    console.error(
      "\n✗ Falta el correo de la cuenta.\n" +
        '  Uso: npm run db:admin -- alguien@smt.gob.ar --nombre "Nombre que se ve en el panel"\n',
    );
    process.exit(1);
  }

  const posicionNombre = argumentos.indexOf("--nombre");
  const nombre =
    posicionNombre >= 0 ? argumentos[posicionNombre + 1] : undefined;

  if (!nombre) {
    console.error(
      "\n✗ Falta --nombre.\n" +
        "  Es lo que se muestra en el encabezado del panel, así que tiene que\n" +
        "  decir de quién es la cuenta y no repetir el correo.\n",
    );
    process.exit(1);
  }

  return { email: email.toLowerCase(), nombre };
}

async function main(): Promise<void> {
  const { email, nombre } = leerArgumentos();

  const existente = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, rol: true },
  });

  if (existente) {
    // Ya existe: no se le toca la contraseña, sólo se le asegura el rol.
    console.log(`→ La cuenta ${email} ya existía: le aseguro el rol ADMIN.`);

    await prisma.usuario.update({
      where: { id: existente.id },
      data: { nombre, rol: Rol.ADMIN },
    });

    console.log(
      "\n✓ Listo. La contraseña quedó como estaba.\n" +
        "  Para cambiarla: npm run db:clave -- " +
        email +
        "\n",
    );
    return;
  }

  const password = process.env["PASSWORD_ADMIN"];

  if (!password) {
    console.error(
      "\n✗ Falta PASSWORD_ADMIN.\n" +
        "  Es la contraseña con la que va a entrar la cuenta nueva. Ponela en el\n" +
        "  .env (está en .gitignore) y volvé a correr. No va como argumento: en\n" +
        "  la línea de comandos queda en el historial y en la lista de procesos.\n",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("\n✗ PASSWORD_ADMIN tiene que tener al menos 8 caracteres.\n");
    process.exit(1);
  }

  console.log(`→ Creando la cuenta ${email}…`);

  await prisma.usuario.create({
    data: {
      id: randomUUID(),
      email,
      nombre,
      rol: Rol.ADMIN,
      passwordHash: await bcrypt.hash(password, COSTO),
    },
  });

  console.log(
    `\n✓ ${email} ya puede entrar al panel escribiendo /admin.\n` +
      "  La contraseña es la que pusiste en PASSWORD_ADMIN: sacala del .env\n" +
      "  cuando termines, que ya cumplió.\n",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "\n✗",
      error instanceof Error ? error.message : String(error),
      "\n",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
