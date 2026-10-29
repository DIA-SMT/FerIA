import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { BUCKET_COMPROBANTES } from "@/lib/media";
import { obtenerSesion } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";

/**
 * Cuánto puede guardarlo el navegador que lo pidió. Un minuto alcanza para que
 * abrir el mismo comprobante dos veces seguidas no lo baje dos veces, y es poco
 * para que quede dando vueltas en una máquina compartida.
 */
const SEGUNDOS_DE_CACHE = 60;

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

  const archivo = await almacenamiento.abrir(ruta);
  if (!archivo) {
    return new NextResponse("No se pudo leer el comprobante", { status: 500 });
  }

  // `Buffer` no entra como cuerpo de una respuesta web: el tipo que espera es
  // el `Uint8Array` del estándar, no el de Node.
  return new NextResponse(new Uint8Array(archivo.contenido), {
    headers: {
      "Content-Type": archivo.tipoMime,
      // `private` y no `public`: esto es el documento de un vecino y no lo
      // puede guardar ningún intermediario, sólo el navegador que lo pidió.
      "Cache-Control": `private, max-age=${SEGUNDOS_DE_CACHE}`,
      // El contenido lo subió una persona. Sin esto, un navegador puede decidir
      // por su cuenta que un archivo es HTML y ejecutarlo en nuestro dominio.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
