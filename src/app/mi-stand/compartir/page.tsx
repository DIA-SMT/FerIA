import { generarPublicidad } from "@/actions/publicidad";
import {
  CompartirCatalogo,
  type ProductoParaCompartir,
} from "@/components/vendedor/compartir-catalogo";
import { PestaniasCompartir } from "@/components/vendedor/pestanias-compartir";
import { PublicidadConIA } from "@/components/vendedor/publicidad-con-ia";
import { hayIAConfigurada } from "@/lib/ai";
import { consultarCupoDePublicidad } from "@/lib/imagen-del-feriante";
import { prisma } from "@/lib/db";
import { urlPublica } from "@/lib/media";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Compartir mi catálogo" };

/** La imagen publicitaria tarda: la escena de la IA ronda los 10 a 15 segundos. */
export const maxDuration = 60;

/**
 * Para difundir el stand: la imagen del catálogo para WhatsApp e Instagram,
 * el link del stand y atajos para pedirle ideas a Migue.
 */
export default async function PaginaCompartir() {
  const { vendedor } = await requerirVendedorAprobado();

  const productos = await prisma.producto.findMany({
    where: { vendedorId: vendedor.id, publicado: true, disponible: true },
    orderBy: [{ destacado: "desc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, imagenes: true },
  });

  const sitio = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://feria.smt.gob.ar"
  ).replace(/\/+$/, "");

  const paraCompartir = productos.map((producto): ProductoParaCompartir => ({
    id: producto.id,
    nombre: producto.nombre,
    foto: urlPublica(producto.imagenes[0]),
  }));
  const enlace = `${sitio}/stands/${vendedor.slug}`;
  const conIA = hayIAConfigurada();
  const cupo = await consultarCupoDePublicidad(vendedor.id);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Compartir mi catálogo
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Armá una imagen con tus productos para mandarla por WhatsApp a tus
          clientes o subirla a Instagram. Sale con tu WhatsApp, tu Instagram y
          el link de tu stand.
        </p>
      </header>

      <PestaniasCompartir
        catalogo={
          <CompartirCatalogo
            productos={paraCompartir}
            enlace={enlace}
            emprendimiento={vendedor.emprendimiento}
            conInstagram={Boolean(vendedor.instagram)}
            conMigue={conIA}
          />
        }
        publicidad={
          conIA ? (
            <PublicidadConIA
              productos={paraCompartir}
              emprendimiento={vendedor.emprendimiento}
              enlace={enlace}
              generar={generarPublicidad}
              cupoInicial={{
                restantes: cupo.restantes,
                proxima: cupo.proxima?.toISOString() ?? null,
              }}
            />
          ) : null
        }
      />
    </div>
  );
}
