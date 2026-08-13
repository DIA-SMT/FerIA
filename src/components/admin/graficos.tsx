import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/cn";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { formatearNumero } from "@/lib/format";

/**
 * Gráficos del panel, dibujados con SVG y utilidades de Tailwind.
 *
 * Son componentes de servidor sin dependencias externas: para las métricas de
 * este panel (barras, ocupación y una dona) alcanza de sobra, no suma peso al
 * bundle y respeta exactamente la paleta institucional.
 */

// ---------------------------------------------------------------------------
// Tarjeta de métrica
// ---------------------------------------------------------------------------

interface PropsMetrica {
  etiqueta: string;
  valor: string | number;
  detalle?: ReactNode;
  icono?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Resalta la tarjeta cuando el dato requiere atención. */
  tono?: "neutro" | "azul" | "amarillo" | "rojo" | "verde";
}

const TONOS_METRICA = {
  neutro: { caja: "border-slate-200", icono: "bg-slate-100 text-slate-500" },
  azul: {
    caja: "border-municipal-200",
    icono: "bg-municipal-50 text-municipal-600",
  },
  amarillo: {
    caja: "border-acento-300",
    icono: "bg-acento-50 text-acento-700",
  },
  rojo: { caja: "border-red-200", icono: "bg-red-50 text-red-600" },
  verde: {
    caja: "border-emerald-200",
    icono: "bg-emerald-50 text-emerald-600",
  },
} as const;

export function TarjetaMetrica({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  tono = "neutro",
}: PropsMetrica) {
  const estilos = TONOS_METRICA[tono];

  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-sm", estilos.caja)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{etiqueta}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            {typeof valor === "number" ? formatearNumero(valor) : valor}
          </p>
        </div>
        {Icono && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              estilos.icono,
            )}
          >
            <Icono className="size-5" />
          </span>
        )}
      </div>
      {detalle && <div className="mt-2 text-xs text-slate-500">{detalle}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráfico de barras horizontales
// ---------------------------------------------------------------------------

export interface Barra {
  etiqueta: string;
  valor: number;
  /** Texto que reemplaza al número a la derecha (ej. un importe formateado). */
  valorTexto?: string;
}

export function GraficoBarras({
  datos,
  color = "municipal",
  vacio = "Sin datos para mostrar.",
}: {
  datos: Barra[];
  color?: "municipal" | "celeste" | "acento";
  vacio?: string;
}) {
  if (datos.length === 0) {
    return <EstadoVacio titulo="Sin datos" descripcion={vacio} />;
  }

  const maximo = Math.max(...datos.map((dato) => dato.valor), 1);

  const COLORES = {
    municipal: "bg-municipal-500",
    celeste: "bg-celeste-400",
    acento: "bg-acento-400",
  } as const;

  return (
    <ul className="space-y-3">
      {datos.map((dato) => {
        const porcentaje = Math.round((dato.valor / maximo) * 100);

        return (
          <li key={dato.etiqueta}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">
                {dato.etiqueta}
              </span>
              <span className="shrink-0 font-semibold text-slate-900 tabular-nums">
                {dato.valorTexto ?? formatearNumero(dato.valor)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", COLORES[color])}
                style={{ width: `${Math.max(porcentaje, dato.valor > 0 ? 3 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Dona de ocupación
// ---------------------------------------------------------------------------

export function GraficoDona({
  valor,
  total,
  etiqueta,
  etiquetaResto,
}: {
  valor: number;
  total: number;
  etiqueta: string;
  etiquetaResto: string;
}) {
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  const proporcion = total > 0 ? valor / total : 0;
  const porcentaje = Math.round(proporcion * 100);

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="size-28 -rotate-90"
          role="img"
          aria-label={`${valor} de ${total} (${porcentaje} por ciento)`}
        >
          <circle
            cx="50"
            cy="50"
            r={radio}
            fill="none"
            strokeWidth="12"
            className="stroke-slate-100"
          />
          {valor > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radio}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${proporcion * circunferencia} ${circunferencia}`}
              className="stroke-municipal-500"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{porcentaje}%</span>
        </div>
      </div>

      <dl className="min-w-0 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full bg-municipal-500"
            aria-hidden="true"
          />
          <dt className="text-slate-600">{etiqueta}</dt>
          <dd className="font-semibold text-slate-900 tabular-nums">{valor}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full bg-slate-200"
            aria-hidden="true"
          />
          <dt className="text-slate-600">{etiquetaResto}</dt>
          <dd className="font-semibold text-slate-900 tabular-nums">
            {total - valor}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra de ocupación compacta (para listados de ediciones)
// ---------------------------------------------------------------------------

export function BarraOcupacion({
  ocupados,
  total,
  className,
}: {
  ocupados: number;
  total: number;
  className?: string;
}) {
  const porcentaje = total > 0 ? Math.round((ocupados / total) * 100) : 0;

  // Cerca del lleno se pinta en amarillo y completo en verde, para que el
  // estado se lea de un vistazo en la grilla.
  const color =
    porcentaje >= 100
      ? "bg-emerald-500"
      : porcentaje >= 80
        ? "bg-acento-400"
        : "bg-municipal-500";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <span className="text-xs whitespace-nowrap text-slate-600 tabular-nums">
        {ocupados}/{total}
      </span>
    </div>
  );
}
