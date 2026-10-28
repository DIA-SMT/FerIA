/**
 * Saca de la vidriera los emprendimientos inventados que crea el seed.
 *
 *   npm run db:rechazar-ficcion                                      (simula)
 *   npm run db:rechazar-ficcion -- --excepto tejidos-del-cerro --si  (aplica)
 *
 * El seed crea once emprendimientos de ficción con nombres que suenan reales
 * —Tejidos del Cerro, Empanadas Doña Rosa, Alfarería La Ciénaga— y los deja
 * APROBADOS, así que el market los publica como si fueran el padrón oficial de
 * las ferias de la ciudad. Eso ya pasó una vez en producción y está contado en
 * `812fd58`: catorce emprendimientos inventados, indexables y firmados por la
 * Municipalidad.
 *
 * Rechazarlos los saca de la vidriera y del directorio sin borrar nada: las
 * fichas quedan, con sus productos y sus fotos, y se pueden reabrir desde el
 * panel. Por eso RECHAZADO y no un `delete`.
 *
 * `--excepto` existe porque mientras se desarrolla hace falta al menos una
 * ficha publicada para probar la vidriera, el catálogo y el panel de accesos
 * rápidos del login, que promete un «feriante aprobado». La que se deje tiene
 * que salir igual antes de que el sitio se anuncie: sigue siendo ficción
 * publicada.
 *
 * **No toca los stands.** Un feriante rechazado puede seguir figurando en el
 * mapa de una edición ya publicada, y liberar esos puestos cambiaría ediciones
 * que la Dirección armó. El script los lista para que se decida a mano.
 */

import { EstadoVendedor, OrigenVendedor, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Qué cuenta como ficción, y por qué se reconoce así.
 *
 * `@example.com` es un dominio reservado por la RFC 2606 justamente para
 * ejemplos: no existe, no recibe correo y nadie lo puede registrar. O sea que
 * una ficha con ese correo no puede ser de una persona real ni por accidente.
 * Es una regla mucho más segura que mirar el nombre del emprendimiento.
 *
 * El `origen PROPIO` deja afuera al padrón de Feria Digital, que son registros
 * del municipio y no se tocan desde acá.
 */
const CORREO_DE_EJEMPLO = "@example.com";

const MOTIVO =
  "Ficha de demostración creada por el seed. No corresponde a un emprendimiento real.";

function leerArgumentos(): { excepciones: string[]; aplicar: boolean } {
  const argumentos = process.argv.slice(2);
  const excepciones: string[] = [];

  for (let i = 0; i < argumentos.length; i++) {
    if (argumentos[i] === "--excepto") {
      const slug = argumentos[i + 1];
      if (slug && !slug.startsWith("--")) excepciones.push(slug);
    }
  }

  return { excepciones, aplicar: argumentos.includes("--si") };
}

async function main(): Promise<void> {
  const { excepciones, aplicar } = leerArgumentos();

  const candidatas = await prisma.vendedor.findMany({
    where: {
      estado: EstadoVendedor.APROBADO,
      origen: OrigenVendedor.PROPIO,
      usuario: { email: { endsWith: CORREO_DE_EJEMPLO } },
    },
    orderBy: { emprendimiento: "asc" },
    select: {
      id: true,
      emprendimiento: true,
      slug: true,
      usuario: { select: { email: true } },
      _count: { select: { productos: true } },
      stands: {
        where: { edicion: { estado: { in: ["PUBLICADA", "EN_CURSO"] } } },
        select: {
          numero: true,
          edicion: { select: { nombre: true, estado: true } },
        },
      },
    },
  });

  const aRechazar = candidatas.filter(
    (ficha) => !excepciones.includes(ficha.slug),
  );
  const perdonadas = candidatas.filter((ficha) =>
    excepciones.includes(ficha.slug),
  );

  console.log(
    aplicar
      ? "\nModo: APLICAR — se pasan a RECHAZADO.\n"
      : "\nModo: simulación — no se escribe nada. Agregá --si para aplicar.\n",
  );

  if (candidatas.length === 0) {
    console.log("No quedan fichas de ficción publicadas.\n");
    return;
  }

  for (const ficha of aRechazar) {
    console.log(
      `${aplicar ? "✓" : "→"} ${ficha.emprendimiento} (${ficha._count.productos} productos)`,
    );
  }

  for (const ficha of perdonadas) {
    console.log(`· ${ficha.emprendimiento} — la dejo publicada, pediste --excepto`);
  }

  // Los puestos que van a quedar ocupados por alguien rechazado. No se liberan
  // acá: cambiar el mapa de una edición publicada es decisión de la Dirección.
  const puestos = aRechazar.flatMap((ficha) =>
    ficha.stands.map(
      (stand) =>
        `  puesto ${stand.numero} en ${stand.edicion.nombre} [${stand.edicion.estado}] — ${ficha.emprendimiento}`,
    ),
  );

  if (puestos.length > 0) {
    console.log(
      `\n⚠ Quedan ${puestos.length} puestos asignados a fichas rechazadas.` +
        "\n  No los libero: cambiaría ediciones que ya están armadas.\n" +
        puestos.join("\n"),
    );
  }

  if (!aplicar) {
    console.log(
      `\n${aRechazar.length} a rechazar, ${perdonadas.length} que quedan.\n`,
    );
    return;
  }

  const { count } = await prisma.vendedor.updateMany({
    where: { id: { in: aRechazar.map((ficha) => ficha.id) } },
    data: {
      estado: EstadoVendedor.RECHAZADO,
      motivoRechazo: MOTIVO,
      revisadoEn: new Date(),
    },
  });

  console.log(
    `\n✓ ${count} fichas fuera de la vidriera. No se borró nada: se reabren` +
      "\n  desde /admin/postulaciones, en «Altas rechazadas».\n",
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
