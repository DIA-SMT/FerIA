"use client";

import { startTransition, useActionState, useRef, useState } from "react";

import { generarVariantesDeFoto } from "@/actions/fotos-producto";
import {
  ESTADO_VARIANTES_INICIAL,
  type ClaveVariante,
  type Variante,
} from "@/lib/fotos-producto";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, CampoArchivo } from "@/components/ui/campo";
import { IconoCerrar } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { useVistaPreviaLocal } from "@/lib/vista-previa";

/**
 * Agregar una foto a un producto, en tres pasos que se ven venir.
 *
 * El orden importa y es el arreglo de una versión anterior en la que había que
 * adivinar: se elegía un archivo y no se veía nada, el botón decía «Ver las
 * versiones» sin decir cuáles, y lo que hacía dependía de una casilla puesta
 * más arriba. Ahora:
 *
 * 1. Se elige la foto y **se ve en el acto**, sin subir nada.
 * 2. Dos botones, y cada uno dice lo que hace: publicarla como está, o mandarla
 *    a la IA avisando que tarda. La decisión está en el botón que se aprieta y
 *    no en una casilla separada.
 * 3. Si se pidió la IA, las dos quedan lado a lado —antes y después— y se elige
 *    con cuál se publica.
 *
 * Vive **dentro** del formulario del producto, así que no puede tener su propio
 * `<form>`: los formularios anidados son HTML inválido. La acción se dispara por
 * click, armando el `FormData` a mano desde el archivo que guarda el estado. Eso
 * además evita enviar y validar el resto de los campos del producto sólo para
 * generar una vista previa.
 *
 * Cuando el feriante confirma una variante se la pasa al padre por
 * `onConfirmar`, junto con las rutas de las que descartó para que las borre al
 * guardar. El padre lleva la cuenta.
 */

/**
 * `form` apuntando a un id que no existe deja al control sin formulario dueño,
 * así que no se envía con el del producto. Hace falta porque estos campos están
 * dentro de ese formulario y el `FormData` lo armamos a mano: sin esto, al
 * guardar el producto se reenviaría la foto original —hasta 5 MB, contra el
 * límite de 1 MB que tiene una Server Action— para nada.
 */
const SIN_FORMULARIO = "selector-de-foto-sin-formulario";

export function SelectorDeFoto({
  nombreProducto,
  descripcionProducto,
  onConfirmar,
  disponibles,
  hayIA = true,
}: {
  /** Se interpolan en el prompt de la IA para ambientar la escena. */
  nombreProducto: string;
  descripcionProducto: string;
  /**
   * Recibe la variante elegida y las rutas a borrar. `elegida` es `null` cuando
   * el feriante descarta la foto entera: ahí se descartan todas las variantes.
   */
  onConfirmar: (elegida: Variante | null, descartadas: string[]) => void;
  /** Cuántas fotos más se pueden agregar. */
  disponibles: number;
  /**
   * Si la plataforma tiene `OPENROUTER_API_KEY` cargada. Llega por props y no
   * se consulta acá: `hayIAConfigurada()` lee `process.env` del servidor y este
   * componente es de cliente, donde esa variable no existe. La cadena que lo
   * monta —`productos/[id]` y `productos/nuevo` → `FormularioProducto` → acá—
   * ya lo pasa; el default en `true` es para cualquier otro lugar que lo monte
   * sin decir nada.
   */
  hayIA?: boolean;
}) {
  const [estado, generar, generando] = useActionState(
    generarVariantesDeFoto,
    ESTADO_VARIANTES_INICIAL,
  );

  const archivoRef = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const previa = useVistaPreviaLocal(archivo);

  const [elegida, setElegida] = useState<ClaveVariante>("automatica");

  // Para qué botón está corriendo la acción: los dos disparan lo mismo y sin
  // esto no se podría decir cuál de los dos está esperando.
  const [pidioIA, setPidioIA] = useState(false);

  // El estado de `useActionState` no se puede limpiar desde acá, así que las
  // variantes siguen ahí después de confirmar. Sin esta bandera, un segundo
  // click en «Agregar al producto» agregaría la misma ruta de nuevo.
  const [abierto, setAbierto] = useState(false);

  // Mientras se regenera no mostramos las anteriores: serían de otra foto.
  const variantes = abierto && !generando ? (estado.variantes ?? []) : [];
  const hayComparacion = variantes.length > 1;

  /**
   * Da por perdidas las variantes que hay en pantalla.
   *
   * Ya están subidas a Storage, así que avisarle al padre no es opcional: si no,
   * quedan huérfanas en el bucket para siempre. Se llama también al cambiar de
   * archivo, que es por donde se escapaban.
   */
  function olvidarVariantes(): void {
    if (variantes.length > 0) {
      onConfirmar(
        null,
        variantes.map((v) => v.ruta),
      );
    }
    setElegida("automatica");
    setAbierto(false);
  }

  function limpiarArchivo(): void {
    if (archivoRef.current) archivoRef.current.value = "";
    setArchivo(null);
  }

  function pedirVariantes(conIA: boolean): void {
    if (!archivo) return;

    setPidioIA(conIA);
    setAbierto(true);

    const datos = new FormData();
    datos.set("foto", archivo);
    if (conIA) datos.set("usarIA", "on");
    datos.set("nombre", nombreProducto);
    datos.set("descripcion", descripcionProducto);

    // Sin `startTransition`, `generando` nunca se pone en true: el botón no se
    // deshabilita y el feriante puede clickear de nuevo y pagar otra generación
    // de IA. Hace falta porque despachamos por click y no por `action` del form.
    startTransition(() => generar(datos));
  }

  function confirmar(): void {
    const variante = variantes.find((v) => v.clave === elegida) ?? variantes[0];
    if (!variante) return;

    onConfirmar(
      variante,
      variantes.filter((v) => v.ruta !== variante.ruta).map((v) => v.ruta),
    );

    setElegida("automatica");
    setAbierto(false);
    limpiarArchivo();
  }

  function descartar(): void {
    olvidarVariantes();
    limpiarArchivo();
  }

  if (disponibles <= 0) {
    return (
      <p className="text-sm text-slate-500">
        Llegaste al máximo de fotos. Quitá alguna para poder agregar otra.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <Campo
        htmlFor="fotoNueva"
        etiqueta="Agregar una foto"
        ayuda={`Podés agregar ${disponibles} más. JPG, PNG, WEBP o AVIF, hasta 5 MB.`}
      >
        <CampoArchivo
          name="fotoNueva"
          ref={archivoRef}
          form={SIN_FORMULARIO}
          onChange={(evento) => {
            // Cambiar de archivo tira lo que hubiera en pantalla: esas
            // variantes son de la foto anterior.
            olvidarVariantes();
            setArchivo(evento.target.files?.[0] ?? null);
          }}
        />
      </Campo>

      {/* Apilado en el teléfono: al lado de la miniatura la columna de botones
          queda tan angosta que «Mejorar imagen con IA» se parte en dos
          renglones y la explicación baja en hilera. */}
      {archivo && variantes.length === 0 && (
        <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row">
          <div className="w-28 shrink-0">
            <div className="aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
              {previa && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previa}
                  alt={`Vista previa de ${archivo.name}`}
                  className="size-full object-contain"
                />
              )}
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {archivo.name}
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Boton
                type="button"
                onClick={() => pedirVariantes(false)}
                disabled={generando}
              >
                {generando && !pidioIA ? "Preparando la foto…" : "Usar esta foto"}
              </Boton>

              {hayIA && (
                <Boton
                  type="button"
                  variante="contorno"
                  onClick={() => pedirVariantes(true)}
                  disabled={generando}
                >
                  {generando && pidioIA
                    ? "Mejorando la imagen…"
                    : "Mejorar imagen con IA"}
                </Boton>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Se publica encuadrada en cuadrado, con la luz levantada y el fondo
              emparejado.
              {hayIA &&
                " La IA además reemplaza el fondo por un escenario de estudio y te deja comparar; tarda unos 10 segundos."}
            </p>
          </div>
        </div>
      )}

      {estado.ok === false && estado.mensaje && (
        <Alerta tipo="error" className="mt-3">
          {estado.mensaje}
        </Alerta>
      )}

      {estado.errorIA && (
        <Alerta tipo="error" className="mt-3">
          {estado.errorIA}
        </Alerta>
      )}

      {variantes.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700">
            {hayComparacion ? "Elegí con cuál se publica" : "Así queda"}
            {archivo && (
              <span className="font-normal text-slate-500">
                {" · "}
                {archivo.name}
              </span>
            )}
          </p>

          <div
            className={cn(
              "mt-3 grid gap-3",
              hayComparacion ? "sm:grid-cols-2" : "max-w-[15rem]",
            )}
          >
            {variantes.map((variante, indice) => {
              const seleccionada = elegida === variante.clave;

              const lamina = (
                <>
                  <div className="aspect-square w-full overflow-hidden rounded bg-slate-100">
                    {/* La URL sale de Supabase Storage y la miniatura es chica;
                        no vale la pena pasarla por el optimizador de Next. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={variante.url}
                      alt={variante.titulo}
                      className="size-full object-cover"
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-slate-800">
                    {variante.titulo}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-500">
                    {variante.detalle}
                  </p>
                </>
              );

              // Una sola versión no es una elección: mostrarla con el marco de
              // seleccionada sugeriría que hay otra en algún lado.
              if (!hayComparacion) {
                return (
                  <div
                    key={variante.clave}
                    className="rounded-lg border-2 border-slate-200 bg-white p-2"
                  >
                    {lamina}
                  </div>
                );
              }

              return (
                <label
                  key={variante.clave}
                  className={cn(
                    "cursor-pointer rounded-lg border-2 bg-white p-2 transition-colors",
                    seleccionada
                      ? "border-municipal-500 ring-2 ring-municipal-500/20"
                      : "border-slate-200 hover:border-celeste-300",
                  )}
                >
                  <span className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    {indice === 0 ? "Antes" : "Después"}
                  </span>
                  <input
                    type="radio"
                    name="varianteElegida"
                    value={variante.clave}
                    checked={seleccionada}
                    onChange={() => setElegida(variante.clave)}
                    form={SIN_FORMULARIO}
                    className="sr-only"
                  />
                  {lamina}
                </label>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Boton type="button" onClick={confirmar}>
              Agregar al producto
            </Boton>
            <Boton
              type="button"
              variante="fantasma"
              onClick={descartar}
              className="text-slate-600"
            >
              <IconoCerrar className="size-3.5" />
              Descartar
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
