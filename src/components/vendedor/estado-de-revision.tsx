import { descartarCambioDelStand } from "@/actions/vendedores";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { cn } from "@/lib/cn";
import type { EstadoDeRevision as Estado } from "@/lib/revision";

/** El botón chico de adentro del cartel: un enlace más que un botón. */
const ESTILO_ACCION =
  "h-auto px-1 py-0 text-xs font-semibold underline underline-offset-2";

/**
 * El cartel que acompaña a una parte del stand mientras espera la revisión de
 * la administración, o después de que la rechazaron.
 *
 * · Pendiente: el feriante ve su versión nueva, pero el vecino todavía ve la
 *   anterior. Se puede descartar y volver a lo publicado.
 * · Rechazado: se ve lo publicado y el motivo, para corregirlo y volver a
 *   mandar. «Entendido» lo saca de la vista.
 *
 * `sinDescartar` es para el alta de un producto: ahí descartar es eliminarlo,
 * y para eso ya está el botón de la tarjeta.
 */
export function EstadoDeRevision({
  revision,
  que,
  sinDescartar = false,
  className,
}: {
  revision: Estado;
  /** Qué parte es, cuando el cartel no está pegado a ella: «Logo». */
  que?: string;
  sinDescartar?: boolean;
  className?: string;
}) {
  const prefijo = que ? `${que}: ` : "";

  if (revision.estado === "RECHAZADO") {
    return (
      <div
        className={cn(
          "rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900 ring-1 ring-red-200",
          className,
        )}
      >
        <p>
          <span className="font-semibold">
            {prefijo}
            {que ? "no se aprobó." : "No se aprobó."}
          </span>{" "}
          {revision.motivo}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-red-800">
          <span>Corregilo y volvé a guardar.</span>
          {!sinDescartar && (
            <BotonConfirmar
              accion={descartarCambioDelStand}
              campos={{ cambioId: revision.id }}
              variante="fantasma"
              className={cn(ESTILO_ACCION, "text-red-800 hover:bg-red-100")}
            >
              Entendido
            </BotonConfirmar>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <span
          className="size-1.5 shrink-0 rounded-full bg-amber-500"
          aria-hidden="true"
        />
        {prefijo}
        {que ? "en revisión" : "En revisión"}
      </span>
      <span className="text-amber-800">Los vecinos ven lo anterior.</span>
      {!sinDescartar && (
        <BotonConfirmar
          accion={descartarCambioDelStand}
          campos={{ cambioId: revision.id }}
          confirmacion="¿Descartar este cambio? Queda lo que está publicado."
          variante="fantasma"
          className={cn(ESTILO_ACCION, "text-amber-900 hover:bg-amber-100")}
        >
          Descartar
        </BotonConfirmar>
      )}
    </div>
  );
}
