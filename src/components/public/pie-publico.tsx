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

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {anio} Municipalidad de San Miguel de Tucumán. Todos los derechos
            reservados.
          </p>
          <p>
            Las ventas se realizan de forma directa entre vecinos y feriantes.
            El municipio no intermedia en las transacciones.
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
