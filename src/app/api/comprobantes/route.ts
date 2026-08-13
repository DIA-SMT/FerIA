import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { BUCKET_COMPROBANTES } from "@/lib/media";
import { obtenerSesion } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";

/** Los comprobantes se firman por un minuto: alcanza para abrir el archivo. */
const SEGUNDOS_DE_VIGENCIA = 60;

/**
 * Entrega un comprobante de canon.
 *
 * Los comprobantes viven en un bucket **privado**: no se pueden abrir con la
 * URL directa. Este endpoint verifica quién pide el archivo y recién entonces
 * genera una URL firmada de corta duración.
 *
 *   · El personal municipal puede ver cualquier comprobante.
 *   · Un feriante sólo puede ver los de sus propios pagos.
 */
export async function GET(peticion: NextRequest): Promise<NextResponse> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const ruta = peticion.nextUrl.searchParams.get("ruta");
  if (!ruta || !ruta.startsWith(`${BUCKET_COMPROBANTES}/`)) {
    return new NextResponse("Ruta inválida", { status: 400 });
  }

  // Que el pago exista con esa ruta es, además, la verificación de permisos:
  // para un feriante la consulta se restringe a sus propios pagos.
  const pago = await prisma.pagoCanon.findFirst({
    where: {
      comprobante: ruta,
      ...(sesion.rol === "VENDEDOR"
        ? { vendedor: { usuarioId: sesion.id } }
        : {}),
    },
    select: { id: true },
  });

  if (!pago) {
    return new NextResponse("Comprobante no encontrado", { status: 404 });
  }

  const url = await almacenamiento.urlFirmada(ruta, SEGUNDOS_DE_VIGENCIA);
  if (!url) {
    return new NextResponse("No se pudo generar el enlace", { status: 500 });
  }

  return NextResponse.redirect(url);
}
