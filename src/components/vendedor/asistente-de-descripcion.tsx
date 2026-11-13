"use client";

import type { Rubro } from "@prisma/client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";

import {
  prepararEntrevista,
  redactarDescripcion,
} from "@/actions/descripcion-ia";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { BORDE_NORMAL, ESTILO_CONTROL } from "@/components/ui/campo";
import { IconoCerrar } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import {
  alcanzaParaMejorar,
  MAXIMO_RESPUESTA,
  respuestasContestadas,
  type ModoRedaccion,
  type PuertaRedaccion,
  type RespuestaEntrevista,
} from "@/lib/redaccion";

/**
 * Redacción asistida de la descripción del emprendimiento.
 *
 * Con poco escrito, hace una entrevista: 4 o 5 preguntas cortas que se
 * contestan de a una, y al final arma el texto sólo con lo contestado. Con
 * bastante escrito, ofrece pulirlo.
 *
 * Vive **dentro** del formulario del perfil o de la encuesta, así que no puede
 * tener su propio `<form>`: los botones son `type="button"` para no enviar el
 * formulario sin querer, y el campo de las respuestas no tiene `name` para no
 * viajar con él.
 *
 * La propuesta nunca reemplaza el texto sola: hay que aceptarla. Y si se acepta,
 * queda a mano el texto anterior para volver, porque lo que se pisa es algo que
 * el feriante escribió.
 */
export function AsistenteDeDescripcion({
  valor,
  nombreEmprendimiento,
  rubro,
  onAplicar,
  puerta = "perfil",
}: {
  /** Lo que hay hoy en el campo. */
  valor: string;
  /** Se mandan al prompt para ambientar las preguntas y el texto. */
  nombreEmprendimiento: string;
  /** Vacío mientras no se eligió: en la encuesta del alta arranca así. */
  rubro: Rubro | "";
  onAplicar: (texto: string) => void;
  /**
   * El perfil exige un feriante aprobado; la encuesta del alta, sólo la
   * sesión, porque todavía no hay ficha.
   */
  puerta?: PuertaRedaccion;
}) {
  const [pendiente, iniciar] = useTransition();
  const [esperando, setEsperando] = useState<"preguntas" | "texto" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [entrevista, setEntrevista] = useState<{
    preguntas: string[];
    respuestas: string[];
  } | null>(null);
  const [indice, setIndice] = useState(0);
  const [propuesta, setPropuesta] = useState<{
    texto: string;
    modo: ModoRedaccion;
  } | null>(null);

  // Texto que había antes de aplicar una sugerencia, para poder volver.
  const [previo, setPrevio] = useState<string | null>(null);

  const vaAMejorar = alcanzaParaMejorar(valor);
  // Sin nombre ni rubro la IA no sabe de qué escribir. En el perfil siempre
  // están; en la encuesta del alta, no hasta que la persona los completa.
  const faltaContexto = !nombreEmprendimiento.trim() || !rubro;
  const abierto = entrevista !== null || propuesta !== null;

  function pedido() {
    return {
      puerta,
      emprendimiento: nombreEmprendimiento,
      rubro,
      descripcion: valor,
    };
  }

  function empezar() {
    if (vaAMejorar) {
      redactar();
      return;
    }

    setError(null);
    setEsperando("preguntas");
    iniciar(async () => {
      const estado = await prepararEntrevista(pedido());
      if (!estado.ok || !estado.preguntas?.length) {
        setError(estado.mensaje ?? "No se pudieron preparar las preguntas.");
        return;
      }
      setEntrevista({
        preguntas: estado.preguntas,
        respuestas: estado.preguntas.map(() => ""),
      });
      setIndice(0);
    });
  }

  /** Sin respuestas, pule lo escrito; con respuestas, escribe con ellas. */
  function redactar(respuestas?: RespuestaEntrevista[]) {
    setError(null);
    setEsperando("texto");
    iniciar(async () => {
      const estado = await redactarDescripcion(pedido(), respuestas);
      if (!estado.ok || !estado.sugerencia) {
        setError(estado.mensaje ?? "No se pudo redactar la descripción.");
        return;
      }
      setPropuesta({
        texto: estado.sugerencia,
        modo: estado.modo ?? (respuestas ? "entrevista" : "mejorar"),
      });
    });
  }

  function respuestasDeLaEntrevista(): RespuestaEntrevista[] | undefined {
    return entrevista?.preguntas.map((pregunta, i) => ({
      pregunta,
      respuesta: entrevista.respuestas[i] ?? "",
    }));
  }

  /** Recibe las respuestas finales: la última puede no estar todavía en el estado. */
  function terminarEntrevista(finales: string[]) {
    if (!entrevista) return;
    setEntrevista({ ...entrevista, respuestas: finales });
    const respuestas = entrevista.preguntas.map((pregunta, i) => ({
      pregunta,
      respuesta: finales[i] ?? "",
    }));
    if (respuestasContestadas(respuestas).length === 0 && !valor.trim()) {
      setError("No contestaste ninguna pregunta, así que no hay de qué escribir.");
      return;
    }
    redactar(respuestas);
  }

  function cerrar() {
    setEntrevista(null);
    setPropuesta(null);
    setError(null);
  }

  function aplicar() {
    if (!propuesta) return;
    setPrevio(valor);
    onAplicar(propuesta.texto);
    cerrar();
  }

  function volver() {
    if (previo === null) return;
    onAplicar(previo);
    setPrevio(null);
  }

  return (
    <div className="space-y-3">
      {!abierto && (
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            type="button"
            variante="contorno"
            tamanio="sm"
            onClick={empezar}
            disabled={pendiente || faltaContexto}
          >
            {pendiente
              ? esperando === "preguntas"
                ? "Preparando preguntas…"
                : "Escribiendo…"
              : vaAMejorar
                ? "Mejorar con IA"
                : "Ayudame a escribirla"}
          </Boton>

          {faltaContexto ? (
            <span className="text-xs text-slate-500">
              Completá el nombre y el rubro, así la IA sabe de qué escribir.
            </span>
          ) : (
            !vaAMejorar && (
              <span className="text-xs text-slate-500">
                Te hacemos unas preguntas cortas y con eso armamos el texto.
              </span>
            )
          )}
        </div>
      )}

      {previo !== null && previo.trim().length > 0 && !abierto && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-celeste-200 bg-celeste-50 px-3 py-2">
          <p className="text-xs text-celeste-900">
            Reemplazamos tu texto por el de la IA.
          </p>
          <button
            type="button"
            onClick={volver}
            className="text-xs font-semibold text-celeste-900 underline underline-offset-2 hover:text-municipal-700"
          >
            Volver a lo que tenía
          </button>
        </div>
      )}

      {entrevista && !propuesta && (
        <Entrevista
          preguntas={entrevista.preguntas}
          respuestas={entrevista.respuestas}
          indice={indice}
          escribiendo={pendiente && esperando === "texto"}
          onResponder={(texto) =>
            setEntrevista({
              ...entrevista,
              respuestas: entrevista.respuestas.map((r, i) =>
                i === indice ? texto : r,
              ),
            })
          }
          onIr={(destino) => {
            setError(null);
            setIndice(destino);
          }}
          onTerminar={terminarEntrevista}
          onCancelar={cerrar}
        />
      )}

      {error && <Alerta tipo="error">{error}</Alerta>}

      {propuesta && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-700">
            {propuesta.modo === "mejorar"
              ? "Propuesta: lo mismo que escribiste, mejor redactado"
              : "Tu descripción, con lo que contaste"}
          </p>

          <p className="mt-2 whitespace-pre-line rounded border border-slate-200 bg-white p-3 text-sm text-slate-800">
            {propuesta.texto}
          </p>

          <p className="mt-1.5 text-xs text-slate-500">
            {propuesta.texto.length} caracteres
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Boton type="button" tamanio="sm" onClick={aplicar} disabled={pendiente}>
              Usar esta redacción
            </Boton>
            <Boton
              type="button"
              variante="contorno"
              tamanio="sm"
              onClick={() => redactar(respuestasDeLaEntrevista())}
              disabled={pendiente}
            >
              {pendiente ? "Escribiendo…" : "Probar otra"}
            </Boton>
            {propuesta.modo === "entrevista" && (
              <Boton
                type="button"
                variante="fantasma"
                tamanio="sm"
                onClick={() => {
                  setPropuesta(null);
                  setIndice(0);
                }}
                disabled={pendiente}
              >
                Cambiar respuestas
              </Boton>
            )}
            <Boton
              type="button"
              variante="fantasma"
              tamanio="sm"
              onClick={cerrar}
              disabled={pendiente}
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

/**
 * Las preguntas, de a una.
 *
 * El campo es siempre el mismo y sólo cambia su contenido, y los botones no se
 * quedan con el foco al tocarlos: así, en el celular, el teclado sigue abierto
 * de una pregunta a la otra en vez de cerrarse y abrirse cada vez.
 */
function Entrevista({
  preguntas,
  respuestas,
  indice,
  escribiendo,
  onResponder,
  onIr,
  onTerminar,
  onCancelar,
}: {
  preguntas: string[];
  respuestas: string[];
  indice: number;
  /** Mientras se arma el texto final. */
  escribiendo: boolean;
  onResponder: (texto: string) => void;
  onIr: (indice: number) => void;
  onTerminar: (respuestas: string[]) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const campo = useRef<HTMLTextAreaElement>(null);

  const total = preguntas.length;
  const respuesta = respuestas[indice] ?? "";
  const esLaUltima = indice === total - 1;
  const contestada = respuesta.trim().length > 0;

  // En la compu el foco va solo al campo. En pantallas táctiles no: abriría el
  // teclado sin que nadie lo pidiera y taparía la pregunta.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) campo.current?.focus();
  }, [indice]);

  function siguiente(actual = respuesta) {
    if (esLaUltima) {
      onTerminar(respuestas.map((r, i) => (i === indice ? actual : r)));
    } else {
      onResponder(actual);
      onIr(indice + 1);
    }
  }

  function saltear() {
    siguiente("");
  }

  function alApretarTecla(evento: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter pasa a la siguiente, como en un chat; Shift+Enter baja de renglón.
    if (evento.key !== "Enter" || evento.shiftKey || evento.nativeEvent.isComposing) {
      return;
    }
    evento.preventDefault();
    if (contestada && !escribiendo) siguiente();
  }

  // Que tocar un botón no le saque el foco al campo (ver el comentario de arriba).
  const sinRobarFoco = {
    onMouseDown: (evento: { preventDefault: () => void }) =>
      evento.preventDefault(),
  };

  return (
    <div className="rounded-lg border border-municipal-200 bg-municipal-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-municipal-700">
          Pregunta {indice + 1} de {total}
        </p>
        <button
          type="button"
          onClick={onCancelar}
          disabled={escribiendo}
          aria-label="Cerrar las preguntas"
          className="-m-1.5 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 disabled:opacity-50"
        >
          <IconoCerrar className="size-4" />
        </button>
      </div>

      {/* Cada tramo lleva a su pregunta, para volver a una sin pasar por
          todas. Se pintan las contestadas y la actual. */}
      <div className="mt-1 flex gap-1">
        {preguntas.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onIr(i)}
            disabled={escribiendo}
            aria-label={`Ir a la pregunta ${i + 1}`}
            aria-current={i === indice ? "step" : undefined}
            className="flex-1 py-1.5"
            {...sinRobarFoco}
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors",
                i === indice
                  ? "bg-municipal-500"
                  : respuestas[i]?.trim()
                    ? "bg-municipal-300"
                    : "bg-slate-200",
              )}
            />
          </button>
        ))}
      </div>

      {/* Con el foco en el campo, cambiar la pregunta no se anuncia solo. */}
      <label
        htmlFor={id}
        aria-live="polite"
        className="mt-2 block text-sm font-medium text-slate-900"
      >
        {preguntas[indice]}
      </label>

      <textarea
        id={id}
        ref={campo}
        rows={3}
        maxLength={MAXIMO_RESPUESTA}
        value={respuesta}
        onChange={(evento) => onResponder(evento.target.value)}
        onKeyDown={alApretarTecla}
        enterKeyHint={esLaUltima ? "done" : "next"}
        disabled={escribiendo}
        className={cn(ESTILO_CONTROL, BORDE_NORMAL, "mt-2 resize-y")}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Boton
          type="button"
          tamanio="sm"
          onClick={() => siguiente()}
          disabled={!contestada || escribiendo}
          {...sinRobarFoco}
        >
          {escribiendo
            ? "Escribiendo tu descripción…"
            : esLaUltima
              ? "Armar el texto"
              : "Siguiente"}
        </Boton>
        <Boton
          type="button"
          variante="contorno"
          tamanio="sm"
          onClick={saltear}
          disabled={escribiendo}
          {...sinRobarFoco}
        >
          Saltear
        </Boton>
        {indice > 0 && (
          <Boton
            type="button"
            variante="fantasma"
            tamanio="sm"
            onClick={() => onIr(indice - 1)}
            disabled={escribiendo}
            className="text-slate-600"
            {...sinRobarFoco}
          >
            Anterior
          </Boton>
        )}
      </div>
    </div>
  );
}
