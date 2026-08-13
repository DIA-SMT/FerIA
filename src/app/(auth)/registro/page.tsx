import type { Metadata } from "next";
import Link from "next/link";

import { FormularioRegistro } from "@/components/auth/formulario-registro";
import { Alerta } from "@/components/ui/alerta";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";

export const metadata: Metadata = {
  title: "Registro de feriantes",
  description:
    "Registrá tu emprendimiento para participar de las ferias municipales de San Miguel de Tucumán.",
};

export default async function PaginaRegistro({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="w-full max-w-2xl">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Registro de feriantes
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Completá los datos de tu emprendimiento para solicitar participar de
          las ferias municipales.
        </p>
      </div>

      {error === "perfil-incompleto" && (
        <Alerta tipo="advertencia" titulo="Tu registro quedó incompleto" className="mt-6">
          No encontramos el perfil de emprendimiento asociado a tu cuenta.
          Volvé a completar el formulario para poder continuar.
        </Alerta>
      )}

      <Tarjeta className="mt-6">
        <TarjetaCuerpo className="sm:p-6">
          <FormularioRegistro />
        </TarjetaCuerpo>
      </Tarjeta>

      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/ingresar"
          className="font-medium text-municipal-600 transition-colors hover:text-municipal-700"
        >
          Ingresá acá
        </Link>
      </p>
    </div>
  );
}
