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
import { Campo, CampoArchivo, Casilla } from "@/components/ui/campo";
import { IconoCerrar } from "@/components/ui/iconos";

/**
 * Elegir una foto de producto entre las tres versiones.
 *
 * Vive **dentro** del formulario del producto, así que no puede tener su propio
 * `<form>`: los formularios anidados son HTML inválido. La acción se dispara por
 * click, armando el `FormData` a mano desde las referencias a los campos. Eso
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
}) {
  const [estado, generar, generando] = useActionState(
    generarVariantesDeFoto,
    ESTADO_VARIANTES_INICIAL,
  );

  const archivoRef = useRef<HTMLInputElement>(null);
  const iaRef = useRef<HTMLInputElement>(null);

  const [elegida, setElegida] = useState<ClaveVariante>("automatica");
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  // El estado de `useActionState` no se puede limpiar desde acá, así que las
  // variantes siguen ahí después de confirmar. Sin esta bandera, un segundo
  // click en «Usar esta foto» agregaría la misma ruta de nuevo.
  const [abierto, setAbierto] = useState(false);

  // Mientras se regenera no mostramos las anteriores: serían de otra foto.
  const variantes = abierto && !generando ? (estado.variantes ?? []) : [];

  function pedirVariantes() {
    const archivo = archivoRef.current?.files?.[0];
    if (!archivo) return;

    setAbierto(true);

    const datos = new FormData();
    datos.set("foto", archivo);
    if (iaRef.current?.checked) datos.set("usarIA", "on");
    datos.set("nombre", nombreProducto);
    datos.set("descripcion", descripcionProducto);

    // Sin `startTransition`, `generando` nunca se pone en true: el botón no se
    // deshabilita y el feriante puede clickear de nuevo y pagar otra generación
    // de IA. Hace falta porque despachamos por click y no por `action` del form.
    startTransition(() => generar(datos));
  }

  function limpiar() {
    if (archivoRef.current) archivoRef.current.value = "";
    setNombreArchivo(null);
    setElegida("automatica");
    setAbierto(false);
  }

  function confirmar() {
    const variante = variantes.find((v) => v.clave === elegida) ?? variantes[0];
    if (!variante) return;

    onConfirmar(
      variante,
      variantes.filter((v) => v.ruta !== variante.ruta).map((v) => v.ruta),
    );
    limpiar();
  }

  function descartar() {
    onConfirmar(
      null,
      variantes.map((v) => v.ruta),
    );
    limpiar();
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
      <div className="space-y-3">
        <Campo
          htmlFor="fotoNueva"
          etiqueta="Agregar una foto"
          ayuda={`Podés agregar ${disponibles} más. JPG, PNG, WEBP o AVIF, hasta 5 MB.`}
        >
          <CampoArchivo
            name="fotoNueva"
            ref={archivoRef}
            form={SIN_FORMULARIO}
            onChange={(evento) =>
              setNombreArchivo(evento.target.files?.[0]?.name ?? null)
            }
          />
        </Campo>

        <Casilla
          name="usarIANueva"
          ref={iaRef}
          form={SIN_FORMULARIO}
          etiqueta="Generar también una versión con IA"
          ayuda="Reemplaza el fondo por un escenario de estudio. Tarda unos 10 segundos."
        />

        <Boton
          type="button"
          variante="contorno"
          onClick={pedirVariantes}
          disabled={generando || !nombreArchivo}
        >
          {generando ? "Procesando la foto…" : "Ver las versiones"}
        </Boton>
      </div>

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
            Elegí con cuál se publica
            {nombreArchivo && (
              <span className="font-normal text-slate-500">
                {" · "}
                {nombreArchivo}
              </span>
            )}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {variantes.map((variante) => {
              const seleccionada = elegida === variante.clave;
              return (
                <label
                  key={variante.clave}
                  className={
                    "cursor-pointer rounded-lg border-2 bg-white p-2 transition-colors " +
                    (seleccionada
                      ? "border-municipal-500 ring-2 ring-municipal-500/20"
                      : "border-slate-200 hover:border-celeste-300")
                  }
                >
                  <input
                    type="radio"
                    name="varianteElegida"
                    value={variante.clave}
                    checked={seleccionada}
                    onChange={() => setElegida(variante.clave)}
                    form={SIN_FORMULARIO}
                    className="sr-only"
                  />
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
                </label>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Boton type="button" onClick={confirmar}>
              Usar esta foto
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
