import { z } from "zod";

/**
 * La cuenta de cuánto cuesta hacer un producto y a cuánto venderlo.
 *
 * La usan Migue —cuando un feriante le pregunta cuánto cobrar— y la pestaña
 * «Precios y costos» de Mi stand. Es código y no el modelo a propósito: un
 * modelo de lenguaje se equivoca en las cuentas, y acá un error es un feriante
 * que vende a pérdida. Migue junta los datos conversando; la cuenta la hace
 * esto, y él repite el resultado.
 *
 * Todo se calcula sobre una **tanda**: lo que sale de una producción (una
 * hornada, una olla, una tirada). Es como piensa quien produce —«con un kilo
 * de harina me salen 40 alfajores»— y de ahí se baja a la unidad.
 */

/** Unidades en que se compra y se usa un insumo. */
export const UNIDADES = ["g", "kg", "ml", "l", "unidad"] as const;
export type Unidad = (typeof UNIDADES)[number];

export const ETIQUETAS_UNIDAD: Record<Unidad, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  unidad: "unidades",
};

/** Cada unidad, en la unidad base de su magnitud (g, ml o unidades). */
const EN_BASE: Record<Unidad, { magnitud: string; factor: number }> = {
  g: { magnitud: "peso", factor: 1 },
  kg: { magnitud: "peso", factor: 1000 },
  ml: { magnitud: "volumen", factor: 1 },
  l: { magnitud: "volumen", factor: 1000 },
  unidad: { magnitud: "cantidad", factor: 1 },
};

const monto = z.coerce
  .number({ invalid_type_error: "Tiene que ser un número." })
  .min(0, "No puede ser negativo.")
  .max(100_000_000, "Es demasiado grande.");

const cantidad = z.coerce
  .number({ invalid_type_error: "Tiene que ser un número." })
  .positive("Tiene que ser mayor que cero.")
  .max(1_000_000, "Es demasiado grande.");

export const insumoSchema = z.object({
  nombre: z.string().trim().min(1, "Poné qué es.").max(80),
  /** Lo que pagó. */
  precio: monto,
  /**
   * Cuánto compró por ese precio y cuánto usa en una tanda. Si faltan, el
   * precio es directamente lo que cuesta lo que usa.
   */
  cantidadComprada: cantidad.nullish(),
  unidadComprada: z.enum(UNIDADES).nullish(),
  cantidadUsada: cantidad.nullish(),
  unidadUsada: z.enum(UNIDADES).nullish(),
});

export const otroCostoSchema = z.object({
  nombre: z.string().trim().min(1, "Poné qué es.").max(80),
  monto,
});

export const datosDeCostosSchema = z.object({
  /** Cuántas unidades salen de una tanda. */
  unidades: z.coerce
    .number({ invalid_type_error: "Tiene que ser un número." })
    .int("Tiene que ser un número entero.")
    .min(1, "Tiene que salir al menos una unidad.")
    .max(100_000),
  insumos: z.array(insumoSchema).max(40),
  /** Minutos de trabajo por tanda. */
  minutos: z.coerce
    .number({ invalid_type_error: "Tiene que ser un número." })
    .min(0, "No puede ser negativo.")
    .max(60 * 24 * 30),
  /** Lo que quiere cobrar por hora de trabajo. Lo decide el feriante. */
  valorHora: monto,
  otros: z.array(otroCostoSchema).max(20),
  /** Ganancia buscada, en porcentaje sobre el costo. */
  margen: z.coerce
    .number({ invalid_type_error: "Tiene que ser un número." })
    .min(0, "No puede ser negativo.")
    .max(1000, "Es demasiado."),
  /** Lo que le cuesta ir a un día de feria: traslado, armado. Opcional. */
  costoDelDia: monto.nullish(),
  /** A cuánto lo vende hoy. Opcional. */
  precioActual: monto.nullish(),
});

export type Insumo = z.infer<typeof insumoSchema>;
export type OtroCosto = z.infer<typeof otroCostoSchema>;
export type DatosDeCostos = z.infer<typeof datosDeCostosSchema>;

export interface ResultadoDeCostos {
  /** Lo que cuesta cada insumo en una tanda. */
  insumos: Array<{ nombre: string; costo: number }>;
  tanda: {
    insumos: number;
    trabajo: number;
    otros: number;
    total: number;
  };
  porUnidad: {
    insumos: number;
    trabajo: number;
    otros: number;
    total: number;
  };
  /** Costo por unidad más la ganancia buscada, sin redondear. */
  precioExacto: number;
  /** El exacto redondeado hacia arriba a un número cómodo de cobrar. */
  precioSugerido: number;
  /** Lo que le queda por unidad al precio sugerido, ya pagada su hora. */
  gananciaPorUnidad: number;
  /** Con el precio de hoy, si lo dio. */
  conPrecioActual: {
    precio: number;
    gananciaPorUnidad: number;
    /** En porcentaje sobre el costo. Negativo es que pierde. */
    margen: number;
  } | null;
  /**
   * Cuántas unidades tiene que vender en un día de feria para cubrir lo que
   * le cuesta ir, al precio sugerido. `null` si no dio ese costo.
   */
  paraCubrirElDia: number | null;
}

/** Dos decimales, que es lo que tiene la plata. */
function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Hacia arriba, a un número que se pueda cobrar sin vuelto raro: de a $10
 * hasta mil, de a $50 hasta diez mil y de a $100 de ahí para arriba. Siempre
 * hacia arriba: redondear para abajo come justo la ganancia.
 */
export function redondearPrecio(precio: number): number {
  if (precio <= 0) return 0;
  const paso = precio < 1000 ? 10 : precio < 10_000 ? 50 : 100;
  return Math.ceil(precio / paso - 1e-9) * paso;
}

/** Lo que cuesta lo que se usa de un insumo en una tanda. */
export function costoDelInsumo(insumo: Insumo): number | { error: string } {
  const {
    precio,
    cantidadComprada,
    unidadComprada,
    cantidadUsada,
    unidadUsada,
  } = insumo;

  if (!cantidadComprada || !cantidadUsada) return centavos(precio);

  const comprada = EN_BASE[unidadComprada ?? "unidad"];
  const usada = EN_BASE[unidadUsada ?? unidadComprada ?? "unidad"];
  if (comprada.magnitud !== usada.magnitud) {
    return {
      error: `En «${insumo.nombre}» no se puede comparar ${ETIQUETAS_UNIDAD[unidadComprada ?? "unidad"]} con ${ETIQUETAS_UNIDAD[unidadUsada ?? "unidad"]}.`,
    };
  }

  return centavos(
    (precio * cantidadUsada * usada.factor) /
      (cantidadComprada * comprada.factor),
  );
}

export function calcularCostos(
  datos: DatosDeCostos,
): ResultadoDeCostos | { error: string } {
  const insumos: ResultadoDeCostos["insumos"] = [];
  for (const insumo of datos.insumos) {
    const costo = costoDelInsumo(insumo);
    if (typeof costo !== "number") return costo;
    insumos.push({ nombre: insumo.nombre, costo });
  }

  const tanda = {
    insumos: centavos(insumos.reduce((suma, insumo) => suma + insumo.costo, 0)),
    trabajo: centavos((datos.minutos / 60) * datos.valorHora),
    otros: centavos(datos.otros.reduce((suma, otro) => suma + otro.monto, 0)),
    total: 0,
  };
  tanda.total = centavos(tanda.insumos + tanda.trabajo + tanda.otros);

  const porUnidad = {
    insumos: centavos(tanda.insumos / datos.unidades),
    trabajo: centavos(tanda.trabajo / datos.unidades),
    otros: centavos(tanda.otros / datos.unidades),
    total: centavos(tanda.total / datos.unidades),
  };

  const precioExacto = centavos(porUnidad.total * (1 + datos.margen / 100));
  const precioSugerido = redondearPrecio(precioExacto);
  const gananciaPorUnidad = centavos(precioSugerido - porUnidad.total);

  const conPrecioActual =
    datos.precioActual != null && datos.precioActual > 0
      ? {
          precio: datos.precioActual,
          gananciaPorUnidad: centavos(datos.precioActual - porUnidad.total),
          margen:
            porUnidad.total > 0
              ? Math.round(
                  ((datos.precioActual - porUnidad.total) / porUnidad.total) *
                    100,
                )
              : 0,
        }
      : null;

  const paraCubrirElDia =
    datos.costoDelDia != null && datos.costoDelDia > 0 && gananciaPorUnidad > 0
      ? Math.ceil(datos.costoDelDia / gananciaPorUnidad - 1e-9)
      : null;

  return {
    insumos,
    tanda,
    porUnidad,
    precioExacto,
    precioSugerido,
    gananciaPorUnidad,
    conPrecioActual,
    paraCubrirElDia,
  };
}
