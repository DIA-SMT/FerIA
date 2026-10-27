/**
 * Pone la foto de portada de una feria desde un archivo del disco.
 *
 *   npm run db:foto-feria -- <slug-de-la-feria> "<ruta del archivo>"
 *   npm run db:foto-feria -- <slug-de-la-feria> "<ruta del archivo>" --si
 *
 * El camino normal para esto es el panel: Ferias → la feria → Editar → Imagen,
 * que desde `guardarImagenOpcional` comprime igual que este script. Esto existe
 * para cargar varias de una, que es lo que pasa cuando llegan las fotos de las
 * cinco ferias juntas, y para poder hacerlo sin pasar por el navegador.
 *
 * Usa `comprimirImagen`, la misma función que la aplicación, y no una propia:
 * si comprimiera distinto, las fotos cargadas por acá y las cargadas desde el
 * panel quedarían con criterios diferentes y nadie entendería por qué.
 *
 * Igual que en `comprimir-imagenes.ts`, el orden es subir, actualizar la base y
 * recién después borrar la vieja: si algo falla en el medio queda un archivo
 * huérfano, nunca una feria sin foto.
 *
 * Sin `--si` no escribe nada: dice qué archivo leyó, cuánto pesa comprimido y a
 * qué feria se lo pondría.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { comprimirImagen, LADO_PORTADA } from "@/lib/imagenes";

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

const URL_SUPABASE = requerido("NEXT_PUBLIC_SUPABASE_URL");

const supabase = createClient(
  URL_SUPABASE,
  requerido("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** El mismo año que usa `storage.ts` para los buckets públicos. */
const CACHE_PUBLICO = "31536000";

const EXTENSIONES_ACEPTADAS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
]);

function leerArgumentos(): { slug: string; archivo: string; aplicar: boolean } {
  const argumentos = process.argv.slice(2);
  const sueltos = argumentos.filter((valor) => !valor.startsWith("--"));

  const slug = sueltos[0];
  const archivo = sueltos[1];

  if (!slug || !archivo) {
    console.error(
      "\n✗ Faltan argumentos.\n" +
        '  Uso: npm run db:foto-feria -- <slug-de-la-feria> "<ruta del archivo>"\n' +
        "  La ruta va entre comillas: los nombres de archivo suelen tener espacios.\n",
    );
    process.exit(1);
  }

  const extension = path.extname(archivo).toLowerCase();
  if (!EXTENSIONES_ACEPTADAS.has(extension)) {
    console.error(
      `\n✗ "${extension}" no es una imagen que sepamos leer.\n` +
        `  Acepta: ${[...EXTENSIONES_ACEPTADAS].join(", ")}\n`,
    );
    process.exit(1);
  }

  return { slug, archivo, aplicar: argumentos.includes("--si") };
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function main(): Promise<void> {
  const { slug, archivo, aplicar } = leerArgumentos();

  const feria = await prisma.feria.findUnique({
    where: { slug },
    select: { id: true, nombre: true, imagen: true },
  });

  if (!feria) {
    const todas = await prisma.feria.findMany({
      select: { slug: true },
      orderBy: { nombre: "asc" },
    });
    console.error(
      `\n✗ No hay ninguna feria con el slug "${slug}".\n` +
        `  Las que hay:\n${todas.map((f) => `    ${f.slug}`).join("\n")}\n`,
    );
    process.exit(1);
  }

  const original = await readFile(archivo);
  const comprimida = await comprimirImagen(original, LADO_PORTADA);

  console.log(`\nProyecto Supabase: ${new URL(URL_SUPABASE).host}`);
  console.log(`Feria: ${feria.nombre}`);
  console.log(`Archivo: ${path.basename(archivo)}`);
  console.log(
    `Peso: ${kb(original.length)} → ${kb(comprimida.length)} ` +
      `(−${((1 - comprimida.length / original.length) * 100).toFixed(0)} %)`,
  );
  console.log(
    feria.imagen
      ? `Reemplaza a: ${feria.imagen}`
      : "La feria todavía no tenía foto.",
  );

  if (!aplicar) {
    console.log("\nSimulación: no se escribió nada. Agregá --si para aplicar.\n");
    return;
  }

  const objeto = `${crypto.randomUUID()}.webp`;

  const subida = await supabase.storage
    .from("ferias")
    .upload(objeto, comprimida, {
      contentType: "image/webp",
      cacheControl: CACHE_PUBLICO,
      upsert: false,
    });

  if (subida.error) {
    throw new Error(`No se pudo subir la foto: ${subida.error.message}`);
  }

  await prisma.feria.update({
    where: { id: feria.id },
    data: { imagen: `ferias/${objeto}` },
  });

  if (feria.imagen) {
    const anterior = feria.imagen.slice(feria.imagen.indexOf("/") + 1);
    await supabase.storage.from("ferias").remove([anterior]);
  }

  console.log(`\n✓ Listo. ${feria.nombre} ya muestra la foto nueva.\n`);
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
