"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  crearBorradorConFoto,
  enviarBorradores,
  guardarBorrador,
} from "@/actions/borradores";
import { eliminarProducto } from "@/actions/productos";
import { Alerta } from "@/components/ui/alerta";
import { Boton, estilosBoton } from "@/components/ui/boton";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { AreaTexto, Entrada } from "@/components/ui/campo";
import { IconoEtiqueta } from "@/components/ui/iconos";
import { borradorCompleto, MAXIMO_BORRADORES } from "@/lib/borradores";
import { cn } from "@/lib/cn";

/*
  La pantalla de borradores: subir varias fotos de una vez —cada una se
  vuelve un producto— y ponerles nombre y descripción a todas en el mismo
  lugar. Lo que se escribe se guarda solo. Al final, se mandan a revisión
  todas las que tienen nombre.
*/

/** El tope de una foto, igual que en el servidor: mandarla más grande es en vano. */
const MAXIMO_BYTES = 5 * 1024 * 1024;

/** Cuánto espera después de lo último que se escribió para guardar. */
const ESPERA_MS = 800;

export function SubirVariasFotos({ lugares }: { lugares: number }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [progreso, setProgreso] = useState<{
    hechas: number;
    total: number;
  } | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  async function subir(archivos: File[]): Promise<void> {
    const grandes = archivos.filter((archivo) => archivo.size > MAXIMO_BYTES);
    const validas = archivos.filter((archivo) => archivo.size <= MAXIMO_BYTES);
    const tanda = validas.slice(0, lugares);
    const sinLugar = validas.length - tanda.length;

    const nuevosAvisos = [
      ...grandes.map(
        (archivo) => `${archivo.name}: pesa más de 5 MB, no se subió.`,
      ),
      ...(sinLugar > 0
        ? [
            `${sinLugar === 1 ? "Una foto no entró" : `${sinLugar} fotos no entraron`}: podés tener hasta ${MAXIMO_BORRADORES} borradores a la vez.`,
          ]
        : []),
    ];
    setAvisos(nuevosAvisos);
    if (tanda.length === 0) return;

    // De a una: cada foto es un pedido al servidor, que la acomoda y crea su
    // borrador. Así ninguna pasa el tope de tamaño de un pedido, y las que
    // ya subieron aparecen abajo mientras siguen las demás.
    setProgreso({ hechas: 0, total: tanda.length });
    for (const [indice, archivo] of tanda.entries()) {
      const datos = new FormData();
      datos.set("foto", archivo);
      const resultado = await crearBorradorConFoto(datos).catch(() => ({
        ok: false as const,
        mensaje: "No se pudo subir.",
      }));
      if (!resultado.ok) {
        setAvisos((actuales) => [
          ...actuales,
          `${archivo.name}: ${resultado.mensaje}`,
        ]);
      }
      setProgreso({ hechas: indice + 1, total: tanda.length });
      router.refresh();
    }
    setProgreso(null);
    if (entrada.current) entrada.current.value = "";
  }

  const subiendo = progreso !== null;

  return (
    <section className="rounded-xl border-2 border-dashed border-municipal-300 bg-municipal-50/50 p-5">
      <h2 className="font-semibold text-slate-900">
        Subí varias fotos de una vez
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Cada foto se vuelve un producto. Después, abajo, les ponés nombre y
        descripción.
        {lugares > 0
          ? ` Podés subir hasta ${lugares} más.`
          : ` Ya tenés ${MAXIMO_BORRADORES} borradores: mandá a revisión o borrá alguno para subir más.`}
      </p>

      {lugares > 0 && (
        <label
          className={cn(
            estilosBoton("primario"),
            "mt-4 cursor-pointer",
            subiendo && "pointer-events-none opacity-60",
          )}
        >
          {subiendo
            ? `Subiendo ${Math.min(progreso.hechas + 1, progreso.total)} de ${progreso.total}…`
            : "Elegir fotos"}
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            disabled={subiendo}
            className="sr-only"
            onChange={(evento) =>
              void subir(Array.from(evento.target.files ?? []))
            }
          />
        </label>
      )}

      {avisos.length > 0 && (
        <Alerta tipo="advertencia" className="mt-4">
          {avisos.map((aviso) => (
            <span key={aviso} className="block">
              {aviso}
            </span>
          ))}
        </Alerta>
      )}
    </section>
  );
}

export interface BorradorEnLista {
  id: string;
  nombre: string;
  descripcion: string;
  /** La URL de la primera foto, si tiene. */
  foto: string | null;
  /** «el jueves 3 de diciembre». */
  seBorra: string;
}

export function ListaDeBorradores({
  borradores,
}: {
  borradores: BorradorEnLista[];
}) {
  const router = useRouter();
  // El nombre de cada uno como está en pantalla, para contar los listos sin
  // esperar a que se guarden, y cuáles tienen un guardado en camino.
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [pendientes, setPendientes] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const alCambiarNombre = useCallback((id: string, nombre: string) => {
    setNombres((actuales) => ({ ...actuales, [id]: nombre }));
  }, []);
  const alCambiarPendiente = useCallback((id: string, pendiente: boolean) => {
    setPendientes((actuales) => ({ ...actuales, [id]: pendiente }));
  }, []);

  const listos = borradores.filter((borrador) =>
    borradorCompleto(nombres[borrador.id] ?? borrador.nombre),
  ).length;
  const guardando = Object.values(pendientes).some(Boolean);

  async function enviar(): Promise<void> {
    setEnviando(true);
    setResultado(null);
    const respuesta = await enviarBorradores().catch(() => null);
    setEnviando(false);
    if (!respuesta?.ok) {
      setResultado(
        respuesta?.mensaje ??
          "No se pudieron mandar a revisión. Probá de nuevo.",
      );
      return;
    }
    if (respuesta.sinNombre === 0) {
      router.push("/mi-stand?enviados=1#catalogo");
      return;
    }
    setResultado(
      `${respuesta.enviados === 1 ? "Mandaste 1 producto" : `Mandaste ${respuesta.enviados} productos`} a revisión. ${respuesta.sinNombre === 1 ? "Queda 1 sin nombre" : `Quedan ${respuesta.sinNombre} sin nombre`}: ponéselo para mandarlo${respuesta.sinNombre === 1 ? "" : "s"} también.`,
    );
    router.refresh();
  }

  if (borradores.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        No tenés borradores. Subí fotos acá arriba, o{" "}
        <Link
          href="/mi-stand/productos/nuevo"
          className="font-medium text-municipal-600 hover:text-municipal-700"
        >
          agregá un producto de a uno
        </Link>
        .
      </p>
    );
  }

  return (
    <section>
      <ul className="space-y-3">
        {borradores.map((borrador) => (
          <FilaDeBorrador
            key={borrador.id}
            borrador={borrador}
            alCambiarNombre={alCambiarNombre}
            alCambiarPendiente={alCambiarPendiente}
          />
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-superficie p-4">
        <p className="mr-auto text-sm text-slate-600">
          {listos === borradores.length
            ? "Todos tienen nombre: ya los podés mandar a revisión."
            : `${listos} de ${borradores.length} tienen nombre. Los que no, se quedan como borradores.`}
        </p>
        <Boton
          type="button"
          onClick={() => void enviar()}
          disabled={listos === 0 || guardando || enviando}
        >
          {enviando
            ? "Mandando…"
            : guardando
              ? "Guardando…"
              : `Enviar ${listos === 1 ? "1 producto" : `${listos} productos`} a revisión`}
        </Boton>
      </div>

      {resultado && (
        <Alerta tipo="info" className="mt-4">
          {resultado}
        </Alerta>
      )}
    </section>
  );
}

function FilaDeBorrador({
  borrador,
  alCambiarNombre,
  alCambiarPendiente,
}: {
  borrador: BorradorEnLista;
  alCambiarNombre: (id: string, nombre: string) => void;
  alCambiarPendiente: (id: string, pendiente: boolean) => void;
}) {
  const [nombre, setNombre] = useState(borrador.nombre);
  const [descripcion, setDescripcion] = useState(borrador.descripcion);
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimo = useRef({ nombre, descripcion });

  const guardar = useCallback(async () => {
    temporizador.current = null;
    const datos = new FormData();
    datos.set("productoId", borrador.id);
    datos.set("nombre", ultimo.current.nombre);
    datos.set("descripcion", ultimo.current.descripcion);
    const resultado = await guardarBorrador(datos).catch(() => ({
      ok: false as const,
      mensaje: "No se pudo guardar.",
    }));
    setError(resultado.ok ? null : resultado.mensaje);
    if (!temporizador.current) alCambiarPendiente(borrador.id, false);
  }, [borrador.id, alCambiarPendiente]);

  function cambiar(campos: { nombre?: string; descripcion?: string }): void {
    ultimo.current = { ...ultimo.current, ...campos };
    if (campos.nombre !== undefined) {
      setNombre(campos.nombre);
      alCambiarNombre(borrador.id, campos.nombre);
    }
    if (campos.descripcion !== undefined) setDescripcion(campos.descripcion);
    alCambiarPendiente(borrador.id, true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void guardar(), ESPERA_MS);
  }

  // Si se va con un guardado esperando, sale igual.
  useEffect(
    () => () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        void guardar();
      }
    },
    [guardar],
  );

  const sinNombre = !borradorCompleto(nombre);

  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-superficie p-3 sm:gap-4 sm:p-4">
      <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:size-24">
        {borrador.foto ? (
          // Miniatura chica del almacenamiento: no vale la pena pasarla por el
          // optimizador de Next.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={borrador.foto}
            alt={nombre || "Foto del borrador"}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-slate-400">
            <IconoEtiqueta className="size-8" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <Entrada
          name={`nombre-${borrador.id}`}
          aria-label="Nombre del producto"
          placeholder="Nombre del producto"
          value={nombre}
          maxLength={140}
          onChange={(evento) => cambiar({ nombre: evento.target.value })}
        />
        <AreaTexto
          name={`descripcion-${borrador.id}`}
          aria-label="Descripción"
          placeholder="Descripción (opcional): materiales, medidas, variantes"
          rows={2}
          value={descripcion}
          maxLength={1500}
          onChange={(evento) => cambiar({ descripcion: evento.target.value })}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span
            className={
              error
                ? "text-red-700"
                : sinNombre
                  ? "text-acento-900"
                  : "text-slate-500"
            }
          >
            {error ??
              (sinNombre
                ? "Falta el nombre."
                : `Se borra ${borrador.seBorra} si no lo tocás.`)}
          </span>
          <Link
            href={`/mi-stand/productos/${borrador.id}`}
            className="font-medium text-municipal-600 hover:text-municipal-700"
          >
            Más fotos y opciones
          </Link>
          <BotonConfirmar
            accion={eliminarProducto}
            campos={{ productoId: borrador.id }}
            confirmacion={`¿Borrar ${nombre.trim() ? `«${nombre.trim()}»` : "este borrador"}? Se borra con su foto.`}
            variante="fantasma"
            className="ml-auto text-red-600 hover:bg-red-50"
          >
            Borrar
          </BotonConfirmar>
        </div>
      </div>
    </li>
  );
}
