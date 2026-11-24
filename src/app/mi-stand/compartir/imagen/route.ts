import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { formatearMoneda } from "@/lib/format";
import {
  imagenDelCatalogo,
  MAXIMO_PRODUCTOS,
  type FormatoImagen,
} from "@/lib/imagen-catalogo";
import { RUBROS } from "@/lib/labels";
import { leerPrecio } from "@/lib/sello-propio";
import { obtenerSesion } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";
import { formatearWhatsapp } from "@/lib/whatsapp";

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
  const sesion = await obtenerSesion();
  if (!sesion) return new NextResponse(null, { status: 401 });

  const vendedor = await prisma.vendedor.findUnique({
    where: { usuarioId: sesion.id },
    select: {
      id: true,
      estado: true,
      emprendimiento: true,
      slug: true,
      rubro: true,
      logo: true,
      whatsapp: true,
      instagram: true,
      postulaciones: {
        where: { estado: "ACEPTADA", feria: { activa: true } },
        orderBy: { feria: { nombre: "asc" } },
        take: 2,
        select: { feria: { select: { nombre: true } } },
      },
    },
  });
  if (!vendedor || vendedor.estado !== "APROBADO") {
    return new NextResponse(null, { status: 404 });
  }

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

  const abrir = async (ruta: string | null | undefined) =>
    ruta ? ((await almacenamiento.abrir(ruta))?.contenido ?? null) : null;

  const [logo, productos] = await Promise.all([
    abrir(vendedor.logo),
    Promise.all(
      ids.flatMap((id, indice) => {
        const producto = porId.get(id);
        if (!producto) return [];
        const precio = leerPrecio((precios[indice] ?? "").slice(0, 15));
        return [
          abrir(producto.imagenes[0]).then((foto) => ({
            nombre: producto.nombre,
            foto,
            precio: precio ? formatearMoneda(precio) : null,
          })),
        ];
      }),
    ),
  ]);

  const sitio = (process.env.NEXT_PUBLIC_APP_URL ?? "https://feria.smt.gob.ar")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  return imagenDelCatalogo({
    formato,
    emprendimiento: vendedor.emprendimiento,
    subtitulo: [
      RUBROS[vendedor.rubro],
      ...vendedor.postulaciones.map((postulacion) => postulacion.feria.nombre),
    ].join(" · "),
    logo,
    // En la ciudad nadie dice «+54 9»: el número como se lo pasa a un vecino.
    whatsapp: formatearWhatsapp(vendedor.whatsapp).replace(/^\+54 9 /, ""),
    instagram: vendedor.instagram,
    enlace: `${sitio}/stands/${vendedor.slug}`,
    productos,
  });
}
