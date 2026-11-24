"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useAsistente } from "@/components/public/estado-asistente";
import { estilosBoton } from "@/components/ui/boton";
import { BORDE_NORMAL, ESTILO_CONTROL } from "@/components/ui/campo";
import {
  IconoChat,
  IconoImagen,
  IconoSubir,
  IconoWhatsapp,
} from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

export interface ProductoParaCompartir {
  id: string;
  nombre: string;
  /** URL pública de la primera foto, o `null` si no tiene. */
  foto: string | null;
}

const MAXIMO = 6;

type Formato = "publicacion" | "historia";

const FORMATOS: Record<Formato, { titulo: string; detalle: string }> = {
  publicacion: {
    titulo: "Publicación",
    detalle: "Para chats y el feed de Instagram",
  },
  historia: {
    titulo: "Estado o historia",
    detalle: "Para estados de WhatsApp e historias",
  },
};

/** Lo que se le puede pedir a Migue desde acá, con un toque. */
const IDEAS = [
  "¿Qué días y a qué hora me conviene publicar?",
  "Armame un plan de publicaciones para esta semana",
  "Escribime un texto para Instagram de mi producto más consultado",
  "Escribime un estado de WhatsApp para avisar que voy a la próxima feria",
];

/**
 * Arma la imagen del catálogo para compartir: el feriante elige hasta seis
 * productos —con precio si quiere, sólo para la imagen—, el formato, y la
 * comparte directo (en el celular abre WhatsApp, Instagram o lo que tenga) o
 * la descarga. Abajo, el link de su stand y atajos para pedirle ideas a Migue.
 */
export function CompartirCatalogo({
  productos,
  enlace,
  emprendimiento,
  conInstagram,
  conMigue,
  rutaDeLaImagen = "/mi-stand/compartir/imagen",
}: {
  productos: ProductoParaCompartir[];
  /** La dirección completa de su stand. */
  enlace: string;
  emprendimiento: string;
  conInstagram: boolean;
  conMigue: boolean;
  /** Dónde se arma la imagen. Cambia sólo para probarla con datos de ejemplo. */
  rutaDeLaImagen?: string;
}) {
  const conFoto = productos.filter((producto) => producto.foto);
  const [elegidos, setElegidos] = useState<string[]>(() =>
    conFoto.slice(0, 4).map((producto) => producto.id),
  );
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [formato, setFormato] = useState<Formato>("publicacion");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const asistente = useAsistente();

  const url = useMemo(() => {
    const parametros = new URLSearchParams({
      p: elegidos.join(","),
      precios: elegidos.map((id) => precios[id] ?? "").join(","),
      formato,
    });
    return `${rutaDeLaImagen}?${parametros.toString()}`;
  }, [elegidos, precios, formato, rutaDeLaImagen]);

  // La vista previa espera a que se deje de escribir un precio: si no, pediría
  // una imagen nueva por cada tecla.
  const [vista, setVista] = useState(url);
  const [cargando, setCargando] = useState(true);
  const imagen = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (url === vista) return;
    const espera = setTimeout(() => {
      setVista(url);
      setCargando(true);
    }, 500);
    return () => clearTimeout(espera);
  }, [url, vista]);
  // La primera puede terminar de cargar antes de que React escuche su
  // `onLoad`, y quedaría atenuada para siempre.
  useEffect(() => {
    const actual = imagen.current;
    if (actual?.complete && actual.naturalWidth > 0) setCargando(false);
  }, [vista]);

  function alternar(id: string) {
    setElegidos((actuales) =>
      actuales.includes(id)
        ? actuales.filter((otro) => otro !== id)
        : actuales.length < MAXIMO
          ? [...actuales, id]
          : actuales,
    );
  }

  const nombreDelArchivo = `catalogo-${emprendimiento
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.png`;

  async function compartir() {
    setMensaje(null);
    try {
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error("sin imagen");
      const archivo = new File([await respuesta.blob()], nombreDelArchivo, {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          text: `${emprendimiento}: mirá todo en ${enlace}`,
        });
        return;
      }
      // En la compu no hay a dónde compartir un archivo: se descarga.
      const enlaceTemporal = document.createElement("a");
      enlaceTemporal.href = URL.createObjectURL(archivo);
      enlaceTemporal.download = nombreDelArchivo;
      enlaceTemporal.click();
      URL.revokeObjectURL(enlaceTemporal.href);
      setMensaje(
        "Se descargó la imagen. Desde el celular, este botón la manda directo a WhatsApp o Instagram.",
      );
    } catch (error) {
      // Cerrar el menú de compartir sin elegir nada no es un error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMensaje("No se pudo armar la imagen. Probá de nuevo en un momento.");
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setMensaje("Link copiado.");
    } catch {
      setMensaje(`No se pudo copiar. El link es ${enlace}`);
    }
  }

  const textoDelLink = `¡Hola! Te paso mi catálogo de ${emprendimiento}: ${enlace}`;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        {/* 1. Qué productos. */}
        <section className="rounded-xl border border-slate-200 bg-superficie p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900">
            Elegí qué mostrar{" "}
            <span className="font-normal text-slate-500">
              ({elegidos.length} de {MAXIMO})
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Si querés, poné el precio: va sólo en la imagen, no se publica en el
            sitio.
          </p>

          {conFoto.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Todavía no tenés productos publicados con foto. Cargalos en Mi
              stand y vuelven a aparecer acá.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {productos.map((producto) => {
                const elegido = elegidos.includes(producto.id);
                const lleno = !elegido && elegidos.length >= MAXIMO;
                return (
                  <li
                    key={producto.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <label
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3",
                        producto.foto && !lleno
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={elegido}
                        disabled={!producto.foto || lleno}
                        onChange={() => alternar(producto.id)}
                        className="size-4 shrink-0 rounded border-slate-300 text-municipal-600"
                      />
                      {producto.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={producto.foto}
                          alt=""
                          className="size-11 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <IconoImagen className="size-5" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {producto.nombre}
                        </span>
                        {!producto.foto && (
                          <span className="block text-xs text-slate-500">
                            Sin foto: no puede ir en la imagen.
                          </span>
                        )}
                      </span>
                    </label>
                    {elegido && (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={precios[producto.id] ?? ""}
                        onChange={(evento) =>
                          setPrecios((actuales) => ({
                            ...actuales,
                            [producto.id]: evento.target.value,
                          }))
                        }
                        placeholder="Precio"
                        aria-label={`Precio de ${producto.nombre} para la imagen`}
                        maxLength={12}
                        className={cn(
                          ESTILO_CONTROL,
                          BORDE_NORMAL,
                          "w-28 sm:w-36",
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 2. El formato. */}
        <section className="rounded-xl border border-slate-200 bg-superficie p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900">Formato</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.keys(FORMATOS) as Formato[]).map((opcion) => (
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
          {!conInstagram && (
            <p className="mt-3 text-sm text-slate-600">
              Si sumás tu Instagram en la tarjeta «Contacto» de Mi stand,
              aparece en la imagen.
            </p>
          )}
        </section>

        {/* 3. El link. */}
        <section className="rounded-xl border border-slate-200 bg-superficie p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900">El link de tu stand</h2>
          <p className="mt-1 truncate text-sm text-slate-600">{enlace}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(textoDelLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                estilosBoton("primario"),
                "paleta-original bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              <IconoWhatsapp className="size-4" />
              Mandar por WhatsApp
            </a>
            <button
              type="button"
              onClick={copiar}
              className={estilosBoton("contorno")}
            >
              Copiar el link
            </button>
          </div>
        </section>

        {/* 4. Migue. */}
        {conMigue && asistente && (
          <section className="rounded-xl border border-slate-200 bg-superficie p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <IconoChat className="size-5 text-municipal-600" />
              Ideas para publicar, con Migue
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Te arma un plan con tus próximas ferias y las fechas que se
              vienen, y te escribe los textos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => asistente.consultar(idea)}
                  className="rounded-full bg-municipal-50 px-3 py-1.5 text-left text-sm font-medium text-municipal-700 ring-1 ring-municipal-100 transition-colors hover:bg-municipal-100"
                >
                  {idea}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* La imagen, como va a salir. */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-slate-200",
            formato === "historia" ? "aspect-[9/16]" : "aspect-[4/5]",
          )}
        >
          {elegidos.length > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imagen}
              key={vista}
              src={vista}
              alt="Vista previa de la imagen del catálogo"
              onLoad={() => setCargando(false)}
              onError={() => setCargando(false)}
              className={cn(
                "size-full object-contain transition-opacity",
                cargando && "opacity-40",
              )}
            />
          )}
          {elegidos.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-500">
              Elegí al menos un producto.
            </p>
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <button
            type="button"
            onClick={compartir}
            disabled={elegidos.length === 0}
            className={estilosBoton("primario")}
          >
            <IconoSubir className="size-4" />
            Compartir la imagen
          </button>
          <a
            href={elegidos.length > 0 ? url : undefined}
            download={nombreDelArchivo}
            aria-disabled={elegidos.length === 0}
            className={cn(
              estilosBoton("contorno"),
              elegidos.length === 0 && "pointer-events-none opacity-50",
            )}
          >
            Descargar
          </a>
        </div>
        {mensaje && (
          <p className="mt-2 text-sm text-slate-600" role="status">
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}
