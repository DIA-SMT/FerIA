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
 * contraseña, sólo se asegura de que tenga rol ADMIN en los dos lugares donde
 * el rol vive. Para cambiar una contraseña existente está el panel de Supabase,
 * que además deja registro de quién lo hizo.
 *
 * El script es autocontenido a propósito, como el seed: no importa nada de
 * `src/`, así corre bajo `tsx` sin depender de los alias de TypeScript.
 */

import { PrismaClient, Rol } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Completá el archivo .env antes de correr esto.`,
    );
  }
  return valor;
}

/**
 * Cliente con la service role key: es la única que puede escribir
 * `app_metadata`, que es donde viaja el rol dentro del JWT para que el
 * middleware lo lea en el Edge sin consultar la base.
 */
const supabase = createClient(
  requerido("NEXT_PUBLIC_SUPABASE_URL"),
  requerido("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

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

/**
 * Busca la cuenta en `auth.users`.
 *
 * Pagina en vez de pedir una página grande: con el padrón de Feria Digital
 * adentro, el día que cada feriante reclame su ficha esto va a tener cientos de
 * cuentas, y un `perPage` fijo empezaría a no encontrar a los últimos sin
 * avisar.
 */
async function buscarEnAuth(email: string): Promise<string | null> {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: 200,
    });

    if (error) throw new Error(`No se pudo listar las cuentas: ${error.message}`);
    if (!data.users.length) return null;

    const encontrada = data.users.find((usuario) => usuario.email === email);
    if (encontrada) return encontrada.id;
  }
}

async function main(): Promise<void> {
  const { email, nombre } = leerArgumentos();

  const password = process.env["PASSWORD_ADMIN"];

  const existente = await buscarEnAuth(email);

  if (existente) {
    // Ya existe: no se le toca la contraseña. Lo único que se garantiza es que
    // el rol esté en los dos lugares, porque una cuenta con ADMIN en
    // `public.usuarios` y VENDEDOR en el JWT rebota en el middleware antes de
    // que la página llegue a mirar la base.
    console.log(`→ La cuenta ${email} ya existía: le aseguro el rol ADMIN.`);

    const { error } = await supabase.auth.admin.updateUserById(existente, {
      app_metadata: { rol: Rol.ADMIN },
      user_metadata: { nombre },
    });
    if (error) {
      throw new Error(`No se pudo actualizar la cuenta: ${error.message}`);
    }

    await prisma.usuario.upsert({
      where: { id: existente },
      create: { id: existente, email, nombre, rol: Rol.ADMIN },
      update: { email, nombre, rol: Rol.ADMIN },
    });

    console.log(
      "\n✓ Listo. La contraseña quedó como estaba: si hace falta cambiarla,\n" +
        "  se hace desde el panel de Supabase, que deja registro de quién fue.\n",
    );
    return;
  }

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

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    // Sin verificación por correo: la cuenta la da de alta la Dirección desde
    // acá, no se registra sola, y así el alta no depende de que Supabase tenga
    // un SMTP configurado.
    email_confirm: true,
    app_metadata: { rol: Rol.ADMIN },
    user_metadata: { nombre },
  });

  if (error || !data.user) {
    throw new Error(
      `No se pudo crear la cuenta: ${error?.message ?? "sin detalle"}`,
    );
  }

  // `public.usuarios` es la fuente de verdad del rol: el JWT es sólo la copia
  // que lee el middleware. Si esto fallara quedaría una cuenta que entra y no
  // tiene perfil, así que va inmediatamente después.
  await prisma.usuario.create({
    data: { id: data.user.id, email, nombre, rol: Rol.ADMIN },
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
