import { NextResponse, type NextRequest } from "next/server";

import { rutaEsDelVendedor } from "@/lib/fotos-producto";
import { imagenPublicitaria } from "@/lib/imagen-catalogo";
import {
  abrirArchivo,
  enlaceParaImagen,
  ferianteDeLaSesion,
  whatsappParaImagen,
} from "@/lib/imagen-del-feriante";

/**
 * La imagen publicitaria terminada: la escena que generó la IA (`fondo`) con
 * el título, el nombre, el WhatsApp y el Instagram puestos encima.
 *
 *   ?fondo=productos/vendedores/<id>/publicidad/<archivo>.webp
 *   &titular=¡Antojate de un apretado! 🥪
 *   &formato=historia  o «publicacion»
 *
 * Se arma en cada pedido: cambiar el título no vuelve a llamar a la IA. El
 * fondo tiene que ser una escena del feriante de la sesión.
 */
export async function GET(peticion: NextRequest): Promise<Response> {
  const vendedor = await ferianteDeLaSesion();
  if (!vendedor) return new NextResponse(null, { status: 404 });

  const parametros = peticion.nextUrl.searchParams;
  const rutaFondo = parametros.get("fondo") ?? "";
  if (
    !rutaEsDelVendedor(rutaFondo, vendedor.id) ||
    !rutaFondo.includes("/publicidad/")
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const [fondo, logo] = await Promise.all([
    abrirArchivo(rutaFondo),
    abrirArchivo(vendedor.logo),
  ]);
  if (!fondo) return new NextResponse(null, { status: 404 });

  return imagenPublicitaria({
    formato:
      parametros.get("formato") === "historia" ? "historia" : "publicacion",
    fondo,
    titular: (parametros.get("titular") ?? "").slice(0, 60),
    emprendimiento: vendedor.emprendimiento,
    logo,
    whatsapp: whatsappParaImagen(vendedor.whatsapp),
    instagram: vendedor.instagram,
    enlace: enlaceParaImagen(vendedor.slug),
  });
}
