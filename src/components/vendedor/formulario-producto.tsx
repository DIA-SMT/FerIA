"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useCallback, useState, type ReactNode } from "react";

import type { Variante } from "@/lib/fotos-producto";
import { AvisoDelEnvio } from "@/components/ui/aviso-flotante";
import { estilosBoton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo, Casilla, Entrada } from "@/components/ui/campo";
import { AsistenteDeDescripcion } from "@/components/vendedor/asistente-de-descripcion";
import { SelectorDeFoto } from "@/components/vendedor/selector-de-foto";
import { IconoCerrar } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo, TarjetaPie } from "@/components/ui/tarjeta";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/lib/form";
import { urlPublica } from "@/lib/media";

const MAXIMO_IMAGENES = 4;

export interface ValoresProducto {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagenes: string[];
  disponible: boolean;
  destacado: boolean;
  /** Ya convertido a `number`: un `Decimal` de Prisma no cruza al cliente. */
  precio: number | null;
  stock: number | null;
}

interface PropsFormularioProducto {
  accion: (
    estado: EstadoFormulario,
    datos: FormData,
  ) => Promise<EstadoFormulario>;
  producto?: ValoresProducto;
  /**
   * Si la plataforma tiene la IA configurada. Viaja de parada en parada desde
   * la página hasta `SelectorDeFoto`, que es quien ofrece mejorar la foto:
   * `hayIAConfigurada()` lee `process.env` del servidor y esto es un componente
   * de cliente, así que no puede consultarlo por su cuenta.
   */
  hayIA?: boolean;
  /**
   * Si el marketplace está habilitado. Viaja igual que `hayIA` y por el mismo
   * motivo: `hayPreciosPublicos()` lee el entorno del servidor.
   */
  conPrecios?: boolean;
}

export function FormularioProducto({
  accion,
  producto,
  hayIA = true,
  conPrecios = false,
}: PropsFormularioProducto) {
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL);
  const errores = estado.errores;

  // Fotos ya guardadas que el feriante decide conservar. Se envían al servidor
  // en un único campo separado por comas; las que se quitan se borran del disco.
  const [conservadas, setConservadas] = useState<string[]>(
    producto?.imagenes ?? [],
  );

  // Fotos nuevas que ya pasaron por el selector. Las variantes están subidas a
  // Storage, así que acá sólo viajan sus rutas.
  const [nuevas, setNuevas] = useState<Variante[]>([]);

  // Rutas de variantes que quedaron sin elegir. Al guardar se borran: es lo que
  // evita que cada foto deje dos o tres huérfanas en el bucket.
  const [descartadas, setDescartadas] = useState<string[]>([]);

  // El nombre y la descripción alimentan el prompt de la IA, así que el selector
  // necesita leerlos en vivo mientras el feriante los escribe.
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");

  const espacioLibre = MAXIMO_IMAGENES - conservadas.length - nuevas.length;

  // Estable (`useCallback`) porque el selector lo tiene entre las dependencias
  // del efecto que procesa cada foto que vuelve del servidor.
  const alConfirmarFoto = useCallback(
    (elegida: Variante | null, sinElegir: string[], reemplaza?: string) => {
      if (elegida) {
        setNuevas((actuales) =>
          reemplaza && actuales.some((v) => v.ruta === reemplaza)
            ? actuales.map((v) => (v.ruta === reemplaza ? elegida : v))
            : [...actuales, elegida],
        );
      }
      setDescartadas((actuales) => [...actuales, ...sinElegir]);
    },
    [],
  );

  /** Quitar una foto nueva: su ruta pasa a la lista de descartadas. */
  function quitarNueva(ruta: string): void {
    setNuevas((actuales) => actuales.filter((v) => v.ruta !== ruta));
    setDescartadas((actuales) => [...actuales, ruta]);
  }

  return (
    <form action={enviar} className="space-y-5" noValidate>
      {producto && (
        <input type="hidden" name="productoId" value={producto.id} />
      )}
      <input
        type="hidden"
        name="imagenesActuales"
        value={conservadas.join(",")}
      />
      <input
        type="hidden"
        name="imagenesNuevas"
        value={nuevas.map((v) => v.ruta).join(",")}
      />
      <input
        type="hidden"
        name="imagenesDescartadas"
        value={descartadas.join(",")}
      />

      <AvisoDelEnvio estado={estado} />

      {/*
        Un solo recorrido, en el orden en que el feriante piensa un producto:
        cómo se llama, cómo se ve, qué es y cuántos tiene. Antes eran dos
        tarjetas —datos arriba, fotos abajo— con dos casillas en el medio, y la
        foto, que es lo que más pesa en una vidriera, quedaba al final.

        «Disponible» ya no está acá: es el botón «Marcar sin stock» de la
        tarjeta del producto, en el stand. El valor viaja oculto para que
        guardar no lo cambie.
      */}
      {(producto?.disponible ?? true) && (
        <input type="hidden" name="disponible" value="on" />
      )}

      <Tarjeta>
        <TarjetaCuerpo className="space-y-7">
          <Paso numero={1}>
            <Campo
              htmlFor="nombre"
              etiqueta="Nombre del producto"
              errores={errores?.nombre}
              requerido
            >
              <Entrada
                name="nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                placeholder="Ej. Poncho de lana de oveja"
                errores={errores?.nombre}
                required
              />
            </Campo>
          </Paso>

          <Paso numero={2}>
            <p className="text-sm font-medium text-slate-700">Fotos</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Hasta {MAXIMO_IMAGENES}. La primera es la portada.
            </p>

            <div className="mt-3 space-y-4">
              {conservadas.length > 0 && (
                <ul className="flex flex-wrap gap-3">
                  {conservadas.map((ruta, indice) => (
                    <li key={ruta} className="relative">
                      <Image
                        src={urlPublica(ruta) ?? ""}
                        alt={`Foto ${indice + 1}`}
                        width={112}
                        height={112}
                        className="size-28 rounded-lg border border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setConservadas((actuales) =>
                            actuales.filter((item) => item !== ruta),
                          )
                        }
                        aria-label={`Quitar la foto ${indice + 1}`}
                        className="paleta-original absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700"
                      >
                        <IconoCerrar className="size-3.5" />
                      </button>
                      {indice === 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Portada
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {nuevas.length > 0 && (
                <ul className="flex flex-wrap gap-3">
                  {nuevas.map((variante, indice) => (
                    <li key={variante.ruta} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={variante.url}
                        alt={variante.titulo}
                        className="size-28 rounded-lg border border-municipal-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => quitarNueva(variante.ruta)}
                        aria-label={`Quitar ${variante.titulo}`}
                        className="paleta-original absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700"
                      >
                        <IconoCerrar className="size-3.5" />
                      </button>
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {conservadas.length === 0 && indice === 0
                          ? "Portada"
                          : variante.titulo}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <SelectorDeFoto
                nombreProducto={nombre}
                descripcionProducto={descripcion}
                onConfirmar={alConfirmarFoto}
                disponibles={espacioLibre}
                fotosNuevas={nuevas.map((v) => v.ruta)}
                hayIA={hayIA}
              />
            </div>
          </Paso>

          <Paso numero={3}>
            <div className="space-y-3">
              <Campo
                htmlFor="descripcion"
                etiqueta="Descripción"
                ayuda="Materiales, medidas, tiempo de elaboración, variantes disponibles."
                errores={errores?.descripcion}
              >
                <AreaTexto
                  name="descripcion"
                  rows={4}
                  value={descripcion}
                  onChange={(evento) => setDescripcion(evento.target.value)}
                  errores={errores?.descripcion}
                />
              </Campo>

              {/* El texto que vende: con lo que escribió, o con tres preguntas
                  si escribió poco. Pasa por la revisión igual que el resto. */}
              {hayIA && (
                <AsistenteDeDescripcion
                  valor={descripcion}
                  nombreEmprendimiento=""
                  rubro=""
                  objeto="producto"
                  titulo={nombre}
                  onAplicar={setDescripcion}
                />
              )}
            </div>
          </Paso>

          <Paso numero={4}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                htmlFor="stock"
                etiqueta="Cantidad disponible (opcional)"
                ayuda="Dejalo vacío si es a pedido o no llevás la cuenta. Con 0 se muestra «sin stock», y con 5 o menos, cuántos quedan."
                errores={errores?.stock}
              >
                <Entrada
                  name="stock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  defaultValue={producto?.stock ?? ""}
                  placeholder="Sin control de stock"
                  errores={errores?.stock}
                />
              </Campo>

              {/* El precio sólo existe con el marketplace habilitado: con el
                  flag apagado la vidriera sigue siendo una vidriera y el valor
                  se acuerda por WhatsApp. */}
              {conPrecios && (
                <Campo
                  htmlFor="precio"
                  etiqueta="Precio (opcional)"
                  ayuda="Dejalo vacío si preferís acordarlo por WhatsApp."
                  errores={errores?.precio}
                >
                  <Entrada
                    name="precio"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    defaultValue={producto?.precio ?? ""}
                    placeholder="0,00"
                    errores={errores?.precio}
                  />
                </Campo>
              )}
            </div>
          </Paso>

          <div className="border-t border-slate-100 pt-5">
            <Casilla
              name="destacado"
              etiqueta="Destacado"
              ayuda="Aparece primero en tu catálogo."
              defaultChecked={producto?.destacado ?? false}
            />
          </div>
        </TarjetaCuerpo>

        <TarjetaPie>
          <Link href="/mi-stand#catalogo" className={estilosBoton("contorno")}>
            Cancelar
          </Link>
          <BotonEnvio>
            {producto ? "Guardar cambios" : "Agregar al catálogo"}
          </BotonEnvio>
        </TarjetaPie>
      </Tarjeta>
    </form>
  );
}

/** Un paso del recorrido, con su número a la izquierda. */
function Paso({ numero, children }: { numero: number; children: ReactNode }) {
  return (
    <section className="flex gap-3">
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-municipal-500 text-xs font-semibold text-white"
        aria-hidden="true"
      >
        {numero}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
