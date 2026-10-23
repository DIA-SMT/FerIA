import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Tipografía institucional.
 * Inter tiene muy buena legibilidad en pantallas chicas, que es por donde
 * entra la mayoría de los vecinos.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--fuente-institucional",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
