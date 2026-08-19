import type {
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

/**
 * Campos de formulario.
 *
 * Todos reciben `errores` (el arreglo que devuelve Zod para ese campo) y se
 * encargan de mostrarlo, marcar el borde en rojo y enlazarlo con
 * `aria-describedby` para los lectores de pantalla.
 */

const ESTILO_CONTROL =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-municipal-500/30 " +
  "disabled:bg-slate-50 disabled:text-slate-500";

const BORDE_NORMAL = "border-slate-300 focus:border-municipal-500";
const BORDE_ERROR = "border-red-400 focus:border-red-500 focus:ring-red-500/30";

interface PropsCampo {
  /** Debe coincidir con el `name` del control para enlazar el `<label>`. */
  htmlFor: string;
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  errores?: string[];
  requerido?: boolean;
  className?: string;
  children: ReactNode;
}

export function Campo({
  htmlFor,
  etiqueta,
  ayuda,
  errores,
  requerido = false,
  className,
  children,
}: PropsCampo) {
  const hayError = Boolean(errores && errores.length > 0);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {etiqueta}
        {requerido && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {ayuda && !hayError && (
        <p id={`${htmlFor}-ayuda`} className="text-xs text-slate-500">
          {ayuda}
        </p>
      )}

      {hayError && (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-red-600">
          {errores?.join(" ")}
        </p>
      )}
    </div>
  );
}

interface PropsEntrada extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  errores?: string[];
}

export function Entrada({ name, errores, className, ...props }: PropsEntrada) {
  const hayError = Boolean(errores && errores.length > 0);

  return (
    <input
      id={name}
      name={name}
      aria-invalid={hayError || undefined}
      aria-describedby={hayError ? `${name}-error` : `${name}-ayuda`}
      className={cn(
        ESTILO_CONTROL,
        hayError ? BORDE_ERROR : BORDE_NORMAL,
        className,
      )}
      {...props}
    />
  );
}

interface PropsAreaTexto extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  errores?: string[];
}

export function AreaTexto({
  name,
  errores,
  className,
  rows = 4,
  ...props
}: PropsAreaTexto) {
  const hayError = Boolean(errores && errores.length > 0);

  return (
    <textarea
      id={name}
      name={name}
      rows={rows}
      aria-invalid={hayError || undefined}
      aria-describedby={hayError ? `${name}-error` : `${name}-ayuda`}
      className={cn(
        ESTILO_CONTROL,
        "resize-y",
        hayError ? BORDE_ERROR : BORDE_NORMAL,
        className,
      )}
      {...props}
    />
  );
}

interface PropsSeleccion extends SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  errores?: string[];
  opciones: Array<{ valor: string; etiqueta: string }>;
  /** Texto de la opción vacía inicial. Si se omite, no se agrega. */
  placeholder?: string;
}

export function Seleccion({
  name,
  errores,
  opciones,
  placeholder,
  className,
  ...props
}: PropsSeleccion) {
  const hayError = Boolean(errores && errores.length > 0);

  return (
    <select
      id={name}
      name={name}
      aria-invalid={hayError || undefined}
      aria-describedby={hayError ? `${name}-error` : `${name}-ayuda`}
      className={cn(
        ESTILO_CONTROL,
        "appearance-none bg-[length:1.1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%2364748b%22 stroke-width=%222%22%3E%3Cpath stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E')]",
        hayError ? BORDE_ERROR : BORDE_NORMAL,
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.etiqueta}
        </option>
      ))}
    </select>
  );
}

// `ComponentProps<"input">` en lugar de `InputHTMLAttributes` para que acepten
// `ref` como prop, que es la forma de React 19 de referenciar el input desde el
// llamador sin envolver el componente en `forwardRef`.
interface PropsCasilla extends ComponentProps<"input"> {
  name: string;
  etiqueta: ReactNode;
  ayuda?: ReactNode;
}

export function Casilla({
  name,
  etiqueta,
  ayuda,
  className,
  ...props
}: PropsCasilla) {
  return (
    <div className={cn("flex gap-2.5", className)}>
      <input
        type="checkbox"
        id={name}
        name={name}
        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-municipal-500 focus:ring-2 focus:ring-municipal-500/40"
        {...props}
      />
      <div className="min-w-0">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-slate-700"
        >
          {etiqueta}
        </label>
        {ayuda && <p className="text-xs text-slate-500">{ayuda}</p>}
      </div>
    </div>
  );
}

interface PropsCampoArchivo extends ComponentProps<"input"> {
  name: string;
  errores?: string[];
}

export function CampoArchivo({
  name,
  errores,
  className,
  accept = "image/jpeg,image/png,image/webp,image/avif",
  ...props
}: PropsCampoArchivo) {
  const hayError = Boolean(errores && errores.length > 0);

  return (
    <input
      type="file"
      id={name}
      name={name}
      accept={accept}
      aria-invalid={hayError || undefined}
      aria-describedby={hayError ? `${name}-error` : `${name}-ayuda`}
      className={cn(
        "block w-full rounded-lg border text-sm text-slate-600 shadow-sm",
        "file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2.5",
        "file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200",
        hayError ? "border-red-400" : "border-slate-300",
        className,
      )}
      {...props}
    />
  );
}
