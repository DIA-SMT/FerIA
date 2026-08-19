import Link from "next/link";
import { notFound } from "next/navigation";

import { BancoDePruebasFoto } from "@/components/vendedor/banco-de-pruebas-foto";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Probar el procesado de fotos" };

/**
 * Banco de pruebas del procesado de fotos. **Sólo en desarrollo.**
 *
 * Existe para evaluar el pipeline determinista y la mejora con IA sobre fotos
 * reales antes de decidir la interfaz definitiva del catálogo. No guarda nada.
 *
 * El `notFound()` se evalúa en el servidor, así que en un build de producción
 * la ruta simplemente no existe.
 */
export default async function PaginaProbarFoto() {
  if (process.env.NODE_ENV !== "development") notFound();

  await requerirVendedorAprobado();

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <Link
          href="/mi-stand/productos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver al catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Probar el procesado de fotos
        </h1>
        <p className="mt-1 text-slate-600">
          Banco de pruebas para comparar las tres versiones de una foto. Sólo
          visible en desarrollo y no guarda nada.
        </p>
      </header>

      <BancoDePruebasFoto />
    </div>
  );
}
