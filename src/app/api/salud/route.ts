import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { hoyEnZona } from "@/lib/format";

/**
 * Chequeo de salud para el monitor externo.
 *
 * Es **público** a propósito: lo consume el cron de GitHub Actions, que no
 * tiene sesión. Por eso devuelve sólo lo que ya está a la vista en la portada
 * —cuántas ferias activas, cuántos feriantes aprobados— y un estado. Nada de
 * nombres, contactos ni números de gestión: si mañana hace falta más detalle,
 * va en un endpoint con sesión, no acá.
 *
 * Por qué existe: el único monitor del sistema hacía `grep "Ferias activas"`
 * sobre el HTML de producción, y ese texto es la **etiqueta** fija del contador
 * del hero, no el dato. Está en la página siempre, incluso con el sitio
 * mostrando «Por ahora no hay ferias programadas», así que el chequeo daba
 * verde con el sitio vacío; y además se rompía en silencio si alguien
 * reescribía esa etiqueta. Lo que hay que detectar es que no quede nada para
 * mostrar, y eso se mide contando, no leyendo la UI.
 */

// Que no la cachee nadie: un monitor que lee una respuesta guardada no sirve.
export const dynamic = "force-dynamic";

const SIN_CACHE = { "cache-control": "no-store" };

export async function GET(): Promise<NextResponse> {
  try {
    // El criterio de «vigente» está repetido a mano en vez de importarlo de
    // `src/lib/consultas.ts`: el monitor comprueba la base, no la capa de
    // consultas, y si lo hiciera a través de ella un cambio ahí podría dejarlo
    // verde por el motivo equivocado. El costo es que si cambia el criterio
    // público (estados o corte por fecha) hay que tocar también este archivo.
    const [ferias, edicionesVigentes, feriantes] = await Promise.all([
      prisma.feria.count({ where: { activa: true } }),
      prisma.edicionFeria.count({
        where: {
          estado: { in: ["PUBLICADA", "EN_CURSO"] },
          // `fechaFin` es una columna DATE: se compara contra el hoy de
          // Tucumán expresado como medianoche UTC — ver `hoyEnZona`.
          fechaFin: { gte: hoyEnZona() },
          // Una edición publicada de una feria desactivada no se muestra en
          // ningún lado. Sin este filtro el monitor daba verde contando
          // ediciones que el vecino no puede ver: exactamente el falso
          // positivo que este endpoint vino a eliminar.
          feria: { activa: true },
        },
      }),
      prisma.vendedor.count({ where: { estado: "APROBADO" } }),
    ]);

    // Sin ediciones vigentes el sitio está técnicamente sano y públicamente
    // vacío, que es justo el caso que el monitor viejo no veía. Va 503 para
    // que falle por código HTTP y no haya que interpretar el cuerpo.
    const vacio = edicionesVigentes === 0;

    return NextResponse.json(
      {
        estado: vacio ? "sin-ediciones" : "ok",
        ferias,
        edicionesVigentes,
        feriantes,
      },
      { status: vacio ? 503 : 200, headers: SIN_CACHE },
    );
  } catch (error) {
    // El 8/9 el proyecto de Supabase estaba pausado y el pooler contestaba
    // «tenant or user not found». Queda en los logs de Vercel con el detalle;
    // afuera sólo sale el estado.
    console.error("[salud] la base no respondió", error);

    return NextResponse.json(
      { estado: "sin-base" },
      { status: 503, headers: SIN_CACHE },
    );
  }
}
