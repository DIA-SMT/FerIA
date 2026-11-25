"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { generarVariantesDeFoto } from "@/actions/fotos-producto";
import {
  ESTADO_VARIANTES_INICIAL,
  FOTOS_IA_POR_DIA,
  type EstadoVariantes,
  type Variante,
} from "@/lib/fotos-producto";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, CampoArchivo } from "@/components/ui/campo";
import { IconoTildeCirculo } from "@/components/ui/iconos";
import { useVistaPreviaLocal } from "@/lib/vista-previa";

/**
 * Agregar una foto a un producto.
 *
 * 1. Se elige la foto y **se agrega sola**: se encuadra en cuadrado, se le
 *    levanta la luz y se empareja el fondo, y aparece en las fotos del
 *    producto. Antes había que confirmarla dos veces más —«Usar esta foto» y
 *    después «Agregar al producto»—, y eso era pedir permiso para algo que el
 *    feriante ya había decidido al elegir el archivo.
 * 2. Queda a mano un solo botón, «Mejorar imagen con IA», para esa última foto.
 * 3. Si lo usa, ve la de antes y la de después lado a lado y elige con un
 *    toque con cuál se queda. Si elige la de la IA, reemplaza a la que ya
 *    estaba agregada.
 *
 * Vive **dentro** del formulario del producto, así que no puede tener su propio
 * `<form>`: los formularios anidados son HTML inválido. La acción se dispara a
 * mano, armando el `FormData` desde el archivo que guarda el estado. Eso además
 * evita enviar y validar el resto de los campos del producto.
 *
 * Todo lo que se sube y no se usa se le pasa al padre como descartado, para que
 * lo borre al guardar: si no, quedan huérfanas en el bucket.
 */

/**
 * `form` apuntando a un id que no existe deja al control sin formulario dueño,
 * así que no se envía con el del producto. Sin esto, al guardar el producto se
 * reenviaría la foto original —hasta 5 MB, contra el límite de 1 MB que tiene
 * una Server Action— para nada.
 */
const SIN_FORMULARIO = "selector-de-foto-sin-formulario";

type Peticion = "automatica" | "ia";

export function SelectorDeFoto({
  nombreProducto,
  descripcionProducto,
  onConfirmar,
  disponibles,
  fotosNuevas,
  hayIA = true,
  restantesIA = FOTOS_IA_POR_DIA,
}: {
  /** Se interpolan en el prompt de la IA para ambientar la escena. */
  nombreProducto: string;
  descripcionProducto: string;
  /**
   * Agrega `elegida` a las fotos del producto —o, con `reemplaza`, la pone en
   * lugar de esa— y anota `descartadas` para borrarlas al guardar.
   */
  onConfirmar: (
    elegida: Variante | null,
    descartadas: string[],
    reemplaza?: string,
  ) => void;
  /** Cuántas fotos más se pueden agregar. */
  disponibles: number;
  /**
   * Las fotos nuevas que ya están en el producto. Si el feriante quitó la que
   * se acaba de agregar, ya no tiene sentido ofrecer mejorarla.
   */
  fotosNuevas: string[];
  /**
   * Si la plataforma tiene `OPENROUTER_API_KEY` cargada. Llega por props porque
   * `hayIAConfigurada()` lee `process.env` del servidor y este componente es de
   * cliente.
   */
  hayIA?: boolean;
  /**
   * Cuántas fotos puede mejorar con IA en lo que queda del día. Lo cuenta la
   * página y después lo actualiza cada respuesta.
   */
  restantesIA?: number;
}) {
  const [estado, generar, generando] = useActionState(
    generarVariantesDeFoto,
    ESTADO_VARIANTES_INICIAL,
  );

  const archivoRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const previa = useVistaPreviaLocal(archivo);

  // Qué se pidió, y el estado que había en ese momento: la respuesta nueva es
  // la que tiene otra identidad. Sin esto, en el render en que arranca la
  // transición se podía leer la respuesta de la foto anterior.
  const [peticion, setPeticion] = useState<Peticion | null>(null);
  const estadoAlPedir = useRef<EstadoVariantes>(estado);

  // La última foto agregada, a la que se le ofrece la IA.
  const [agregada, setAgregada] = useState<Variante | null>(null);
  const [comparacion, setComparacion] = useState<{
    antes: Variante;
    despues: Variante;
  } | null>(null);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [restantes, setRestantes] = useState(restantesIA);

  function pedir(tipo: Peticion, foto: File): void {
    setPeticion(tipo);
    setErrorIA(null);
    estadoAlPedir.current = estado;

    const datos = new FormData();
    datos.set("foto", foto);
    if (tipo === "ia") datos.set("usarIA", "on");
    datos.set("nombre", nombreProducto);
    datos.set("descripcion", descripcionProducto);

    // Sin `startTransition`, `generando` nunca se pone en true: el botón no se
    // deshabilita y el feriante puede clickear de nuevo y pagar otra generación
    // de IA. Hace falta porque se despacha por click y no por `action`.
    startTransition(() => generar(datos));
  }

  // La respuesta se procesa una sola vez, cuando llega.
  useEffect(() => {
    if (!peticion || generando || estado === estadoAlPedir.current) return;
    setPeticion(null);

    const variantes = estado.variantes ?? [];
    const automatica = variantes.find((v) => v.clave === "automatica");

    if (peticion === "automatica") {
      if (!automatica) return;
      onConfirmar(
        automatica,
        variantes.filter((v) => v !== automatica).map((v) => v.ruta),
      );
      setAgregada(automatica);
      return;
    }

    // Con la IA vuelve también una automática nueva: es una copia de la que ya
    // está agregada, así que se descarta. Y si mientras tanto el feriante quitó
    // la foto de arriba, no hay con qué comparar: se descarta también la IA.
    const ia = variantes.find((v) => v.clave === "ia");
    const sobrantes = automatica ? [automatica.ruta] : [];
    if (ia && agregada && fotosNuevas.includes(agregada.ruta)) {
      setComparacion({ antes: agregada, despues: ia });
    } else if (ia) {
      sobrantes.push(ia.ruta);
    }
    if (sobrantes.length > 0) onConfirmar(null, sobrantes);
    if (estado.restantesIA !== undefined) setRestantes(estado.restantesIA);
    // Si no le quedan, ya lo dice el texto del botón: no se repite en rojo.
    setErrorIA(estado.restantesIA === 0 && !ia ? null : (estado.errorIA ?? null));
  }, [estado, generando, peticion, agregada, fotosNuevas, onConfirmar]);

  function cerrar(): void {
    setAgregada(null);
    setComparacion(null);
    setArchivo(null);
    if (archivoRef.current) archivoRef.current.value = "";
  }

  function alElegirArchivo(foto: File | null): void {
    // Una comparación a medio decidir es de la foto anterior: la de la IA se
    // descarta y queda la que ya estaba agregada.
    if (comparacion) onConfirmar(null, [comparacion.despues.ruta]);
    setComparacion(null);
    setAgregada(null);
    setArchivo(foto);
    if (foto) pedir("automatica", foto);
  }

  function quedarse(con: "antes" | "despues"): void {
    if (!comparacion) return;
    const { antes, despues } = comparacion;
    if (con === "antes") onConfirmar(null, [despues.ruta]);
    else onConfirmar(despues, [antes.ruta], antes.ruta);
    cerrar();
  }

  const ofreceIA =
    hayIA &&
    agregada !== null &&
    fotosNuevas.includes(agregada.ruta) &&
    comparacion === null;
  const preparando = generando && peticion === "automatica";
  const mejorando = generando && peticion === "ia";

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      {disponibles > 0 ? (
        <Campo
          htmlFor="fotoNueva"
          etiqueta="Agregar una foto"
          ayuda={`Podés agregar ${disponibles} más. JPG, PNG, WEBP o AVIF, hasta 5 MB. Se encuadra en cuadrado, con la luz levantada y el fondo emparejado.`}
        >
          <CampoArchivo
            name="fotoNueva"
            ref={archivoRef}
            form={SIN_FORMULARIO}
            disabled={generando}
            onChange={(evento) =>
              alElegirArchivo(evento.target.files?.[0] ?? null)
            }
          />
        </Campo>
      ) : (
        !ofreceIA &&
        !comparacion && (
          <p className="text-sm text-slate-500">
            Llegaste al máximo de fotos. Quitá alguna para poder agregar otra.
          </p>
        )
      )}

      {/* Mientras se prepara todavía no está en las fotos del producto: la
          vista previa local es lo único que hay para mostrar. */}
      {preparando && archivo && (
        <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-superficie">
            {previa && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previa}
                alt={`Vista previa de ${archivo.name}`}
                className="size-full object-contain"
              />
            )}
          </div>
          <p className="text-sm text-slate-600">Preparando la foto…</p>
        </div>
      )}

      {estado !== estadoAlPedir.current &&
        estado.ok === false &&
        estado.mensaje && <Alerta tipo="error">{estado.mensaje}</Alerta>}

      {errorIA && <Alerta tipo="error">{errorIA}</Alerta>}

      {/* La foto ya está en el producto (arriba, en «Fotos nuevas»): acá no se
          repite la miniatura, sólo se ofrece mejorarla. */}
      {ofreceIA && (
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <IconoTildeCirculo className="size-4 shrink-0" />
            Se agregó <span className="truncate font-medium">{archivo?.name}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Boton
              type="button"
              variante="contorno"
              onClick={() => archivo && pedir("ia", archivo)}
              disabled={generando || restantes === 0}
            >
              {mejorando ? "Mejorando la imagen…" : "Mejorar imagen con IA"}
            </Boton>
            <p className="min-w-0 flex-1 text-xs text-slate-500">
              {restantes === 0
                ? `Ya mejoraste ${FOTOS_IA_POR_DIA} fotos con IA hoy. Mañana podés mejorar más.`
                : `Reemplaza el fondo por un escenario de estudio y te deja elegir con cuál quedarte. Tarda unos 10 segundos. Hoy ${restantes === 1 ? "te queda 1" : `te quedan ${restantes}`}.`}
            </p>
          </div>
        </div>
      )}

      {comparacion && (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700">
            ¿Con cuál te quedás?
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["antes", "Antes", comparacion.antes],
                ["despues", "Con IA", comparacion.despues],
              ] as const
            ).map(([clave, rotulo, variante]) => (
              <div
                key={clave}
                className="rounded-lg border-2 border-slate-200 bg-superficie p-2"
              >
                <span className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  {rotulo}
                </span>
                <div className="aspect-square w-full overflow-hidden rounded bg-slate-100">
                  {/* Miniatura chica de Storage: no vale la pena pasarla por
                      el optimizador de Next. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={variante.url}
                    alt={variante.titulo}
                    className="size-full object-cover"
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                  {variante.detalle}
                </p>
                <Boton
                  type="button"
                  variante={clave === "despues" ? "primario" : "contorno"}
                  tamanio="sm"
                  ancho
                  className="mt-2"
                  onClick={() => quedarse(clave)}
                >
                  Quedarme con esta
                </Boton>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
