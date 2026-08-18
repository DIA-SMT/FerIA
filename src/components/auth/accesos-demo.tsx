"use client";

import type { CuentaDemo } from "@/lib/accesos-demo";

/**
 * Accesos rápidos a las cuentas de ejemplo del seed: un click completa el
 * formulario de ingreso y lo envía, para no tipear credenciales cada vez que se
 * prueba un rol distinto.
 *
 * Este componente sólo presenta lo que recibe. Quién decide si el panel existe
 * —y por lo tanto si las credenciales llegan al navegador— es `cuentasDemo()`
 * en `src/lib/accesos-demo.ts`, que corre en el servidor. Si la lista viene
 * vacía, acá no se renderiza nada.
 */
export function AccesosDemo({
  cuentas,
  onElegir,
}: {
  cuentas: CuentaDemo[];
  onElegir: (email: string, password: string) => void;
}) {
  if (cuentas.length === 0) return null;

  return (
    <section
      aria-labelledby="accesos-demo-titulo"
      className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-3"
    >
      <h2
        id="accesos-demo-titulo"
        className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-900 uppercase"
      >
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Accesos de prueba
      </h2>
      <p className="mt-1 text-xs text-amber-800">
        Cuentas del seed. Un click ingresa.
      </p>

      <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {cuentas.map((cuenta) => (
          <li key={cuenta.email}>
            <button
              type="button"
              onClick={() => onElegir(cuenta.email, cuenta.password)}
              className="w-full rounded-md border border-amber-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-amber-400 hover:bg-amber-100/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              <span className="block text-xs font-semibold text-slate-800">
                {cuenta.etiqueta}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {cuenta.detalle}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
