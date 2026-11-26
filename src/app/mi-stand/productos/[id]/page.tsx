import { hayIAConfigurada } from "@/lib/ai";
import Link from "next/link";
import { notFound } from "next/navigation";

import { actualizarProducto, crearProducto } from "@/actions/productos";
import { FormularioProducto } from "@/components/vendedor/formulario-producto";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { EstadoDeRevision } from "@/components/vendedor/estado-de-revision";
import { fotosIARestantes } from "@/lib/cupo-fotos-ia";
import { prisma } from "@/lib/db";
import { cuandoSeBorra } from "@/lib/borradores";
import { aNumero } from "@/lib/format";
import { hayPreciosPublicos } from "@/lib/marketplace";
import { cambiosAbiertos, productoDelDueno } from "@/lib/revision";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Editar producto" };

/**
 * Hasta un minuto para esta ruta, por la mejora con IA.
 *
 * `maxDuration` es configuración de segmento de ruta, así que tiene que vivir
 * en la página y no en la acción: un archivo "use server" sólo puede exportar
 * funciones async. Y va acá y no en el layout porque Vercel la lee por ruta,
 * para dimensionar la función que la sirve.
 *
 * El número sale de lo medido: la llamada al modelo mide unos 11 segundos, más
 * el procesamiento con sharp y tres subidas a Storage. El límite por defecto de
 * una función de Vercel es de 10 segundos en el plan Hobby, así que sin esto la
 * foto con IA funciona en localhost y falla en el sitio publicado, que es la
 * peor forma de que falle.
 *
 * 60 es el techo del plan Hobby y entra cómodo en los de arriba, así que sirve
 * sin tener que saber en cuál está la Municipalidad. Si alguna vez se migra a
 * uno con más margen, se puede subir; bajarlo no.
 */
export const maxDuration = 60;

export default async function PaginaEditarProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { vendedor } = await requerirVendedorAprobado();
  const { id } = await params;

  // El filtro por `vendedorId` evita que un feriante abra el producto de otro.
  const conIA = hayIAConfigurada();
  const [publicado, cambios, restantesIA] = await Promise.all([
    prisma.producto.findFirst({ where: { id, vendedorId: vendedor.id } }),
    cambiosAbiertos(vendedor.id),
    conIA ? fotosIARestantes(vendedor.id) : 0,
  ]);

  if (!publicado) notFound();

  // Si tiene un cambio en revisión, el formulario arranca desde esa versión: es
  // la que el feriante ve en su stand y la que va a seguir corrigiendo.
  const { producto, revision, nuevo } = productoDelDueno(
    { ...publicado, precio: publicado.precio === null ? null : aNumero(publicado.precio) },
    cambios,
  );

  const valores = {
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    imagenes: producto.imagenes,
    disponible: producto.disponible,
    destacado: producto.destacado,
    precio: producto.precio,
    stock: producto.stock,
  };

  // Un borrador se completa con el mismo formulario del alta: se sigue
  // guardando solo, y el botón lo manda a revisión.
  if (publicado.borrador) {
    return (
      <div className="max-w-3xl">
        <header className="mb-6">
          <Link
            href="/mi-stand#catalogo"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
          >
            <IconoFlechaIzquierda className="size-4" />
            Volver a mi stand
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Completar producto
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Es un borrador: lo ves sólo vos y se guarda solo. Cuando esté listo,
            mandalo a revisión. Si no lo tocás, se borra{" "}
            {cuandoSeBorra(publicado.actualizadoEn)}.
          </p>
        </header>

        <FormularioProducto
          hayIA={conIA}
          conPrecios={hayPreciosPublicos()}
          restantesIA={restantesIA}
          accion={crearProducto}
          producto={valores}
          autoguardado
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/mi-stand#catalogo"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver a mi stand
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Editar producto
        </h1>
        {revision && (
          <EstadoDeRevision
            revision={revision}
            que={nuevo ? "Producto nuevo" : undefined}
            sinDescartar={nuevo}
            className="mt-3"
          />
        )}
        <p className="mt-3 text-sm text-slate-600">
          Lo que cambies pasa por la revisión de la Dirección de Relaciones
          Institucionales antes de publicarse. La cantidad y «Marcar sin stock» se
          aplican en el momento.
        </p>
      </header>

      <FormularioProducto
        hayIA={conIA}
        conPrecios={hayPreciosPublicos()}
        restantesIA={restantesIA}
        accion={actualizarProducto}
        producto={valores}
      />
    </div>
  );
}
