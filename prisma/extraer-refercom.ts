/**
 * Extrae el padrón de Feria Digital de la base del municipio a un JSON.
 *
 *   npm run db:extraer -- --contar                 cuenta y no escribe nada
 *   npm run db:extraer -- C:\afuera\padron.json    escribe el padrón
 *
 * El JSON sale con la forma que lee `importar-feria-digital.ts`, que es el que
 * lo carga. Son dos pasos y no uno porque la base del municipio está en la red
 * interna y el servidor de FerIA no llega: se extrae desde una máquina de la
 * oficina, se copia el archivo al servidor y se importa allá. Ver «Importar el
 * padrón» en el README.
 *
 * Lo que hay que saber antes de correrlo:
 *
 *  · **Sólo lee.** La cuenta que nos dieron puede alterar tablas; este script
 *    no lo hace nunca.
 *  · **La conexión sale del entorno**, no del código: el repositorio es público
 *    y ni la IP del servidor ni las cuentas tienen por qué estar acá.
 *    REFERCOM_HOST y REFERCOM_USUARIO pueden ir en el .env; REFERCOM_CLAVE no,
 *    se pasa al correr (el README dice cómo, sin que quede en el historial).
 *  · **El archivo tiene datos personales** de unas mil personas: DNI, teléfono,
 *    correo y domicilio. Por eso el script se niega a escribirlo adentro de un
 *    repositorio —este es público, y un `git add .` alcanzaría— y por eso
 *    existe `--contar`, para verificar la conexión sin generar nada.
 */

import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";

import { armarFichas, type TablasRefercom } from "./refercom";

// ---------------------------------------------------------------------------
// Entorno y argumentos
// ---------------------------------------------------------------------------

function requerida(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    console.error(
      `\n✗ Falta ${nombre}.\n\n` +
        "  REFERCOM_HOST y REFERCOM_USUARIO pueden ir en el .env. REFERCOM_CLAVE se\n" +
        "  pasa al correr: el README tiene el comando para cada sistema.\n",
    );
    process.exit(1);
  }
  return valor;
}

interface Opciones {
  archivo: string | null;
  contar: boolean;
}

function leerOpciones(): Opciones {
  const args = process.argv.slice(2);
  const contar = args.includes("--contar");
  const archivo = args.find((arg) => !arg.startsWith("--")) ?? null;

  if (!contar && !archivo) {
    console.error(
      "\n✗ Falta dónde escribir el padrón.\n\n" +
        "  npm run db:extraer -- --contar                 sólo cuenta\n" +
        "  npm run db:extraer -- C:\\afuera\\padron.json    escribe el padrón\n",
    );
    process.exit(1);
  }

  return { archivo: archivo ? resolve(archivo) : null, contar };
}

/**
 * Si la carpeta está dentro de un repositorio git.
 *
 * Se le pregunta a git y no se compara contra la carpeta de este proyecto
 * porque el riesgo es cualquier repositorio: el que se clonó al lado, el de
 * otro proyecto. Si git no está o la carpeta no es de ninguno, se puede
 * escribir.
 */
function dentroDeUnRepositorio(carpeta: string): boolean {
  const git = spawnSync("git", ["-C", carpeta, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8",
  });
  return git.status === 0 && git.stdout.trim() === "true";
}

function validarDestino(archivo: string): void {
  const carpeta = dirname(archivo);

  if (!existsSync(carpeta)) {
    console.error(`\n✗ La carpeta ${carpeta} no existe.\n`);
    process.exit(1);
  }

  if (dentroDeUnRepositorio(carpeta)) {
    console.error(
      `\n✗ ${carpeta} está dentro de un repositorio git.\n\n` +
        "  El padrón tiene DNI, teléfono y domicilio de unas mil personas, y este\n" +
        "  repositorio es público. Escribilo afuera, por ejemplo en Descargas, y\n" +
        "  borralo cuando termine la importación.\n",
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

async function leer<T>(conexion: Connection, sql: string): Promise<T[]> {
  const [filas] = await conexion.query<RowDataPacket[]>(sql);
  return filas as unknown as T[];
}

async function leerTablas(conexion: Connection): Promise<TablasRefercom> {
  const [
    personas,
    emprendimientos,
    rubrosDeEmprendimiento,
    rubros,
    ferias,
    productosDeEmprendimiento,
    productos,
  ] = await Promise.all([
    leer<TablasRefercom["personas"][number]>(
      conexion,
      "SELECT id_emprendedor, dni, apellido, nombre, telefono, domicilio, email, instagram, facebook FROM tbl_emprendedor",
    ),
    leer<TablasRefercom["emprendimientos"][number]>(
      conexion,
      "SELECT id_emprendimiento, id_emprendedor, id_feria, nombre_empre FROM tbl_emprendimiento_cabe",
    ),
    leer<TablasRefercom["rubrosDeEmprendimiento"][number]>(
      conexion,
      "SELECT id_emprendimiento, id_rubro FROM tbl_emprendimiento_deta",
    ),
    leer<TablasRefercom["rubros"][number]>(conexion, "SELECT id_rubro, rubro FROM tbl_rubro"),
    leer<TablasRefercom["ferias"][number]>(conexion, "SELECT id_feria, feria FROM tbl_ferias"),
    leer<TablasRefercom["productosDeEmprendimiento"][number]>(
      conexion,
      "SELECT id_emprendimiento, id_producto FROM tbl_deta_producto",
    ),
    leer<TablasRefercom["productos"][number]>(
      conexion,
      "SELECT id_producto, producto FROM tbl_producto",
    ),
  ]);

  return {
    personas,
    emprendimientos,
    rubrosDeEmprendimiento,
    rubros,
    ferias,
    productosDeEmprendimiento,
    productos,
  };
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opciones = leerOpciones();
  if (opciones.archivo) validarDestino(opciones.archivo);

  const conexion = await createConnection({
    host: requerida("REFERCOM_HOST"),
    user: requerida("REFERCOM_USUARIO"),
    password: requerida("REFERCOM_CLAVE"),
    database: process.env.REFERCOM_BASE?.trim() || "smt_refercom",
    connectTimeout: 10_000,
  });

  let tablas: TablasRefercom;
  try {
    tablas = await leerTablas(conexion);
  } finally {
    await conexion.end();
  }

  const fichas = armarFichas(tablas);
  const personas = new Set(tablas.personas.map((p) => p.id_emprendedor));

  // Sólo conteos: nada de lo que se imprime identifica a una persona.
  console.log(
    [
      "",
      `Padrón leído: ${fichas.length} emprendimientos de ${tablas.personas.length} personas`,
      `  sin persona asociada  ${tablas.emprendimientos.filter((e) => e.id_emprendedor === null || !personas.has(e.id_emprendedor)).length}`,
      `  sin nombre            ${fichas.filter((f) => f.emprendimiento === null).length}`,
      `  sin teléfono          ${fichas.filter((f) => f.telefono === null).length}`,
      `  sin rubro             ${fichas.filter((f) => f.rubros.length === 0).length}`,
      `  con productos         ${fichas.filter((f) => f.productos.length > 0).length}`,
      "",
    ].join("\n"),
  );

  if (!opciones.archivo) {
    console.log("--contar: no se escribió nada.\n");
    return;
  }

  writeFileSync(opciones.archivo, JSON.stringify(fichas, null, 2), "utf8");
  console.log(
    [
      `Escrito en ${opciones.archivo}`,
      "",
      "Siguiente paso: copiarlo al servidor e importarlo allá, primero en",
      "simulacro (npm run db:importar -- padron.json) y después con --aplicar.",
      "Tiene datos personales: borralo de las dos máquinas cuando termine.",
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  // Los errores de mysql2 no traen la clave; sí el host y el usuario, que no
  // son secretos.
  console.error("\n✗ La extracción falló:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
