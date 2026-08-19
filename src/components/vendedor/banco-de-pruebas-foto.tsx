"use client";

import { useActionState, useState } from "react";

import { probarFoto, type ResultadoPrueba } from "@/actions/probar-foto";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import {
  AreaTexto,
  Campo,
  CampoArchivo,
  Casilla,
  Entrada,
  Seleccion,
} from "@/components/ui/campo";
import { aOpciones, RUBROS } from "@/lib/labels";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";

const ESTADO_INICIAL: ResultadoPrueba = { ok: false };

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/** Una de las tres columnas de comparación. */
function Variante({
  titulo,
  detalle,
  src,
  destacada = false,
}: {
  titulo: string;
  detalle?: string;
  src: string | null;
  destacada?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={
          destacada
            ? "text-sm font-semibold text-municipal-700"
            : "text-sm font-semibold text-slate-700"
        }
      >
        {titulo}
      </p>
      <div className="mt-1.5 aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {src ? (
          // Data URL de la Server Action: `next/image` no la optimiza, así que
          // va un <img> plano a propósito.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={titulo}
            className="size-full object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-3 text-center text-xs text-slate-400">
            todavía no
          </div>
        )}
      </div>
      {detalle && <p className="mt-1.5 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export function BancoDePruebasFoto() {
  const [estado, enviar] = useActionState(probarFoto, ESTADO_INICIAL);

  // Vista previa local del archivo elegido, para tener la columna "original"
  // sin subir nada al servidor todavía.
  const [original, setOriginal] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);

  return (
    <form action={enviar} className="space-y-5">
      <Tarjeta>
        <TarjetaEncabezado
          titulo="Probar una foto"
          descripcion="Subí una foto como la que sacaría un feriante. No se guarda nada: es sólo para comparar."
        />
        <TarjetaCuerpo className="space-y-4">
          <Campo
            htmlFor="foto"
            etiqueta="Foto del producto"
            ayuda="JPG, PNG, WEBP o AVIF, hasta 5 MB."
            requerido
          >
            <CampoArchivo
              name="foto"
              required
              onChange={(evento) => {
                const archivo = evento.target.files?.[0];
                setOriginal(archivo ? URL.createObjectURL(archivo) : null);
                setNombre(archivo?.name ?? null);
              }}
            />
          </Campo>

          {/* Estos tres campos son los que el prompt interpola. En el catálogo
              real salen del formulario del producto y del rubro del feriante;
              acá se escriben para poder probar combinaciones. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo htmlFor="nombre" etiqueta="Nombre del producto">
              <Entrada name="nombre" placeholder="Ej. Dulce de cayote artesanal" />
            </Campo>

            <Campo
              htmlFor="categoria"
              etiqueta="Categoría"
              ayuda="Si la dejás vacía usa tu rubro."
            >
              <Seleccion
                name="categoria"
                placeholder="Mi rubro"
                opciones={aOpciones(RUBROS)}
              />
            </Campo>
          </div>

          <Campo
            htmlFor="descripcion"
            etiqueta="Descripción"
            ayuda="Opcional. El prompt la usa para ambientar la escena."
          >
            <AreaTexto name="descripcion" rows={2} />
          </Campo>

          <Casilla
            name="usarIA"
            etiqueta="Además, mejorar la foto con IA"
            ayuda="Tarda unos 7 segundos y consume crédito de OpenRouter (~US$ 0,04 por foto)."
          />

          <BotonEnvio textoEnviando="Procesando…">Procesar</BotonEnvio>
        </TarjetaCuerpo>
      </Tarjeta>

      {estado.ok === false && estado.mensaje && (
        <Alerta tipo="error">{estado.mensaje}</Alerta>
      )}

      {estado.errorIA && <Alerta tipo="error">{estado.errorIA}</Alerta>}

      {(original || estado.procesada) && (
        <Tarjeta>
          <TarjetaEncabezado
            titulo="Comparación"
            descripcion={nombre ?? undefined}
          />
          <TarjetaCuerpo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Variante titulo="Tu foto" src={original} />
              <Variante
                titulo="Fondo blanco (automático)"
                src={estado.procesada?.dataUrl ?? null}
                detalle={
                  estado.procesada
                    ? `${kb(estado.procesada.peso)} · ${estado.procesada.ms} ms · ${estado.procesada.ajustes.join(" · ")}`
                    : undefined
                }
              />
              <Variante
                titulo="Editada con IA"
                destacada
                src={estado.conIA?.dataUrl ?? null}
                detalle={
                  estado.conIA
                    ? `${kb(estado.conIA.peso)} · ${(estado.conIA.ms / 1000).toFixed(1)} s · insignia ${estado.conIA.esquina}`
                    : undefined
                }
              />
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
      )}
    </form>
  );
}
