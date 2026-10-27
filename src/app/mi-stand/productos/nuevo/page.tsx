import { hayIAConfigurada } from "@/lib/ai";
import Link from "next/link";

import { crearProducto } from "@/actions/productos";
import { FormularioProducto } from "@/components/vendedor/formulario-producto";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { hayPreciosPublicos } from "@/lib/marketplace";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Nuevo producto" };

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

export default async function PaginaNuevoProducto() {
  await requerirVendedorAprobado();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/mi-stand/productos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver al catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Agregar producto
        </h1>
      </header>

      <FormularioProducto
        accion={crearProducto}
        hayIA={hayIAConfigurada()}
        conPrecios={hayPreciosPublicos()}
      />
    </div>
  );
}
