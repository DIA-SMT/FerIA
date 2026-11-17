import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import "./globals.css";

/*
  Las dos tipografías viven en `src/fuentes/`, dentro del repo, y no se bajan
  de Google al construir.

  Antes eran `next/font/google`, que las descarga en cada build. En la VPS esa
  descarga fallaba de vez en cuando —«An error occurred in `next/font`.
  TypeError: Cannot read properties of null (reading '1')»— y el build había
  que reintentarlo. Ahora el build no sale a internet por ellas.

  Son los mismos archivos que servía Google, sacados de los paquetes Fontsource
  (`@fontsource-variable/inter` y `@fontsource/baloo-2`, 5.3.0), en el subset
  latino, que cubre todo el castellano. La licencia de cada una (SIL OFL 1.1)
  va al lado, como pide la licencia.

  El navegador del vecino nunca le pide nada a Google, igual que antes: no se
  suma un tercero a la política de privacidad.
*/

/**
 * Tipografía institucional.
 * Inter tiene muy buena legibilidad en pantallas chicas, que es por donde
 * entra la mayoría de los vecinos. Es la variable: un solo archivo para todos
 * los pesos.
 */
const inter = localFont({
  src: "../fuentes/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--fuente-institucional",
  display: "swap",
});

/**
 * Tipografía de rótulo, sólo para el globo de Migue.
 *
 * Inter es excelente para leer y por eso es la institucional, pero en el globo
 * de un personaje se lee como lo que es: texto de sistema metido en un dibujo.
 * Baloo es redonda y gruesa, que es lo que hace que el nombre se lea como
 * rótulo y no como contenido.
 *
 * Es deliberadamente de un solo uso. Si aparece en un título, en un botón o en
 * una tarjeta, deja de ser la voz de Migue y pasa a ser decoración.
 */
const baloo = localFont({
  src: [
    {
      path: "../fuentes/baloo-2-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fuentes/baloo-2-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--fuente-globo",
  display: "swap",
});

const URL_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(URL_BASE),
  title: {
    default: "Ferias Municipales — San Miguel de Tucumán",
    template: "%s · Ferias Municipales SMT",
  },
  description:
    "Conocé las ferias de artesanos, emprendedores y gastronómicas de San Miguel de Tucumán. Recorré los stands online y contactá directamente a cada feriante.",
  applicationName: "Ferias Municipales SMT",
  authors: [{ name: "Municipalidad de San Miguel de Tucumán" }],
  keywords: [
    "ferias",
    "San Miguel de Tucumán",
    "artesanos",
    "emprendedores",
    "municipalidad",
    "feriantes",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Ferias Municipales SMT",
    title: "Ferias Municipales — San Miguel de Tucumán",
    description:
      "Recorré las ferias de la ciudad y los stands online de cada feriante.",
  },
  /**
   * Indexación, apagada mientras el sitio muestre datos de ejemplo.
   *
   * El market estuvo publicando catorce emprendimientos inventados —con nombre
   * y apellido de personas que no existen— como si fueran el padrón oficial de
   * las ferias de la ciudad, indexable y firmado por la Municipalidad.
   *
   * Se prende de nuevo (`index: true`) recién cuando lo que se sirve sean
   * feriantes reales. Google no desindexa comercios inventados atribuidos al
   * municipio apretando un botón: sacarlos después cuesta mucho más que no
   * dejarlos entrar.
   */
  robots: {
    index: process.env.PERMITIR_INDEXACION === "true",
    follow: process.env.PERMITIR_INDEXACION === "true",
  },
};

export const viewport: Viewport = {
  themeColor: "#0567F2",
  width: "device-width",
  initialScale: 1,
};

/**
 * Pone el tema antes de que se pinte nada, para que de noche la página no
 * aparezca blanca un instante y después se oscurezca.
 *
 * Si el vecino eligió uno con el botón, queda guardado en `localStorage`; si
 * no, se sigue el del teléfono o la computadora, también cuando lo cambia con
 * la página abierta. Va en línea y sin dependencias porque tiene que correr
 * antes que cualquier script de la página.
 */
const SCRIPT_TEMA = `(function(){try{
var d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");
function elegido(){try{return localStorage.getItem("tema")}catch(e){return null}}
function aplicar(){var t=elegido(),o=t?t==="oscuro":m.matches;
d.classList.toggle("dark",o);d.style.colorScheme=o?"dark":"light";}
aplicar();
m.addEventListener("change",function(){if(!elegido())aplicar();});
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // El script de arriba cambia la clase de <html> antes de hidratar: sin
    // esto React avisa que no coincide con lo que mandó el servidor.
    <html
      lang="es-AR"
      className={`${inter.variable} ${baloo.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
