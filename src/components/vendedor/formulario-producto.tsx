"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import type { Variante } from "@/lib/fotos-producto";
import { Alerta } from "@/components/ui/alerta";
import { estilosBoton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo, Casilla, Entrada } from "@/components/ui/campo";
import { SelectorDeFoto } from "@/components/vendedor/selector-de-foto";
import { IconoCerrar } from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
  TarjetaPie,
} from "@/components/ui/tarjeta";
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
}

interface PropsFormularioProducto {
  accion: (
    estado: EstadoFormulario,
    datos: FormData,
  ) => Promise<EstadoFormulario>;
  producto?: ValoresProducto;
}

export function FormularioProducto({
  accion,
  producto,
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

  function alConfirmarFoto(
    elegida: Variante | null,
    sinElegir: string[],
  ): void {
    if (elegida) setNuevas((actuales) => [...actuales, elegida]);
    setDescartadas((actuales) => [...actuales, ...sinElegir]);
  }

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

      {estado.mensaje && (
        <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta>
      )}

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Datos del producto"
          descripcion="Lo que ven los vecinos en tu catálogo."
        />
        <TarjetaCuerpo className="space-y-4">
          <Campo
            htmlFor="nombre"
            etiqueta="Nombre"
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

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <Casilla
              name="disponible"
              etiqueta="Disponible"
              ayuda="Si lo desmarcás, se muestra como «sin stock» y no se puede consultar."
              defaultChecked={producto?.disponible ?? true}
            />
            <Casilla
              name="destacado"
              etiqueta="Destacado"
              ayuda="Los destacados aparecen primero en tu catálogo."
              defaultChecked={producto?.destacado ?? false}
            />
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Fotos"
          descripcion={`Hasta ${MAXIMO_IMAGENES} imágenes por producto. La primera es la portada.`}
        />
        <TarjetaCuerpo className="space-y-4">
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
                    className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700"
                  >
                    <IconoCerrar className="size-3.5" />
                  </button>
                  {indice === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Portada
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {nuevas.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700">
                Fotos nuevas, listas para publicar
              </p>
              <ul className="mt-2 flex flex-wrap gap-3">
                {nuevas.map((variante) => (
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
                      className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700"
                    >
                      <IconoCerrar className="size-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {variante.titulo}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SelectorDeFoto
            nombreProducto={nombre}
            descripcionProducto={descripcion}
            onConfirmar={alConfirmarFoto}
            disponibles={espacioLibre}
          />
        </TarjetaCuerpo>

        <TarjetaPie>
          <Link
            href="/mi-stand/productos"
            className={estilosBoton("contorno")}
          >
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
