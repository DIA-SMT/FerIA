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
      { href: "/stands", texto: "Catálogo de emprendedores" },
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

/**
 * Pie del sitio público.
 *
 * En azul institucional oscuro y no en gris claro: el gris se confundía con el
 * fondo de la última sección y la página no terminaba en ningún lado. Arriba
 * lleva la franja con los tres colores del isologo, que es lo que lo ata a la
 * marca, y abajo, tres bloques en el orden en que se leen: quiénes somos y a
 * dónde ir, lo que conviene saber antes de comprar, y lo legal.
 *
 * Contraste sobre `municipal-950` (#051f47): el texto más flojo, blanco al
 * 60 %, da 6,5:1 (AA); los títulos de columna en `celeste-300`, 9:1.
 */
export function PiePublico() {
  const anio = new Date().getFullYear();

  return (
    <footer className="paleta-original mt-20 bg-municipal-950 text-white">
      {/* Franja institucional con los tres colores del isologo. */}
      <div className="flex h-1.5" aria-hidden="true">
        <div className="flex-1 bg-municipal-500" />
        <div className="flex-1 bg-celeste-400" />
        <div className="w-16 bg-acento-400" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ------------------------- Marca y navegación ------------------------ */}
        <div className="grid gap-10 py-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <LogoMunicipal comoEnlace={false} tono="claro" />
            {/* Sin nombrar a la Municipalidad: lo dice el logo de arriba y lo
                dice el copyright de abajo. Acá estaba tres veces. */}
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/75">
              La plataforma oficial de las ferias itinerantes. Conocé a los
              feriantes, recorré sus stands online y contactalos directamente.
            </p>

            {/* Autoría: es la firma del equipo que construyó la plataforma, no
                letra chica legal, así que va con la marca. Abajo a la derecha
                la tapaba la burbuja del asistente, que flota en esa esquina.
                El punto amarillo retoma el del isologo. */}
            <p className="mt-6 flex items-center gap-2 text-xs text-white/60">
              <span
                className="size-1.5 shrink-0 rounded-full bg-acento-400"
                aria-hidden="true"
              />
              <span>
                Creado por la{" "}
                <span className="font-semibold text-white">
                  Dirección de Inteligencia Artificial
                </span>
              </span>
            </p>
          </div>

          {/* En el celular, las dos columnas lado a lado: una abajo de la otra
              el pie se estiraba casi una pantalla. Ahí «Catálogo de
              emprendedores» ocupa dos renglones, y está bien. Desde `sm`, cada
              columna a su ancho natural, para que no se parta. */}
          <nav
            aria-label="Pie de página"
            className="grid grid-cols-2 gap-x-6 gap-y-10 sm:flex sm:flex-wrap sm:gap-x-16 lg:col-span-6 lg:justify-end"
          >
            {SECCIONES.map((seccion) => (
              <div key={seccion.titulo}>
                <h3 className="text-xs font-semibold tracking-wider text-celeste-300 uppercase">
                  {seccion.titulo}
                </h3>
                <ul className="mt-4 space-y-3">
                  {seccion.enlaces.map((enlace) => (
                    <li key={enlace.href}>
                      <Link
                        href={enlace.href}
                        className="text-sm text-white/85 transition-colors hover:text-white hover:underline hover:underline-offset-4"
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
        <div className="flex gap-3 rounded-2xl bg-superficie/5 p-4 ring-1 ring-white/10 sm:p-5">
          <IconoInfo
            className="mt-0.5 size-4 shrink-0 text-celeste-300"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-white/70">
            <strong className="font-semibold text-white">
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
        <div className="mt-10 border-t border-white/10 py-6 text-xs text-white/60">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-16">
            <span>© {anio} Municipalidad de San Miguel de Tucumán</span>
            <span className="text-white/30" aria-hidden="true">
              ·
            </span>
            <BotonTerminos className="transition-colors hover:text-white">
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
    </footer>
  );
}
