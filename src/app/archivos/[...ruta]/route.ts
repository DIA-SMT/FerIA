import { NextResponse } from "next/server";

import { BUCKETS_PUBLICOS, partirRuta } from "@/lib/media";
import { almacenamiento } from "@/lib/storage";

/**
 * Entrega un archivo de un bucket **público** desde el almacenamiento.
 *
 * En producción esta ruta casi no se usa: nginx intercepta `/archivos/` y
 * sirve el archivo del disco sin molestar a Node. Existe igual, y no es
 * redundante, por dos motivos:
 *
 *  · `next/image` optimiza las fotos, y para hacerlo se pide el original **a sí
 *    mismo**, no al proxy de adelante. Sin esta ruta el optimizador recibe un
 *    404 y todas las imágenes del sitio quedan rotas. Fue exactamente lo que
 *    estuvo a punto de pasar al mudar los archivos de Supabase al disco.
 *  · En desarrollo no hay ningún nginx delante, así que ésta es la única forma
 *    de ver las fotos con el almacenamiento local prendido.
 *
 * ⚠️ Sólo los buckets públicos. `comprobantes` son documentos de un vecino y
 * no se entregan por acá a ningún precio: su única puerta es
 * `/api/comprobantes`, que antes verifica de quién es el pago.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
): Promise<NextResponse> {
  const { ruta } = await params;
  const camino = ruta.join("/");

  const partes = partirRuta(camino);
  if (!partes) {
    return new NextResponse("Ruta inválida", { status: 400 });
  }

  // La lista blanca es la barrera, y va antes de tocar el disco: cualquier
  // bucket que no esté acá —hoy `comprobantes`, mañana el que se agregue— no
  // se sirve, aunque el archivo exista.
  if (!BUCKETS_PUBLICOS.includes(partes.bucket as never)) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const archivo = await almacenamiento.abrir(camino);
  if (!archivo) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  return new NextResponse(new Uint8Array(archivo.contenido), {
    headers: {
      "Content-Type": archivo.tipoMime,
      // Cada objeto lleva un UUID y nunca se reescribe, así que el contenido de
      // una ruta no cambia jamás. Es el mismo criterio que usa `storage.ts`.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
