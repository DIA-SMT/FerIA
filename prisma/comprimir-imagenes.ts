/**
 * Recomprime las imágenes de vidriera que ya están subidas.
 *
 *   npm run db:comprimir          (muestra qué haría, sin tocar nada)
 *   npm run db:comprimir -- --si  (lo aplica)
 *
 * Existe porque hasta `guardarImagenOpcional` las portadas, los logos y las
 * fotos de feria se subían tal cual venían del navegador: sólo las fotos de
 * producto pasaban por `sharp`. Medido en el bucket antes de esto, el promedio
 * de `vendedores` era 169 KB contra 37 KB de `productos`, con un PNG de 2,9 MB
 * que bajaba entero en cada visita al stand. El arreglo aplica de ahí en
 * adelante; esto es para lo que ya estaba.
 *
 * **Reusa `comprimirImagen` del código de la app a propósito**, en lugar de ser
 * autocontenido como `seed.ts` y `crear-admin.ts`. La razón es justamente que no
 * se desincronice: si el script comprimiera distinto que la aplicación, las
 * imágenes viejas y las nuevas quedarían con criterios diferentes y la próxima
 * vez que alguien mirara el bucket no entendería por qué. Se puede importar sin
 * problema porque `@/lib/imagenes` sólo depende de `sharp` y de módulos de Node.
 *
 * El orden de las tres operaciones no es casual: **sube primero, actualiza la
 * base después y recién al final borra la vieja**. Si algo falla en el medio lo
 * peor que queda es un archivo huérfano en el bucket —que no rompe nada y se
 * limpia después—, nunca una fila apuntando a un archivo que ya no existe, que
 * sí dejaría un stand sin portada.
 *
 * No toca el bucket `productos`: esas fotos ya salen procesadas y con la
 * insignia municipal aplicada, y volver a codificarlas sería perder calidad sin
 * ganar espacio.
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { comprimirImagen, LADO_LOGO, LADO_PORTADA } from "@/lib/imagenes";

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

/**
 * El mismo año que usa `storage.ts` para lo público.
 *
 * Está repetido y no importado porque la constante de allá no se exporta: es
 * un detalle interno de cómo sube los archivos la aplicación. Si alguna vez
 * cambia, este número tiene que acompañar.
 */
const CACHE_PUBLICO = "31536000";

/**
 * Sólo se reemplaza si la diferencia vale el reemplazo.
 *
 * Una imagen que ya está bien puede salir un 2 % más chica de volver a
 * codificarla, y eso no justifica perder calidad ni cambiarle la ruta. Con este
 * piso el script es reejecutable: la segunda corrida no encuentra nada que
 * hacer.
 */
const AHORRO_MINIMO = 0.1;

interface Objetivo {
  /** Para el log: de quién es esta imagen. */
  de: string;
  /** Qué imagen es, para el log. */
  campo: string;
  /** Ruta con el bucket adelante, ej. `vendedores/abc.webp`. */
  ruta: string;
  ladoMaximo: number;
  /** Deja la ruta nueva donde corresponda. */
  guardar: (ruta: string) => Promise<void>;
}

function partir(ruta: string): { bucket: string; objeto: string } {
  const corte = ruta.indexOf("/");
  return { bucket: ruta.slice(0, corte), objeto: ruta.slice(corte + 1) };
}

async function objetivos(): Promise<Objetivo[]> {
  const lista: Objetivo[] = [];

  const vendedores = await prisma.vendedor.findMany({
    where: { OR: [{ imagenPortada: { not: null } }, { logo: { not: null } }] },
    select: { id: true, emprendimiento: true, imagenPortada: true, logo: true },
    orderBy: { creadoEn: "asc" },
  });

  for (const vendedor of vendedores) {
    if (vendedor.imagenPortada) {
      lista.push({
        de: vendedor.emprendimiento,
        campo: "portada",
        ruta: vendedor.imagenPortada,
        ladoMaximo: LADO_PORTADA,
        guardar: async (ruta) => {
          await prisma.vendedor.update({
            where: { id: vendedor.id },
            data: { imagenPortada: ruta },
          });
        },
      });
    }

    if (vendedor.logo) {
      lista.push({
        de: vendedor.emprendimiento,
        campo: "logo",
        ruta: vendedor.logo,
        ladoMaximo: LADO_LOGO,
        guardar: async (ruta) => {
          await prisma.vendedor.update({
            where: { id: vendedor.id },
            data: { logo: ruta },
          });
        },
      });
    }
  }

  const ferias = await prisma.feria.findMany({
    where: { imagen: { not: null } },
    select: { id: true, nombre: true, imagen: true },
    orderBy: { nombre: "asc" },
  });

  for (const feria of ferias) {
    if (!feria.imagen) continue;
    lista.push({
      de: feria.nombre,
      campo: "imagen",
      ruta: feria.imagen,
      ladoMaximo: LADO_PORTADA,
      guardar: async (ruta) => {
        await prisma.feria.update({
          where: { id: feria.id },
          data: { imagen: ruta },
        });
      },
    });
  }

  return lista;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`.padStart(8);
}

async function main(): Promise<void> {
  const aplicar = process.argv.slice(2).includes("--si");

  console.log(`\nProyecto Supabase: ${new URL(URL_SUPABASE).host}`);
  console.log(
    aplicar
      ? "Modo: APLICAR — se reemplazan los archivos y se actualiza la base.\n"
      : "Modo: simulación — no se escribe nada. Agregá --si para aplicar.\n",
  );

  const lista = await objetivos();

  let antesTotal = 0;
  let despuesTotal = 0;
  let reemplazadas = 0;
  let salteadas = 0;
  let faltantes = 0;

  for (const objetivo of lista) {
    const { bucket, objeto } = partir(objetivo.ruta);
    const etiqueta = `${objetivo.de} · ${objetivo.campo}`;

    const { data, error } = await supabase.storage.from(bucket).download(objeto);

    if (error || !data) {
      // La fila apunta a un archivo que no está. No es cosa de este script
      // arreglarlo —borrar la referencia podría tapar un problema de otro
      // lado—, pero sí avisarlo.
      console.log(`✗ ${etiqueta}: el archivo no está en el bucket (${objetivo.ruta})`);
      faltantes++;
      continue;
    }

    const antes = Buffer.from(await data.arrayBuffer());
    const despues = await comprimirImagen(antes, objetivo.ladoMaximo);

    const ahorro = 1 - despues.length / antes.length;
    antesTotal += antes.length;

    if (ahorro < AHORRO_MINIMO) {
      console.log(`· ${etiqueta}: ya está bien (${kb(antes.length)}), la dejo`);
      despuesTotal += antes.length;
      salteadas++;
      continue;
    }

    despuesTotal += despues.length;
    reemplazadas++;

    const flecha = `${kb(antes.length)} → ${kb(despues.length)}  (−${(ahorro * 100).toFixed(0)} %)`;

    if (!aplicar) {
      console.log(`→ ${etiqueta}: ${flecha}`);
      continue;
    }

    const nuevo = `${crypto.randomUUID()}.webp`;
    const objetoNuevo = objeto.includes("/")
      ? `${objeto.slice(0, objeto.lastIndexOf("/"))}/${nuevo}`
      : nuevo;

    const subida = await supabase.storage
      .from(bucket)
      .upload(objetoNuevo, despues, {
        contentType: "image/webp",
        cacheControl: CACHE_PUBLICO,
        upsert: false,
      });

    if (subida.error) {
      throw new Error(`No se pudo subir ${objetoNuevo}: ${subida.error.message}`);
    }

    await objetivo.guardar(`${bucket}/${objetoNuevo}`);
    await supabase.storage.from(bucket).remove([objeto]);

    console.log(`✓ ${etiqueta}: ${flecha}`);
  }

  console.log(
    `\n${lista.length} imágenes · ${reemplazadas} ${aplicar ? "reemplazadas" : "a reemplazar"}` +
      ` · ${salteadas} ya estaban bien` +
      (faltantes ? ` · ${faltantes} sin archivo` : ""),
  );
  console.log(
    `Total: ${(antesTotal / 1024 / 1024).toFixed(2)} MB → ${(despuesTotal / 1024 / 1024).toFixed(2)} MB` +
      ` (−${((1 - despuesTotal / antesTotal) * 100).toFixed(0)} %)`,
  );

  if (!aplicar && reemplazadas > 0) {
    console.log("\nPara aplicarlo: npm run db:comprimir -- --si\n");
  }
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
