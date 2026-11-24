import Link from "next/link";

import { crearPropuestaPropia } from "@/actions/sello-propio";
import { FormularioPropuesta } from "@/components/admin/formulario-propuesta";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { hayIAConfigurada } from "@/lib/ai";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Nueva propuesta de Modo Feria" };

export default async function PaginaNuevaPropuestaPropia() {
  await requerirVendedorAprobado();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/mi-stand/modo-feria"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver a Modo Feria
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Nueva propuesta
        </h1>
      </header>

      <FormularioPropuesta
        conIA={hayIAConfigurada()}
        accion={crearPropuestaPropia}
        volver="/mi-stand/modo-feria"
      />
    </div>
  );
}
