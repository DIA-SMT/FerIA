import type { Metadata } from "next";
import Link from "next/link";

import { FormularioIngreso } from "@/components/auth/formulario-ingreso";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";

export const metadata: Metadata = {
  title: "Ingresar",
  description:
    "Acceso para feriantes y personal de la Municipalidad de San Miguel de Tucumán.",
  robots: { index: false, follow: false },
};

export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ volverA?: string }>;
}) {
  const { volverA } = await searchParams;

  // Sólo aceptamos rutas internas: un `volverA` absoluto sería una
  // redirección abierta hacia otro sitio.
  const destino =
    volverA && volverA.startsWith("/") && !volverA.startsWith("//")
      ? volverA
      : "";

  return (
    <div className="w-full max-w-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Ingresar
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Acceso para feriantes y personal municipal.
        </p>
      </div>

      <Tarjeta className="mt-6">
        <TarjetaCuerpo className="sm:p-6">
          <FormularioIngreso volverA={destino} />
        </TarjetaCuerpo>
      </Tarjeta>

      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Todavía no tenés cuenta?{" "}
        <Link
          href="/registro"
          className="font-medium text-municipal-600 transition-colors hover:text-municipal-700"
        >
          Registrate como feriante
        </Link>
      </p>
    </div>
  );
}
