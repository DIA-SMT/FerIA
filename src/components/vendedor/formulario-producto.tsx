"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { estilosBoton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import {
  AreaTexto,
  Campo,
  CampoArchivo,
  Casilla,
  Entrada,
} from "@/components/ui/campo";
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
  precio: number;
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

  const espacioLibre = MAXIMO_IMAGENES - conservadas.length;

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
              defaultValue={producto?.nombre}
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
              defaultValue={producto?.descripcion ?? ""}
              errores={errores?.descripcion}
            />
          </Campo>

          <Campo
            htmlFor="precio"
            etiqueta="Precio"
            ayuda="En pesos. Se muestra en tu stand; la venta se coordina por WhatsApp."
            errores={errores?.precio}
            requerido
            className="max-w-xs"
          >
            <Entrada
              name="precio"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={producto?.precio ?? ""}
              placeholder="0"
              errores={errores?.precio}
              required
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

          {espacioLibre > 0 ? (
            <Campo
              htmlFor="imagenes"
              etiqueta={
                conservadas.length > 0 ? "Agregar más fotos" : "Fotos del producto"
              }
              ayuda={`Podés subir hasta ${espacioLibre} ${
                espacioLibre === 1 ? "imagen más" : "imágenes más"
              }. JPG, PNG, WEBP o AVIF, hasta 5 MB cada una.`}
              errores={errores?.imagenes}
            >
              <CampoArchivo name="imagenes" multiple errores={errores?.imagenes} />
            </Campo>
          ) : (
            <p className="text-sm text-slate-500">
              Llegaste al máximo de {MAXIMO_IMAGENES} fotos. Quitá alguna para
              poder subir otra.
            </p>
          )}
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
