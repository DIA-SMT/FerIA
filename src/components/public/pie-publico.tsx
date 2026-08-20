import Link from "next/link";

import { LogoMunicipal } from "@/components/ui/logo-municipal";

const SECCIONES = [
  {
    titulo: "Ferias",
    enlaces: [
      { href: "/ferias", texto: "Todas las ferias" },
      { href: "/stands", texto: "Directorio de stands" },
    ],
  },
  {
    titulo: "Feriantes",
    enlaces: [
      { href: "/registro", texto: "Quiero participar" },
      { href: "/ingresar", texto: "Ingresar a mi stand" },
    ],
  },
];

export function PiePublico() {
  const anio = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <LogoMunicipal comoEnlace={false} />
            <p className="mt-4 max-w-sm text-sm text-slate-600">
              Plataforma oficial de ferias itinerantes de la Municipalidad de
              San Miguel de Tucumán. Conocé a los feriantes, recorré sus stands
              online y contactalos directamente.
            </p>
          </div>

          {SECCIONES.map((seccion) => (
            <div key={seccion.titulo}>
              <h3 className="text-sm font-semibold text-slate-900">
                {seccion.titulo}
              </h3>
              <ul className="mt-3 space-y-2">
                {seccion.enlaces.map((enlace) => (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      className="text-sm text-slate-600 transition-colors hover:text-municipal-700"
                    >
                      {enlace.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Aviso en castellano llano, donde el vecino lo cruza sin buscarlo. El
            texto formal completo vive en /terminos: acá va lo que cambia una
            decisión de compra, y nada más. Las dos frases están medidas contra
            lo que las funciones de IA pueden hacer de verdad —una foto puede
            quedar recompuesta y una descripción asistida—, así que si se toca
            alguna de las dos funciones, hay que revisar esto. */}
        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs leading-relaxed text-slate-600">
            <strong className="font-semibold text-slate-900">
              Antes de comprar:
            </strong>{" "}
            las fotos de los productos pueden estar mejoradas con inteligencia
            artificial, así que tomalas como ilustrativas y consultale al
            feriante. Las ventas se acuerdan de forma directa entre vecinos y
            feriantes: el municipio no intermedia en el precio, el pago ni la
            entrega.{" "}
            <Link
              href="/terminos"
              className="font-medium text-municipal-700 underline underline-offset-2 transition-colors hover:text-municipal-800"
            >
              Leer los términos y condiciones
            </Link>
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {anio} Municipalidad de San Miguel de Tucumán. Todos los derechos
            reservados.
          </p>
          <Link
            href="/terminos"
            className="transition-colors hover:text-municipal-700"
          >
            Términos y condiciones
          </Link>
        </div>

        {/* Autoría. Va en su propia franja y no junto al copyright: es una firma
            del equipo que construyó la plataforma, no letra chica legal. El
            punto amarillo retoma el del isologo, que es lo que la identifica. */}
        <div className="mt-6 border-t border-slate-200 pt-6">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className="size-1.5 shrink-0 rounded-full bg-acento-400"
              aria-hidden="true"
            />
            <span>
              Creado por la{" "}
              <span className="font-semibold text-municipal-700">
                Dirección de Inteligencia Artificial
              </span>{" "}
              de la Municipalidad de San Miguel de Tucumán
            </span>
          </p>
        </div>
      </div>

      {/* Franja institucional con los tres colores del isologo. */}
      <div className="flex h-1.5" aria-hidden="true">
        <div className="flex-1 bg-municipal-500" />
        <div className="flex-1 bg-celeste-400" />
        <div className="w-16 bg-acento-400" />
      </div>
    </footer>
  );
}
