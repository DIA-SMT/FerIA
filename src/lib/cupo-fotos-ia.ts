import { prisma } from "@/lib/db";
import { inicioDelDiaEnZona } from "@/lib/format";
import { FOTOS_IA_POR_DIA } from "@/lib/fotos-producto";

/*
  El tope de «Mejorar imagen con IA»: 15 por feriante y por día de Tucumán.
  Se cuenta en la tabla `fotos_mejoradas` y no en memoria, porque el proceso
  se reinicia con cada despliegue y el contador se vaciaba solo.
*/

/** Cuántas fotos puede mejorar con IA en lo que queda del día. */
export async function fotosIARestantes(
  vendedorId: string,
  ahora: Date = new Date(),
): Promise<number> {
  const hechas = await prisma.fotoMejorada.count({
    where: { vendedorId, creadoEn: { gte: inicioDelDiaEnZona(ahora) } },
  });
  return Math.max(0, FOTOS_IA_POR_DIA - hechas);
}

/** Anota una mejora que salió bien: las que fallan no cuentan. */
export async function registrarFotoMejorada(vendedorId: string): Promise<void> {
  await prisma.fotoMejorada.create({ data: { vendedorId } });
}
