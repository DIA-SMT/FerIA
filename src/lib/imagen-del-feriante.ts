import { prisma } from "@/lib/db";
import {
  cupoDePublicidad,
  UN_PERIODO_MS,
  type CupoDePublicidad,
} from "@/lib/publicidad";
import { obtenerSesion } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";
import { formatearWhatsapp } from "@/lib/whatsapp";

/*
  Lo que comparten las imágenes que arma el feriante en «Compartir» —la del
  catálogo y la publicitaria—: quién es, a partir de la sesión, y cómo se
  escriben su WhatsApp y el link de su stand en una imagen.
*/

/** El feriante aprobado de la sesión, o `null`. Nunca uno que llegue por parámetro. */
export async function ferianteDeLaSesion() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

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
  return vendedor?.estado === "APROBADO" ? vendedor : null;
}

/** Un archivo guardado, o `null` si no hay ruta o no se encuentra. */
export async function abrirArchivo(
  ruta: string | null | undefined,
): Promise<Buffer | null> {
  return ruta ? ((await almacenamiento.abrir(ruta))?.contenido ?? null) : null;
}

/** En la ciudad nadie dice «+54 9»: el número como se lo pasa a un vecino. */
export function whatsappParaImagen(whatsapp: string): string {
  return formatearWhatsapp(whatsapp).replace(/^\+54 9 /, "");
}

/** El link del stand sin protocolo: «feria.smt.gob.ar/stands/dulces-de-tita». */
export function enlaceParaImagen(slug: string): string {
  const sitio = (process.env.NEXT_PUBLIC_APP_URL ?? "https://feria.smt.gob.ar")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return `${sitio}/stands/${slug}`;
}

/** Cuántas imágenes publicitarias le quedan y desde cuándo puede otra. */
export async function consultarCupoDePublicidad(
  vendedorId: string,
  ahora = new Date(),
): Promise<CupoDePublicidad> {
  const generadas = await prisma.publicidadGenerada.findMany({
    where: {
      vendedorId,
      creadoEn: { gt: new Date(ahora.getTime() - UN_PERIODO_MS) },
    },
    select: { creadoEn: true },
  });
  return cupoDePublicidad(
    generadas.map((fila) => fila.creadoEn),
    ahora,
  );
}
