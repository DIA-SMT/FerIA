"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { EstadoPublicidad } from "@/actions/publicidad";
import { estilosBoton } from "@/components/ui/boton";
import { BORDE_NORMAL, ESTILO_CONTROL } from "@/components/ui/campo";
import { IconoImagen, IconoSubir } from "@/components/ui/iconos";
import {
  compartirImagen,
  nombreDeArchivo,
} from "@/components/vendedor/compartir-archivo";
import type { ProductoParaCompartir } from "@/components/vendedor/compartir-catalogo";
import { cn } from "@/lib/cn";
import {
  MAXIMO_PRODUCTOS_PUBLICIDAD,
  PUBLICIDADES_POR_DIA,
  type FormatoPublicidad,
} from "@/lib/publicidad";

const FORMATOS: Record<FormatoPublicidad, { titulo: string; detalle: string }> =
  {
    publicacion: {
      titulo: "Publicación",
      detalle: "Para el feed de Instagram",
    },
    historia: {
      titulo: "Historia o estado",
      detalle: "Para historias y estados de WhatsApp",
    },
  };

/**
 * La imagen publicitaria con IA: el feriante elige hasta tres productos y el
 * formato, la IA arma la escena con sus fotos y propone un título, y el texto
 * —título, nombre, WhatsApp, Instagram— lo pone el servidor encima. El título
 * se edita acá y la imagen se vuelve a armar sin llamar otra vez a la IA.
 */
export function PublicidadConIA({
  productos,
  emprendimiento,
  enlace,
  generar,
  rutaDeLaImagen = "/mi-stand/compartir/publicidad",
}: {
  productos: ProductoParaCompartir[];
  emprendimiento: string;
  enlace: string;
  /** La acción del servidor (`generarPublicidad`). */
  generar: (pedido: {
    productos: string[];
    anterior?: string | null;
  }) => Promise<EstadoPublicidad>;
  /** Dónde se arma la imagen. Cambia sólo para probarla con datos de ejemplo. */
  rutaDeLaImagen?: string;
}) {
  const conFoto = productos.filter((producto) => producto.foto);
  const [elegidos, setElegidos] = useState<string[]>(() =>
    conFoto.slice(0, 1).map((producto) => producto.id),
  );
  const [formato, setFormato] = useState<FormatoPublicidad>("publicacion");
  // La escena es la misma para los dos formatos: cambiar de formato rearma
  // el texto alrededor y no le vuelve a pedir nada a la IA.
  const [fondo, setFondo] = useState<string | null>(null);
  const [titular, setTitular] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [generando, iniciar] = useTransition();

  function alternar(id: string) {
    setElegidos((actuales) =>
      actuales.includes(id)
        ? actuales.filter((otro) => otro !== id)
        : actuales.length < MAXIMO_PRODUCTOS_PUBLICIDAD
          ? [...actuales, id]
          : actuales,
    );
  }

  function pedir() {
    setMensaje(null);
    iniciar(async () => {
      const estado = await generar({
        productos: elegidos,
        anterior: fondo,
      });
      if (!estado.ok || !estado.fondo) {
        setMensaje(estado.mensaje ?? "No se pudo generar la imagen.");
        return;
      }
      setFondo(estado.fondo);
      setTitular(estado.titular ?? "");
    });
  }

  const url = useMemo(() => {
    if (!fondo) return null;
    const parametros = new URLSearchParams({ fondo, titular, formato });
    return `${rutaDeLaImagen}?${parametros.toString()}`;
  }, [fondo, titular, formato, rutaDeLaImagen]);

  // Como en el catálogo: la vista previa espera a que se deje de escribir.
  const [vista, setVista] = useState(url);
  const [cargando, setCargando] = useState(false);
  const imagen = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (url === vista) return;
    const espera = setTimeout(
      () => {
        setVista(url);
        setCargando(true);
      },
      vista ? 500 : 0,
    );
    return () => clearTimeout(espera);
  }, [url, vista]);
  useEffect(() => {
    const actual = imagen.current;
    if (actual?.complete && actual.naturalWidth > 0) setCargando(false);
  }, [vista]);

  const nombreDelArchivo = nombreDeArchivo("publicidad", emprendimiento);
  const proporcion = formato === "historia" ? "aspect-[9/16]" : "aspect-[4/5]";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-superficie p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900">
            Elegí qué mostrar{" "}
            <span className="font-normal text-slate-500">
              (hasta {MAXIMO_PRODUCTOS_PUBLICIDAD})
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Con uno solo, la IA lo pone de protagonista. Con dos o tres, arma
            una composición.
          </p>
          {conFoto.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Todavía no tenés productos publicados con foto.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {conFoto.map((producto) => {
                const elegido = elegidos.includes(producto.id);
                const lleno =
                  !elegido && elegidos.length >= MAXIMO_PRODUCTOS_PUBLICIDAD;
                return (
                  <li key={producto.id}>
                    <button
                      type="button"
                      aria-pressed={elegido}
                      disabled={lleno}
                      onClick={() => alternar(producto.id)}
                      className={cn(
                        "flex w-full flex-col overflow-hidden rounded-lg text-left ring-2 transition",
                        elegido
                          ? "ring-municipal-500"
                          : "ring-transparent hover:ring-slate-200",
                        lleno && "cursor-not-allowed opacity-50",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={producto.foto!}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                      <span className="truncate bg-superficie px-2 py-1.5 text-xs font-medium text-slate-800">
                        {producto.nombre}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-superficie p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900">Formato</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.keys(FORMATOS) as FormatoPublicidad[]).map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={formato === opcion}
                onClick={() => setFormato(opcion)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-left ring-1 transition-colors",
                  formato === opcion
                    ? "bg-municipal-50 ring-municipal-500"
                    : "ring-slate-200 hover:bg-slate-50",
                )}
              >
                <span className="block text-sm font-semibold text-slate-900">
                  {FORMATOS[opcion].titulo}
                </span>
                <span className="block text-xs text-slate-500">
                  {FORMATOS[opcion].detalle}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={pedir}
            disabled={generando || elegidos.length === 0}
            className={cn(estilosBoton("primario"), "mt-4 w-full sm:w-auto")}
          >
            {generando
              ? "Armando tu imagen…"
              : fondo
                ? "Generar otra ✨"
                : "Generar con IA ✨"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Tarda unos 15 segundos. La IA arma la escena con tus fotos y el
            texto lo ponemos nosotros, así tu WhatsApp sale bien escrito. Podés
            generar hasta {PUBLICIDADES_POR_DIA} por día.
          </p>
        </section>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-slate-200",
            proporcion,
          )}
        >
          {vista ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imagen}
              key={vista}
              src={vista}
              alt="Vista previa de la imagen publicitaria"
              onLoad={() => setCargando(false)}
              onError={() => setCargando(false)}
              className={cn(
                "size-full object-contain transition-opacity",
                (cargando || generando) && "opacity-40",
              )}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
              <IconoImagen className="size-8 text-slate-400" />
              {generando
                ? "La IA está armando tu imagen…"
                : "Tu imagen va a aparecer acá."}
            </div>
          )}
          {generando && vista && (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-semibold text-slate-800">
              Armando otra…
            </p>
          )}
        </div>

        {fondo && (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Título de la imagen
              </span>
              <input
                type="text"
                value={titular}
                onChange={(evento) => setTitular(evento.target.value)}
                maxLength={60}
                placeholder="Ej. ¡Antojate de algo rico! 🥪"
                className={cn(ESTILO_CONTROL, BORDE_NORMAL, "mt-1")}
              />
            </label>
            <p className="text-xs text-slate-500">
              Revisá que tus productos se vean como son antes de publicarla: la
              escena la armó la IA.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={async () => {
                  setMensaje(null);
                  if (!url) return;
                  setMensaje(
                    await compartirImagen(
                      url,
                      nombreDelArchivo,
                      `${emprendimiento}: ${enlace}`,
                    ),
                  );
                }}
                className={estilosBoton("primario")}
              >
                <IconoSubir className="size-4" />
                Compartir la imagen
              </button>
              <a
                href={url ?? undefined}
                download={nombreDelArchivo}
                className={estilosBoton("contorno")}
              >
                Descargar
              </a>
            </div>
          </div>
        )}
        {mensaje && (
          <p className="mt-2 text-sm text-slate-600" role="status">
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}
