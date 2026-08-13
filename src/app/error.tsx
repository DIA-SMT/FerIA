"use client";

import { useEffect } from "react";

import { Boton, BotonLink } from "@/components/ui/boton";
import { IconoAlerta } from "@/components/ui/iconos";

export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En producción esto debería ir a un servicio de monitoreo.
    console.error("[error]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
          <IconoAlerta className="size-7 text-red-600" />
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Algo salió mal
        </h1>
        <p className="mt-3 text-slate-600">
          Ocurrió un error inesperado al cargar esta sección. Podés reintentar;
          si el problema persiste, avisá a la Dirección de Ferias y Mercados.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-400">
            Código de referencia: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Boton onClick={reset}>Reintentar</Boton>
          <BotonLink href="/" variante="contorno">
            Ir al inicio
          </BotonLink>
        </div>
      </div>
    </div>
  );
}
