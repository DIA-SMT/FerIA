import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { formatearMoneda } from "@/lib/format";
import {
  imagenDelCatalogo,
  MAXIMO_PRODUCTOS,
  type FormatoImagen,
} from "@/lib/imagen-catalogo";
import {
  abrirArchivo,
  enlaceParaImagen,
  ferianteDeLaSesion,
  whatsappParaImagen,
} from "@/lib/imagen-del-feriante";
import { RUBROS } from "@/lib/labels";
import { leerPrecio } from "@/lib/sello-propio";

/**
 * La imagen del catálogo del feriante que está en la sesión, con los
 * productos que eligió en «Compartir».
 *
 *   ?p=<id>,<id>…      los productos, en el orden en que van (hasta seis)
 *   &precios=15000,,…  un precio por producto, o vacío; sólo para la imagen
 *   &formato=historia  o «publicacion» (el de siempre)
 *
 * Los precios no se guardan en ningún lado: el sitio no publica precios, y lo
 * que el feriante ponga acá va sólo en la imagen que él comparte.
 *
 * Sólo arma la imagen de su propio stand: los productos se buscan atados a la
 * ficha de la sesión, así que un id ajeno simplemente no aparece.
 */
export async function GET(peticion: NextRequest): Promise<Response> {
  const vendedor = await ferianteDeLaSesion();
  if (!vendedor) return new NextResponse(null, { status: 404 });

  const parametros = peticion.nextUrl.searchParams;
  const ids = (parametros.get("p") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 40)
    .slice(0, MAXIMO_PRODUCTOS);
  const precios = (parametros.get("precios") ?? "").split(",");
  const formato: FormatoImagen =
    parametros.get("formato") === "historia" ? "historia" : "publicacion";

  const encontrados = await prisma.producto.findMany({
    where: { id: { in: ids }, vendedorId: vendedor.id, publicado: true },
    select: { id: true, nombre: true, imagenes: true },
  });
  const porId = new Map(encontrados.map((producto) => [producto.id, producto]));

  const [logo, productos] = await Promise.all([
    abrirArchivo(vendedor.logo),
    Promise.all(
      ids.flatMap((id, indice) => {
        const producto = porId.get(id);
        if (!producto) return [];
        const precio = leerPrecio((precios[indice] ?? "").slice(0, 15));
        return [
          abrirArchivo(producto.imagenes[0]).then((foto) => ({
            nombre: producto.nombre,
            foto,
            precio: precio ? formatearMoneda(precio) : null,
          })),
        ];
      }),
    ),
  ]);

  return imagenDelCatalogo({
    formato,
    emprendimiento: vendedor.emprendimiento,
    subtitulo: [
      RUBROS[vendedor.rubro],
      ...vendedor.postulaciones.map((postulacion) => postulacion.feria.nombre),
    ].join(" · "),
    logo,
    whatsapp: whatsappParaImagen(vendedor.whatsapp),
    instagram: vendedor.instagram,
    enlace: enlaceParaImagen(vendedor.slug),
    productos,
  });
}
