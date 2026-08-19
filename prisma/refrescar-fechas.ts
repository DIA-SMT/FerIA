/**
 * Vuelve a poner las fechas de la demo alrededor de hoy.
 *
 * Se corre con `npm run db:fechas`. No siembra ni borra nada: sólo mueve fechas.
 *
 * Hace falta porque el seed guarda fechas absolutas calculadas desde el día en
 * que se corrió. Una semana después, las ediciones marcadas EN_CURSO terminaron
 * ayer y el sitio dice —con razón— que no hay ferias en curso, que es justo lo
 * que se quiere mostrar en una demo. Antes esto se arreglaba volviendo a sembrar,
 * y eso borra las cuentas, los catálogos y las fotos cargadas a mano.
 *
 * Nada se corre por un delta si se puede recalcular: las ediciones salen de los
 * desplazamientos de `datos-ferias.ts`, y la asignación de stands y los pagos
 * salen de la edición a la que pertenecen. Así el resultado es el mismo se corra
 * una vez o diez, y además corrige lo que estuviera torcido de antes. Sólo la
 * fecha de revisión de las solicitudes se corre por delta, porque no cuelga de
 * ninguna edición.
 */

import { PrismaClient } from "@prisma/client";

import {
  dia,
  fechaDeAsignacion,
  fechaDePago,
  FERIAS,
} from "./datos-ferias";

const prisma = new PrismaClient();

const UN_DIA = 24 * 60 * 60 * 1000;

function iso(fecha: Date | null): string {
  return fecha ? fecha.toISOString().slice(0, 10) : "—";
}

async function main(): Promise<void> {
  const hoy = dia(0);
  console.log(`Hoy: ${iso(hoy)}\n`);

  // ---------------------------------------------------------------------------
  // 1. Ediciones: se recalculan desde los desplazamientos.
  // ---------------------------------------------------------------------------
  const deltas: number[] = [];
  let movidas = 0;
  let sinEncontrar = 0;

  for (const feria of FERIAS) {
    const guardada = await prisma.feria.findUnique({
      where: { slug: feria.slug },
      select: { id: true },
    });

    if (!guardada) {
      console.log(`· falta la feria ${feria.slug}, la salto`);
      sinEncontrar += feria.ediciones.length;
      continue;
    }

    for (const definicion of feria.ediciones) {
      const edicion = await prisma.edicionFeria.findFirst({
        where: { feriaId: guardada.id, nombre: definicion.nombre ?? null },
        select: { id: true, fechaInicio: true },
      });

      if (!edicion) {
        console.log(`· falta la edición «${definicion.nombre}» de ${feria.slug}`);
        sinEncontrar++;
        continue;
      }

      const inicio = dia(definicion.inicio);
      const fin = dia(definicion.fin);
      const vencimiento =
        definicion.vencimiento === undefined
          ? null
          : dia(definicion.vencimiento);

      // Cuánto se movió esta edición: sirve para correr las otras tablas.
      deltas.push(
        Math.round((inicio.getTime() - edicion.fechaInicio.getTime()) / UN_DIA),
      );

      await prisma.edicionFeria.update({
        where: { id: edicion.id },
        data: {
          fechaInicio: inicio,
          fechaFin: fin,
          vencimientoCanon: vencimiento,
        },
      });

      const abarcaHoy = inicio <= hoy && fin >= hoy;
      console.log(
        `${iso(inicio)} → ${iso(fin)}  ${definicion.estado.padEnd(10)} ` +
          `${abarcaHoy ? "abarca hoy" : "          "}  ` +
          `${feria.slug} · ${definicion.nombre ?? "(sin nombre)"}`,
      );
      movidas++;
    }
  }

  if (movidas === 0) {
    console.log("\nNo se movió ninguna edición. ¿Corriste el seed?");
    return;
  }

  // ---------------------------------------------------------------------------
  // 2. El resto de las fechas se corre por el delta más frecuente.
  // ---------------------------------------------------------------------------
  const frecuencia = new Map<number, number>();
  for (const d of deltas) frecuencia.set(d, (frecuencia.get(d) ?? 0) + 1);

  const ordenados = [...frecuencia.entries()].sort((a, b) => b[1] - a[1]);
  // `movidas > 0` garantiza que hay al menos una entrada.
  const delta = ordenados[0]![0];

  if (ordenados.length > 1) {
    // Pasa si alguien editó fechas a mano: se avisa en vez de asumir.
    console.log(
      `\n⚠ Las ediciones no estaban todas al mismo desplazamiento: ` +
        ordenados.map(([d, n]) => `${d} día(s) ×${n}`).join(", ") +
        `. Uso ${delta} para el resto de las fechas.`,
    );
  }

  // La revisión de solicitudes no cuelga de ninguna edición: se corre.
  if (delta !== 0) {
    // Prisma no sabe hacer `columna + intervalo`, así que va por SQL crudo.
    const revisiones = await prisma.$executeRaw`
      UPDATE "vendedores"
      SET "revisadoEn" = "revisadoEn" + ${delta} * INTERVAL '1 day'
      WHERE "revisadoEn" IS NOT NULL
    `;
    console.log(
      `\nSolicitudes revisadas, corridas ${delta} día(s): ${revisiones}`,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Asignaciones y pagos: se recalculan desde su edición.
  // ---------------------------------------------------------------------------
  const conStand = await prisma.stand.findMany({
    where: { vendedorId: { not: null } },
    select: {
      id: true,
      edicion: { select: { fechaInicio: true } },
    },
  });

  for (const stand of conStand) {
    await prisma.stand.update({
      where: { id: stand.id },
      data: { asignadoEn: fechaDeAsignacion(stand.edicion.fechaInicio) },
    });
  }

  const pagados = await prisma.pagoCanon.findMany({
    where: { fechaPago: { not: null } },
    select: {
      id: true,
      edicion: { select: { fechaInicio: true, vencimientoCanon: true } },
    },
  });

  for (const pago of pagados) {
    await prisma.pagoCanon.update({
      where: { id: pago.id },
      data: {
        fechaPago: fechaDePago(
          pago.edicion.vencimientoCanon,
          pago.edicion.fechaInicio,
        ),
      },
    });
  }

  console.log(
    `Recalculadas desde su edición: ${conStand.length} asignaciones, ` +
      `${pagados.length} pagos.`,
  );

  // ---------------------------------------------------------------------------
  // 4. Comprobación: lo que dice el estado tiene que coincidir con las fechas,
  //    y ningún pago puede quedar después de la edición que paga.
  // ---------------------------------------------------------------------------
  const ediciones = await prisma.edicionFeria.findMany({
    select: { nombre: true, fechaInicio: true, fechaFin: true, estado: true },
  });

  const abarcanHoy = ediciones.filter(
    (e) => e.fechaInicio <= hoy && e.fechaFin >= hoy,
  );
  const enCurso = ediciones.filter((e) => e.estado === "EN_CURSO");
  const incoherentes = enCurso.filter(
    (e) => !(e.fechaInicio <= hoy && e.fechaFin >= hoy),
  );

  // Un pago fechado después de que la edición terminó, y marcado «al día», es
  // justo la incoherencia que había antes de colgar la fecha de la edición.
  const revisados = await prisma.pagoCanon.findMany({
    where: { fechaPago: { not: null } },
    select: { fechaPago: true, edicion: { select: { fechaFin: true } } },
  });
  const tardios = revisados.filter(
    (p) => p.fechaPago !== null && p.fechaPago > p.edicion.fechaFin,
  ).length;

  console.log(
    `\nEdiciones que abarcan hoy: ${abarcanHoy.length}   ` +
      `marcadas EN_CURSO: ${enCurso.length}   ` +
      `incoherentes: ${incoherentes.length}`,
  );
  console.log(
    `Pagos revisados: ${revisados.length}   ` +
      `registrados después de terminar la edición: ${tardios}`,
  );

  if (sinEncontrar > 0) {
    console.log(`Ediciones de la definición que no están en la base: ${sinEncontrar}`);
  }

  if (incoherentes.length > 0) {
    console.log("✖ Quedaron ediciones EN_CURSO con fechas que no incluyen hoy.");
    process.exitCode = 1;
    return;
  }

  if (enCurso.length === 0) {
    console.log("✖ No quedó ninguna edición en curso: la demo no va a mostrar ferias activas.");
    process.exitCode = 1;
    return;
  }

  console.log("✔ Fechas al día.");
}

main()
  .catch((error) => {
    console.error("✖ Error al refrescar las fechas:");
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
