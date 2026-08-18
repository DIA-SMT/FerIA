"use client";

/**
 * Accesos rápidos a las cuentas de ejemplo del seed. **Sólo en desarrollo.**
 *
 * Existe para no tipear credenciales cada vez que se prueba un rol distinto:
 * un click completa el formulario y lo envía.
 *
 * La guarda es `process.env.NODE_ENV`, que Next.js reemplaza por una constante
 * al compilar. En un build de producción la condición queda en `false` y el
 * bloque entero —credenciales incluidas— se elimina del bundle. No es que esté
 * oculto: no llega al navegador. Ver la nota del README.
 */

export const ES_DESARROLLO = process.env.NODE_ENV === "development";

interface CuentaDemo {
  etiqueta: string;
  detalle: string;
  email: string;
  password: string;
}

/** Las mismas contraseñas que fija `prisma/seed.ts`. */
const PASSWORD_ADMIN = "Ferias.2026";
const PASSWORD_FERIANTE = "Feriante.2026";

const CUENTAS: CuentaDemo[] = [
  {
    etiqueta: "Municipal",
    detalle: "Panel completo",
    email: "admin@smt.gob.ar",
    password: PASSWORD_ADMIN,
  },
  {
    etiqueta: "Feriante aprobado",
    detalle: "Tejidos del Cerro",
    email: "tejidosdelcerro@example.com",
    password: PASSWORD_FERIANTE,
  },
  {
    etiqueta: "Feriante pendiente",
    detalle: "Telar Andino",
    email: "telarandino@example.com",
    password: PASSWORD_FERIANTE,
  },
  {
    etiqueta: "Feriante rechazado",
    detalle: "Importados LH",
    email: "importadoslh@example.com",
    password: PASSWORD_FERIANTE,
  },
];

export function AccesosDemo({
  onElegir,
}: {
  onElegir: (email: string, password: string) => void;
}) {
  if (!ES_DESARROLLO) return null;

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
        Cuentas del seed. Un click ingresa. Sólo visible en desarrollo.
      </p>

      <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {CUENTAS.map((cuenta) => (
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
