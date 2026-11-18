"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { guardarFichaDeCostos } from "@/actions/costos";
import { Alerta } from "@/components/ui/alerta";
import { Boton, estilosBoton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { IconoMas } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { cn } from "@/lib/cn";
import {
  calcularCostos,
  datosDeCostosSchema,
  ETIQUETAS_UNIDAD,
  UNIDADES,
  type DatosDeCostos,
  type Unidad,
} from "@/lib/costos";
import { ESTADO_INICIAL } from "@/lib/form";
import { formatearMoneda } from "@/lib/format";

/**
 * Armar o editar una ficha de costos.
 *
 * La cuenta se ve mientras se completa, a la derecha (abajo en el celular):
 * el feriante ve cómo cambia el precio al tocar el margen o el valor de su
 * hora. Es la misma cuenta que hace Migue (`src/lib/costos.ts`), corriendo en
 * el navegador; al guardar, el servidor la vuelve a validar.
 *
 * Los campos se manejan como texto mientras se escriben —un número a medio
 * escribir no es un número— y se convierten recién para la cuenta.
 */

interface FilaInsumo {
  nombre: string;
  precio: string;
  cantidadComprada: string;
  unidadComprada: Unidad;
  cantidadUsada: string;
  unidadUsada: Unidad;
}

interface FilaOtro {
  nombre: string;
  monto: string;
}

const INSUMO_VACIO: FilaInsumo = {
  nombre: "",
  precio: "",
  cantidadComprada: "",
  unidadComprada: "kg",
  cantidadUsada: "",
  unidadUsada: "g",
};

const OTRO_VACIO: FilaOtro = { nombre: "", monto: "" };

/** «1.250,5» o «1250.5» → 1250.5. Vacío → null. */
function numero(texto: string): number | null {
  const limpio = texto.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!limpio) return null;
  // Con coma decimal (es-AR), los puntos son de miles.
  const normal = limpio.includes(",")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio;
  const valor = Number(normal);
  return Number.isFinite(valor) ? valor : null;
}

const texto = (valor: number | null | undefined) =>
  valor == null ? "" : String(valor);

const plata = (valor: number) => formatearMoneda(valor, { centavos: true });

export interface FichaInicial {
  id?: string;
  nombre: string;
  productoId: string | null;
  datos: DatosDeCostos | null;
}

export function FormularioCostos({
  ficha,
  productos,
}: {
  ficha: FichaInicial;
  /** Sus productos, para enganchar la ficha a uno del catálogo. */
  productos: Array<{ id: string; nombre: string }>;
}) {
  const [estado, enviar, enviando] = useActionState(
    guardarFichaDeCostos,
    ESTADO_INICIAL,
  );

  const inicial = ficha.datos;
  const [nombre, setNombre] = useState(ficha.nombre);
  const [productoId, setProductoId] = useState(ficha.productoId ?? "");
  const [unidades, setUnidades] = useState(texto(inicial?.unidades));
  const [insumos, setInsumos] = useState<FilaInsumo[]>(
    inicial && inicial.insumos.length > 0
      ? inicial.insumos.map((insumo) => ({
          nombre: insumo.nombre,
          precio: texto(insumo.precio),
          cantidadComprada: texto(insumo.cantidadComprada),
          unidadComprada: insumo.unidadComprada ?? "kg",
          cantidadUsada: texto(insumo.cantidadUsada),
          unidadUsada: insumo.unidadUsada ?? insumo.unidadComprada ?? "g",
        }))
      : [{ ...INSUMO_VACIO }],
  );
  const [horas, setHoras] = useState(
    inicial ? texto(Math.floor(inicial.minutos / 60)) : "",
  );
  const [minutos, setMinutos] = useState(
    inicial ? texto(Math.round(inicial.minutos % 60)) : "",
  );
  const [valorHora, setValorHora] = useState(texto(inicial?.valorHora));
  const [otros, setOtros] = useState<FilaOtro[]>(
    inicial && inicial.otros.length > 0
      ? inicial.otros.map((otro) => ({
          nombre: otro.nombre,
          monto: texto(otro.monto),
        }))
      : [{ ...OTRO_VACIO }],
  );
  const [margen, setMargen] = useState(texto(inicial?.margen ?? 50));
  const [costoDelDia, setCostoDelDia] = useState(texto(inicial?.costoDelDia));
  const [precioActual, setPrecioActual] = useState(
    texto(inicial?.precioActual),
  );

  // Los datos como los espera la cuenta. Las filas vacías no cuentan: una
  // fila nueva sin completar no tiene que dar error.
  const datos = useMemo(
    () => ({
      unidades: numero(unidades) ?? 0,
      insumos: insumos
        .filter((fila) => fila.nombre.trim() || fila.precio.trim())
        .map((fila) => {
          const comprada = numero(fila.cantidadComprada);
          const usada = numero(fila.cantidadUsada);
          const conCantidades = comprada != null && usada != null;
          return {
            nombre: fila.nombre.trim() || "Insumo",
            precio: numero(fila.precio) ?? 0,
            cantidadComprada: conCantidades ? comprada : null,
            unidadComprada: conCantidades ? fila.unidadComprada : null,
            cantidadUsada: conCantidades ? usada : null,
            unidadUsada: conCantidades ? fila.unidadUsada : null,
          };
        }),
      minutos: (numero(horas) ?? 0) * 60 + (numero(minutos) ?? 0),
      valorHora: numero(valorHora) ?? 0,
      otros: otros
        .filter((fila) => fila.nombre.trim() || fila.monto.trim())
        .map((fila) => ({
          nombre: fila.nombre.trim() || "Otro",
          monto: numero(fila.monto) ?? 0,
        })),
      margen: numero(margen) ?? 0,
      costoDelDia: numero(costoDelDia),
      precioActual: numero(precioActual),
    }),
    [
      unidades,
      insumos,
      horas,
      minutos,
      valorHora,
      otros,
      margen,
      costoDelDia,
      precioActual,
    ],
  );

  const leidos = datosDeCostosSchema.safeParse(datos);
  const resultado = leidos.success ? calcularCostos(leidos.data) : null;
  const listo = resultado !== null && !("error" in resultado);

  function cambiarInsumo(indice: number, cambios: Partial<FilaInsumo>) {
    setInsumos((filas) =>
      filas.map((fila, posicion) =>
        posicion === indice ? { ...fila, ...cambios } : fila,
      ),
    );
  }

  function cambiarOtro(indice: number, cambios: Partial<FilaOtro>) {
    setOtros((filas) =>
      filas.map((fila, posicion) =>
        posicion === indice ? { ...fila, ...cambios } : fila,
      ),
    );
  }

  return (
    <form action={enviar} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {ficha.id && <input type="hidden" name="id" value={ficha.id} />}
      <input type="hidden" name="datos" value={JSON.stringify(datos)} />

      <div className="space-y-5">
        {estado.ok === false && estado.mensaje && (
          <Alerta tipo="error">{estado.mensaje}</Alerta>
        )}

        <Seccion
          numero={1}
          titulo="El producto"
          descripcion="Todo se cuenta por tanda: lo que sale de una producción, una hornada o una olla."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo htmlFor="nombre" etiqueta="Nombre" requerido>
              <Entrada
                name="nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                placeholder="Ej. Alfajores de maicena"
                maxLength={120}
                required
              />
            </Campo>
            {productos.length > 0 && (
              <Campo
                htmlFor="productoId"
                etiqueta="¿Es de tu catálogo?"
                ayuda="Opcional. Sirve para encontrarla después."
              >
                <select
                  id="productoId"
                  name="productoId"
                  value={productoId}
                  onChange={(evento) => {
                    setProductoId(evento.target.value);
                    const elegido = productos.find(
                      (producto) => producto.id === evento.target.value,
                    );
                    if (elegido && !nombre.trim()) setNombre(elegido.nombre);
                  }}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-superficie px-3 text-sm text-slate-900 focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none"
                >
                  <option value="">No, es otro</option>
                  {productos.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo
              htmlFor="unidades"
              etiqueta="¿Cuántas unidades te salen de una tanda?"
              requerido
            >
              <Entrada
                name="unidades"
                inputMode="numeric"
                value={unidades}
                onChange={(evento) => setUnidades(evento.target.value)}
                placeholder="Ej. 40"
              />
            </Campo>
          </div>
        </Seccion>

        <Seccion
          numero={2}
          titulo="La materia prima"
          descripcion="Lo que pagaste y por cuánto, y lo que usás en una tanda. Si ya sabés cuánto te cuesta lo que usás, poné eso en «Pagaste» y dejá las cantidades vacías."
        >
          <div className="space-y-3">
            {insumos.map((fila, indice) => {
              const costo =
                resultado && !("error" in resultado)
                  ? resultado.insumos[indice]?.costo
                  : undefined;
              return (
                <div
                  key={indice}
                  className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 sm:items-end xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto]"
                >
                  <MiniCampo etiqueta="Insumo">
                    <input
                      value={fila.nombre}
                      onChange={(evento) =>
                        cambiarInsumo(indice, { nombre: evento.target.value })
                      }
                      placeholder="Harina"
                      className={CONTROL}
                      aria-label={`Insumo ${indice + 1}`}
                    />
                  </MiniCampo>
                  <MiniCampo etiqueta="Pagaste $">
                    <input
                      value={fila.precio}
                      inputMode="decimal"
                      onChange={(evento) =>
                        cambiarInsumo(indice, { precio: evento.target.value })
                      }
                      placeholder="1200"
                      className={CONTROL}
                      aria-label={`Lo que pagaste por el insumo ${indice + 1}`}
                    />
                  </MiniCampo>
                  <MiniCampo etiqueta="Por">
                    <CantidadConUnidad
                      cantidad={fila.cantidadComprada}
                      unidad={fila.unidadComprada}
                      onCantidad={(valor) =>
                        cambiarInsumo(indice, { cantidadComprada: valor })
                      }
                      onUnidad={(valor) =>
                        cambiarInsumo(indice, { unidadComprada: valor })
                      }
                      placeholder="1"
                      etiqueta={`Cuánto compraste del insumo ${indice + 1}`}
                    />
                  </MiniCampo>
                  <MiniCampo etiqueta="Usás por tanda">
                    <CantidadConUnidad
                      cantidad={fila.cantidadUsada}
                      unidad={fila.unidadUsada}
                      onCantidad={(valor) =>
                        cambiarInsumo(indice, { cantidadUsada: valor })
                      }
                      onUnidad={(valor) =>
                        cambiarInsumo(indice, { unidadUsada: valor })
                      }
                      placeholder="500"
                      etiqueta={`Cuánto usás del insumo ${indice + 1}`}
                    />
                  </MiniCampo>
                  <div className="flex items-center justify-between gap-2 sm:col-span-2 xl:col-span-1 xl:flex-col xl:items-end xl:justify-end">
                    <span className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
                      {costo != null ? plata(costo) : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setInsumos((filas) =>
                          filas.length === 1
                            ? [{ ...INSUMO_VACIO }]
                            : filas.filter(
                                (_, posicion) => posicion !== indice,
                              ),
                        )
                      }
                      className="text-xs font-medium text-slate-500 hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setInsumos((filas) => [...filas, { ...INSUMO_VACIO }])
              }
              className={estilosBoton("contorno", "sm")}
            >
              <IconoMas className="size-4" />
              Agregar insumo
            </button>
            {resultado && "error" in resultado && (
              <p className="text-sm font-medium text-red-600">
                {resultado.error}
              </p>
            )}
          </div>
        </Seccion>

        <Seccion
          numero={3}
          titulo="Tu trabajo"
          descripcion="Cuánto te lleva una tanda y cuánto querés cobrar tu hora. Ese valor lo decidís vos."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo htmlFor="horas" etiqueta="Horas">
              <Entrada
                name="horas"
                inputMode="numeric"
                value={horas}
                onChange={(evento) => setHoras(evento.target.value)}
                placeholder="2"
              />
            </Campo>
            <Campo htmlFor="minutos" etiqueta="Minutos">
              <Entrada
                name="minutos"
                inputMode="numeric"
                value={minutos}
                onChange={(evento) => setMinutos(evento.target.value)}
                placeholder="30"
              />
            </Campo>
            <Campo htmlFor="valorHora" etiqueta="Tu hora, $">
              <Entrada
                name="valorHora"
                inputMode="decimal"
                value={valorHora}
                onChange={(evento) => setValorHora(evento.target.value)}
              />
            </Campo>
          </div>
        </Seccion>

        <Seccion
          numero={4}
          titulo="Otros costos de la tanda"
          descripcion="Envases, etiquetas, gas, luz. Participar de las ferias no cuesta nada: no hay canon ni alquiler."
        >
          <div className="space-y-3">
            {otros.map((fila, indice) => (
              <div key={indice} className="flex items-end gap-2">
                <MiniCampo etiqueta="Qué es" className="min-w-0 flex-1">
                  <input
                    value={fila.nombre}
                    onChange={(evento) =>
                      cambiarOtro(indice, { nombre: evento.target.value })
                    }
                    placeholder="Envoltorios"
                    className={CONTROL}
                    aria-label={`Otro costo ${indice + 1}`}
                  />
                </MiniCampo>
                <MiniCampo etiqueta="$" className="w-32">
                  <input
                    value={fila.monto}
                    inputMode="decimal"
                    onChange={(evento) =>
                      cambiarOtro(indice, { monto: evento.target.value })
                    }
                    placeholder="400"
                    className={CONTROL}
                    aria-label={`Monto del otro costo ${indice + 1}`}
                  />
                </MiniCampo>
                <button
                  type="button"
                  onClick={() =>
                    setOtros((filas) =>
                      filas.length === 1
                        ? [{ ...OTRO_VACIO }]
                        : filas.filter((_, posicion) => posicion !== indice),
                    )
                  }
                  className="h-10 text-xs font-medium text-slate-500 hover:text-red-600"
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOtros((filas) => [...filas, { ...OTRO_VACIO }])}
              className={estilosBoton("contorno", "sm")}
            >
              <IconoMas className="size-4" />
              Agregar otro costo
            </button>
          </div>
        </Seccion>

        <Seccion
          numero={5}
          titulo="Tu ganancia"
          descripcion="Cuánto le querés ganar, sobre lo que te cuesta. Lo de abajo es opcional."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo htmlFor="margen" etiqueta="Ganancia, %" requerido>
              <Entrada
                name="margen"
                inputMode="decimal"
                value={margen}
                onChange={(evento) => setMargen(evento.target.value)}
              />
            </Campo>
            <Campo
              htmlFor="costoDelDia"
              etiqueta="Ir a un día de feria, $"
              ayuda="Traslado, armado."
            >
              <Entrada
                name="costoDelDia"
                inputMode="decimal"
                value={costoDelDia}
                onChange={(evento) => setCostoDelDia(evento.target.value)}
              />
            </Campo>
            <Campo htmlFor="precioActual" etiqueta="Lo vendés hoy a, $">
              <Entrada
                name="precioActual"
                inputMode="decimal"
                value={precioActual}
                onChange={(evento) => setPrecioActual(evento.target.value)}
              />
            </Campo>
          </div>
        </Seccion>

        <div className="flex flex-wrap items-center gap-3">
          <Boton type="submit" disabled={enviando || !listo}>
            {enviando ? "Guardando…" : "Guardar ficha"}
          </Boton>
          <Link
            href="/mi-stand/costos"
            className={estilosBoton("fantasma", "md")}
          >
            Cancelar
          </Link>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Tarjeta>
          <TarjetaCuerpo className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              La cuenta
            </h2>
            {listo && resultado && !("error" in resultado) ? (
              <>
                <div>
                  <p className="text-sm text-slate-500">Precio sugerido</p>
                  <p className="text-3xl font-bold tracking-tight text-municipal-700 tabular-nums">
                    {plata(resultado.precioSugerido)}
                  </p>
                  <p className="text-sm text-slate-600">
                    Le ganás {plata(resultado.gananciaPorUnidad)} por unidad, ya
                    pagada tu hora.
                  </p>
                </div>
                <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                  <Fila
                    titulo="Materia prima"
                    valor={plata(resultado.porUnidad.insumos)}
                  />
                  <Fila
                    titulo="Tu trabajo"
                    valor={plata(resultado.porUnidad.trabajo)}
                  />
                  <Fila
                    titulo="Otros"
                    valor={plata(resultado.porUnidad.otros)}
                  />
                  <Fila
                    titulo="Te cuesta cada una"
                    valor={plata(resultado.porUnidad.total)}
                    fuerte
                  />
                </dl>
                {resultado.conPrecioActual && (
                  <p
                    className={cn(
                      "rounded-lg p-3 text-sm",
                      resultado.conPrecioActual.gananciaPorUnidad < 0
                        ? "bg-red-50 text-red-800"
                        : "bg-slate-50 text-slate-700",
                    )}
                  >
                    {resultado.conPrecioActual.gananciaPorUnidad < 0
                      ? `A ${plata(resultado.conPrecioActual.precio)} perdés ${plata(-resultado.conPrecioActual.gananciaPorUnidad)} por unidad.`
                      : `A ${plata(resultado.conPrecioActual.precio)} le ganás ${plata(resultado.conPrecioActual.gananciaPorUnidad)} por unidad (${resultado.conPrecioActual.margen} % sobre el costo).`}
                  </p>
                )}
                {resultado.paraCubrirElDia && (
                  <p className="text-sm text-slate-600">
                    Para cubrir el día de feria tenés que vender{" "}
                    {resultado.paraCubrirElDia} al precio sugerido.
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  Es una cuenta orientativa.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Completá las unidades de la tanda y lo que vayas sabiendo: la
                cuenta aparece acá.
              </p>
            )}
          </TarjetaCuerpo>
        </Tarjeta>
      </aside>
    </form>
  );
}

const CONTROL =
  "h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-superficie px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none";

function Seccion({
  numero,
  titulo,
  descripcion,
  children,
}: {
  numero: number;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <Tarjeta>
      <TarjetaCuerpo>
        <section className="flex gap-3">
          <span
            className="paleta-original mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-municipal-500 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {numero}
          </span>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h2 className="font-semibold text-slate-900">{titulo}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>
            </div>
            {children}
          </div>
        </section>
      </TarjetaCuerpo>
    </Tarjeta>
  );
}

function MiniCampo({
  etiqueta,
  className,
  children,
}: {
  etiqueta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="block text-xs font-medium text-slate-500">
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

function CantidadConUnidad({
  cantidad,
  unidad,
  onCantidad,
  onUnidad,
  placeholder,
  etiqueta,
}: {
  cantidad: string;
  unidad: Unidad;
  onCantidad: (valor: string) => void;
  onUnidad: (valor: Unidad) => void;
  placeholder: string;
  etiqueta: string;
}) {
  return (
    <div className="flex gap-1.5">
      <input
        value={cantidad}
        inputMode="decimal"
        onChange={(evento) => onCantidad(evento.target.value)}
        placeholder={placeholder}
        className={cn(CONTROL, "w-20")}
        aria-label={etiqueta}
      />
      <select
        value={unidad}
        onChange={(evento) => onUnidad(evento.target.value as Unidad)}
        className={cn(CONTROL, "w-auto px-2")}
        aria-label={`Unidad: ${etiqueta}`}
      >
        {UNIDADES.map((opcion) => (
          <option key={opcion} value={opcion}>
            {ETIQUETAS_UNIDAD[opcion]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Fila({
  titulo,
  valor,
  fuerte = false,
}: {
  titulo: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        fuerte &&
          "border-t border-slate-100 pt-1.5 font-semibold text-slate-900",
      )}
    >
      <dt className={fuerte ? "" : "text-slate-500"}>{titulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}
