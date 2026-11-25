"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useAsistente,
  type TurnoDeMigue,
} from "@/components/public/estado-asistente";
import { estilosBoton } from "@/components/ui/boton";

/**
 * La primera pregunta del cálculo de precios con Migue.
 *
 * La arma la pantalla y no el modelo: es siempre la misma, así que aparece al
 * instante y no se paga. Las que siguen sí las hace Migue, con la guía de
 * `ia-asistente-feriante.ts`. Los botones son sus productos sin ficha; si el
 * que quiere calcular no está, lo escribe.
 */
export function primeraPregunta(productos: string[]): TurnoDeMigue {
  if (productos.length === 0) {
    return {
      texto:
        "Vamos a calcular a cuánto te conviene vender uno de tus productos. ¿Cuál es? Por ejemplo: «alfajores de maicena».",
    };
  }
  return {
    texto:
      "Vamos a calcular a cuánto te conviene vender uno de tus productos. ¿Cuál es? Si no está acá abajo, escribí su nombre.",
    opciones: productos,
  };
}

/**
 * El atajo de «Precios y costos»: abre a Migue con la primera pregunta. El
 * formulario sigue a mano para quien prefiere completarlo solo.
 */
export function CalcularConMigue({ productos }: { productos: string[] }) {
  const asistente = useAsistente();
  if (!asistente) return null;

  return (
    <section className="mb-6 flex flex-col gap-4 rounded-xl border border-municipal-100 bg-municipal-50 p-5 sm:flex-row sm:items-center">
      <span className="paleta-original size-16 shrink-0 overflow-hidden rounded-full bg-municipal-500">
        <Image
          src="/migue-cara.webp"
          alt=""
          width={320}
          height={320}
          className="size-full object-cover"
        />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-slate-900">
          Migue te ayuda a calcular el precio de tus productos
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Te hace unas preguntas simples, de a una, y al final te dice el precio
          recomendado.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="button"
          onClick={() => asistente.presentar(primeraPregunta(productos))}
          className={estilosBoton("primario")}
        >
          Calcular un precio con Migue
        </button>
        <Link
          href="/mi-stand/costos/nueva"
          className="text-sm font-medium text-municipal-600 hover:text-municipal-700"
        >
          Prefiero completarlo yo
        </Link>
      </div>
    </section>
  );
}
