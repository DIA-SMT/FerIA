import Link from "next/link";

import {
  BotonTerminos,
  DialogoTerminos,
} from "@/components/public/dialogo-terminos";
import { TerminosContenido } from "@/components/public/terminos-contenido";
import { IconoInfo } from "@/components/ui/iconos";
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ------------------------- Marca y navegación ------------------------ */}
        <div className="grid gap-10 py-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <LogoMunicipal comoEnlace={false} />
            {/* Sin nombrar a la Municipalidad: lo dice el logo de arriba y lo
                dice el copyright de abajo. Acá estaba tres veces. */}
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-600">
              La plataforma oficial de las ferias itinerantes. Conocé a los
              feriantes, recorré sus stands online y contactalos directamente.
            </p>

            {/* Autoría: es la firma del equipo que construyó la plataforma, no
                letra chica legal, así que va con la marca. Abajo a la derecha
                la tapaba la burbuja del asistente, que flota en esa esquina.
                El punto amarillo retoma el del isologo. */}
            <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
              <span
                className="size-1.5 shrink-0 rounded-full bg-acento-400"
                aria-hidden="true"
              />
              <span>
                Creado por la{" "}
                <span className="font-semibold text-municipal-700">
                  Dirección de Inteligencia Artificial
                </span>
              </span>
            </p>
          </div>

          {/* Columnas a su ancho natural: en una grilla fija «Directorio de
              stands» se partía en dos renglones. */}
          <nav
            aria-label="Pie de página"
            className="flex flex-wrap gap-x-16 gap-y-8 lg:col-span-6 lg:justify-end"
          >
            {SECCIONES.map((seccion) => (
              <div key={seccion.titulo}>
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  {seccion.titulo}
                </h3>
                <ul className="mt-4 space-y-3">
                  {seccion.enlaces.map((enlace) => (
                    <li key={enlace.href}>
                      <Link
                        href={enlace.href}
                        className="text-sm text-slate-700 transition-colors hover:text-municipal-700"
                      >
                        {enlace.texto}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Aviso en castellano llano, donde el vecino lo cruza sin buscarlo. El
            texto formal completo vive en /terminos: acá va lo que cambia una
            decisión de compra, y nada más. Las dos frases están medidas contra
            lo que las funciones de IA pueden hacer de verdad —una foto puede
            quedar recompuesta y una descripción asistida—, así que si se toca
            alguna de las dos funciones, hay que revisar esto. */}
        <div className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 sm:p-5">
          <IconoInfo
            className="mt-0.5 size-4 shrink-0 text-municipal-500"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-slate-600">
            <strong className="font-semibold text-slate-900">
              Antes de comprar:
            </strong>{" "}
            las fotos de los productos pueden estar mejoradas con inteligencia
            artificial, así que tomalas como ilustrativas y consultale al
            feriante. Las ventas se acuerdan de forma directa entre vecinos y
            feriantes: el municipio no intermedia en el precio, el pago ni la
            entrega.
          </p>
        </div>

        {/* --------------------------- Franja inferior --------------------------
            Una sola y sólo lo legal, a la izquierda: a la derecha flota la
            burbuja del asistente. Es el único lugar del pie con el nombre de
            la Municipalidad y el único link a los términos: antes había dos
            franjas, el link aparecía dos veces y el nombre, tres.

            El `pr-16` le reserva lugar a esa burbuja (56 px a 16 px del borde):
            en el celular el texto ocupa tres renglones y, al llegar al final de
            la página, la burbuja le tapaba la punta. Como el texto va a la
            izquierda, en pantallas anchas no se nota. */}
        <div className="mt-10 border-t border-slate-200 py-6 text-xs text-slate-500">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-16">
            <span>© {anio} Municipalidad de San Miguel de Tucumán</span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <BotonTerminos className="transition-colors hover:text-municipal-700">
              Términos y condiciones
            </BotonTerminos>
          </p>
        </div>

        {/* El diálogo que abre «Términos y condiciones». El texto viaja como
            children para que siga renderizándose en el servidor. */}
        <DialogoTerminos>
          <TerminosContenido />
        </DialogoTerminos>
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
