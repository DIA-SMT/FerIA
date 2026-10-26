import type { Metadata } from "next";
import Link from "next/link";

import { BotonCidituc } from "@/components/auth/boton-cidituc";
import { FormularioIngreso } from "@/components/auth/formulario-ingreso";
import { Alerta } from "@/components/ui/alerta";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { cuentasDemo } from "@/lib/accesos-demo";
import { hayIngresoCidituc } from "@/lib/cidituc";

/**
 * Qué salió mal al volver de CiDiTuc.
 *
 * Cada motivo es distinto porque se arreglan distinto: uno se reintenta, otro
 * necesita que la persona complete su cuenta en CiDiTuc y otro es un problema
 * nuestro. Un mensaje único mandaría a todos a reintentar en vano.
 */
const ERRORES_CIDITUC: Record<string, string> = {
  "cidituc-sin-token":
    "Volviste de CiDiTuc sin credenciales. Probá ingresar de nuevo.",
  "cidituc-estado":
    "El ingreso no se pudo verificar. Suele pasar si tardaste más de diez minutos o si quedaron dos pestañas abiertas: entrá de nuevo desde acá.",
  "cidituc-token-invalido":
    "CiDiTuc no reconoció la sesión. Probá ingresar de nuevo.",
  "cidituc-sin-perfil":
    "No pudimos consultar tus datos en CiDiTuc en este momento. Volvé a intentar en unos minutos.",
  "cidituc-sin-documento":
    "Tu cuenta de CiDiTuc no tiene un número de documento válido. Revisalo en cidituc.smt.gob.ar y volvé a entrar.",
  "cidituc-sin-cuenta":
    "No pudimos crear tu cuenta en la plataforma. Volvé a intentar en unos minutos.",
  "cidituc-sesion":
    "Te identificamos en CiDiTuc pero no pudimos abrir tu sesión acá. Volvé a intentar en unos minutos.",
};

export const metadata: Metadata = {
  title: "Ingresar",
  description:
    "Acceso para feriantes y personal de la Municipalidad de San Miguel de Tucumán.",
  robots: { index: false, follow: false },
};

export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ volverA?: string; error?: string }>;
}) {
  const { volverA, error } = await searchParams;

  const mensajeCidituc = error ? ERRORES_CIDITUC[error] : undefined;

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

      {mensajeCidituc && (
        <Alerta tipo="error" className="mt-6">
          {mensajeCidituc}
        </Alerta>
      )}

      <Tarjeta className="mt-6">
        <TarjetaCuerpo className="sm:p-6">
          {/* El botón sólo aparece una vez que DITEC desplegó el Derivador con
              nuestra clave. Prendido antes, la persona se autentica bien en
              CiDiTuc y queda varada ahí, sin ningún mensaje. */}
          {hayIngresoCidituc() && <BotonCidituc />}

          {/* Las credenciales se resuelven en el servidor: si el panel está
              apagado, `cuentasDemo()` devuelve vacío y nada de esto llega al
              navegador. Ver src/lib/accesos-demo.ts. */}
          <FormularioIngreso volverA={destino} cuentasDemo={cuentasDemo()} />
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
