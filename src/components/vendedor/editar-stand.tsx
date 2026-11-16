"use client";

import type { Rubro } from "@prisma/client";
import {
  useActionState,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { actualizarSeccionDelStand } from "@/actions/vendedores";
import { Alerta } from "@/components/ui/alerta";
import { AvisoDelEnvio } from "@/components/ui/aviso-flotante";
import { Boton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { CampoImagen } from "@/components/ui/campo-imagen";
import { Dialogo } from "@/components/ui/dialogo";
import { IconoCamara, IconoLapiz } from "@/components/ui/iconos";
import { AsistenteDeDescripcion } from "@/components/vendedor/asistente-de-descripcion";
import { cn } from "@/lib/cn";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/lib/form";
import { aOpciones, RUBROS } from "@/lib/labels";
import { urlPublica } from "@/lib/media";

/*
  Los lápices de «Mi stand».

  El feriante ve su stand tal como lo ve el vecino y edita cada parte ahí mismo,
  como en un perfil de red social: el botón está pegado a lo que cambia. Cada
  uno abre una ventana con los campos de esa parte y nada más, y al guardar se
  cierra y la página ya muestra lo nuevo.

  Antes esto era un formulario único, «Mi vidriera», en otra pestaña: para
  cambiar el logo había que encontrarlo entre catorce campos y después ir a ver
  cómo había quedado.
*/

/** Las partes que guarda `actualizarSeccionDelStand`, una por ventana. */
type SeccionDelStand = "portada" | "logo" | "identidad" | "descripcion" | "contacto";

/** El estilo de los lápices que van junto al texto. */
const ESTILO_LAPIZ =
  "inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-sm font-medium text-municipal-700 ring-1 ring-municipal-200 transition-colors hover:bg-municipal-50";

function BotonLapiz({
  onClick,
  children,
  etiqueta,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  /** Nombre accesible, cuando el texto visible no alcanza a decir qué edita. */
  etiqueta?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={cn(ESTILO_LAPIZ, className)}
    >
      <IconoLapiz className="size-3.5" />
      {children}
    </button>
  );
}

/**
 * El formulario de adentro de cada ventana.
 *
 * Al guardar bien le avisa a quien lo abrió, que cierra la ventana y muestra
 * el aviso verde: el aviso va afuera porque adentro se iría con la ventana.
 * Los errores sí se quedan acá, al lado de cada campo.
 */
function FormularioDeSeccion({
  seccion,
  textoGuardar,
  onGuardado,
  onCancelar,
  children,
}: {
  seccion: SeccionDelStand;
  textoGuardar: string;
  onGuardado: (estado: EstadoFormulario) => void;
  onCancelar: () => void;
  children: (errores: EstadoFormulario["errores"]) => ReactNode;
}) {
  const [estado, accion] = useActionState(
    actualizarSeccionDelStand,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (estado.ok) onGuardado(estado);
  }, [estado, onGuardado]);

  const errorGeneral =
    !estado.ok && estado.mensaje && !estado.errores ? estado.mensaje : null;

  return (
    <form action={accion} noValidate className="space-y-5">
      <input type="hidden" name="seccion" value={seccion} />
      {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

      {children(estado.errores)}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="contorno" onClick={onCancelar}>
          Cancelar
        </Boton>
        <BotonEnvio textoEnviando="Guardando…">{textoGuardar}</BotonEnvio>
      </div>
    </form>
  );
}

/**
 * Lo que comparten todos: el disparador, la ventana y el aviso de guardado.
 * `disparador` recibe la función de abrir para ponerla donde quiera.
 */
function Editor({
  titulo,
  descripcion,
  seccion,
  textoGuardar,
  disparador,
  anchoAmplio = false,
  children,
}: {
  titulo: string;
  descripcion?: string;
  seccion: SeccionDelStand;
  textoGuardar: string;
  disparador: (abrir: () => void) => ReactNode;
  anchoAmplio?: boolean;
  children: (errores: EstadoFormulario["errores"]) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardado, setGuardado] = useState<EstadoFormulario>(ESTADO_INICIAL);

  const cerrar = () => setAbierto(false);
  const alGuardar = (estado: EstadoFormulario) => {
    setGuardado(estado);
    setAbierto(false);
  };

  return (
    <>
      {disparador(() => setAbierto(true))}
      <AvisoDelEnvio estado={guardado} />
      <Dialogo
        abierto={abierto}
        onCerrar={cerrar}
        titulo={titulo}
        descripcion={descripcion}
        className={anchoAmplio ? "w-[min(100%-2rem,44rem)]" : undefined}
      >
        <FormularioDeSeccion
          seccion={seccion}
          textoGuardar={textoGuardar}
          onGuardado={alGuardar}
          onCancelar={cerrar}
        >
          {children}
        </FormularioDeSeccion>
      </Dialogo>
    </>
  );
}

// ---------------------------------------------------------------------------
// Portada y logo
// ---------------------------------------------------------------------------

/** Va sobre la foto de portada, abajo a la derecha. */
export function EditarPortada({ actual }: { actual: string | null }) {
  return (
    <Editor
      titulo={actual ? "Cambiar la portada" : "Agregar una portada"}
      descripcion="Es la foto grande que encabeza tu stand."
      seccion="portada"
      textoGuardar="Guardar portada"
      disparador={(abrir) => (
        <button
          type="button"
          onClick={abrir}
          className="inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-sm font-medium text-slate-800 shadow-md ring-1 ring-slate-900/10 backdrop-blur-sm transition-colors hover:bg-white"
        >
          <IconoCamara className="size-4" />
          {actual ? "Cambiar portada" : "Agregar portada"}
        </button>
      )}
    >
      {(errores) => (
        <CampoImagen
          name="imagenPortada"
          etiqueta="Foto de portada"
          ayuda="Apaisada y de al menos 1200 px de ancho. Hasta 5 MB."
          errores={errores?.imagenPortada}
          actual={urlPublica(actual)}
          vacio="Sin portada"
          forma="apaisada"
        />
      )}
    </Editor>
  );
}

/** Va sobre el círculo del logo, abajo a la derecha. */
export function EditarLogo({ actual }: { actual: string | null }) {
  return (
    <Editor
      titulo={actual ? "Cambiar el logo" : "Agregar un logo"}
      descripcion="Aparece en tu stand y en el catálogo de emprendedores."
      seccion="logo"
      textoGuardar="Guardar logo"
      disparador={(abrir) => (
        <button
          type="button"
          onClick={abrir}
          aria-label={actual ? "Cambiar el logo" : "Agregar un logo"}
          className="flex size-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-900/10 transition-colors hover:bg-slate-50 hover:text-municipal-700"
        >
          <IconoCamara className="size-4" />
        </button>
      )}
    >
      {(errores) => (
        <CampoImagen
          name="logo"
          etiqueta="Logo"
          ayuda="Cuadrado y de al menos 400 px. Hasta 5 MB."
          errores={errores?.logo}
          actual={urlPublica(actual)}
          vacio="Sin logo"
          forma="cuadrada"
        />
      )}
    </Editor>
  );
}

// ---------------------------------------------------------------------------
// Nombre y rubro
// ---------------------------------------------------------------------------

export function EditarIdentidad({
  emprendimiento,
  rubro,
}: {
  emprendimiento: string;
  rubro: Rubro;
}) {
  return (
    <Editor
      titulo="Nombre y rubro"
      seccion="identidad"
      textoGuardar="Guardar"
      disparador={(abrir) => (
        <BotonLapiz onClick={abrir} etiqueta="Editar el nombre y el rubro">
          Editar
        </BotonLapiz>
      )}
    >
      {(errores) => (
        <div className="space-y-4">
          <Campo
            htmlFor="emprendimiento"
            etiqueta="Nombre del emprendimiento"
            ayuda="Si lo cambiás, también cambia la dirección web de tu stand."
            errores={errores?.emprendimiento}
            requerido
          >
            <Entrada
              name="emprendimiento"
              defaultValue={emprendimiento}
              errores={errores?.emprendimiento}
              required
            />
          </Campo>
          <Campo
            htmlFor="rubro"
            etiqueta="Rubro"
            errores={errores?.rubro}
            requerido
          >
            <Seleccion
              name="rubro"
              defaultValue={rubro}
              opciones={aOpciones(RUBROS)}
              errores={errores?.rubro}
              required
            />
          </Campo>
        </div>
      )}
    </Editor>
  );
}

// ---------------------------------------------------------------------------
// Descripción
// ---------------------------------------------------------------------------

/**
 * El cuerpo de la ventana de la descripción. Es su propio componente porque
 * el texto es controlado —lo lee y lo reemplaza el asistente de redacción— y
 * tiene que arrancar de nuevo con lo guardado cada vez que se abre.
 */
function CamposDescripcion({
  inicial,
  emprendimiento,
  rubro,
  hayIA,
  errores,
}: {
  inicial: string;
  emprendimiento: string;
  rubro: Rubro;
  hayIA: boolean;
  errores: EstadoFormulario["errores"];
}) {
  const [texto, setTexto] = useState(inicial);

  return (
    <div className="space-y-4">
      <Campo
        htmlFor="descripcion"
        etiqueta="Descripción"
        ayuda="Contá qué hacés, con qué materiales trabajás y qué te distingue."
        errores={errores?.descripcion}
      >
        <AreaTexto
          name="descripcion"
          rows={7}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          errores={errores?.descripcion}
        />
      </Campo>

      {/* Sin IA configurada no se ofrece: apretarlo sólo devolvía un error. */}
      {hayIA && (
        <AsistenteDeDescripcion
          valor={texto}
          nombreEmprendimiento={emprendimiento}
          rubro={rubro}
          onAplicar={setTexto}
        />
      )}
    </div>
  );
}

export function EditarDescripcion({
  descripcion,
  emprendimiento,
  rubro,
  hayIA,
}: {
  descripcion: string | null;
  emprendimiento: string;
  rubro: Rubro;
  hayIA: boolean;
}) {
  return (
    <Editor
      titulo="Descripción"
      descripcion="Es lo primero que leen los vecinos al entrar a tu stand."
      seccion="descripcion"
      textoGuardar="Guardar descripción"
      anchoAmplio
      disparador={(abrir) =>
        descripcion ? (
          <BotonLapiz onClick={abrir} etiqueta="Editar la descripción">
            Editar descripción
          </BotonLapiz>
        ) : (
          // Sin descripción, el hueco se ofrece a sí mismo: en el stand
          // público esa parte directamente no aparece.
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="font-semibold text-slate-900">
              Contale a los vecinos qué hacés
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Qué vendés, cómo lo hacés y qué te distingue. Si no sabés por
              dónde empezar, te ayudamos con unas preguntas.
            </p>
            <Boton type="button" onClick={abrir} className="mt-4">
              <IconoLapiz className="size-4" />
              Escribir la descripción
            </Boton>
          </div>
        )
      }
    >
      {(errores) => (
        <CamposDescripcion
          inicial={descripcion ?? ""}
          emprendimiento={emprendimiento}
          rubro={rubro}
          hayIA={hayIA}
          errores={errores}
        />
      )}
    </Editor>
  );
}

// ---------------------------------------------------------------------------
// Contacto
// ---------------------------------------------------------------------------

export interface DatosDeContacto {
  whatsapp: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  instagram: string | null;
  facebook: string | null;
  sitioWeb: string | null;
}

export function EditarContacto({ contacto }: { contacto: DatosDeContacto }) {
  return (
    <Editor
      titulo="Contacto y redes"
      descripcion="El WhatsApp es el botón principal de tu stand."
      seccion="contacto"
      textoGuardar="Guardar contacto"
      anchoAmplio
      disparador={(abrir) => (
        <BotonLapiz onClick={abrir} etiqueta="Editar el contacto y las redes">
          Editar
        </BotonLapiz>
      )}
    >
      {(errores) => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="whatsapp"
              etiqueta="WhatsApp"
              ayuda="Ej. 381 512-3456."
              errores={errores?.whatsapp}
              requerido
            >
              <Entrada
                name="whatsapp"
                type="tel"
                inputMode="tel"
                defaultValue={contacto.whatsapp}
                errores={errores?.whatsapp}
                required
              />
            </Campo>
            <Campo
              htmlFor="telefono"
              etiqueta="Teléfono alternativo"
              errores={errores?.telefono}
            >
              <Entrada
                name="telefono"
                type="tel"
                inputMode="tel"
                defaultValue={contacto.telefono ?? ""}
                errores={errores?.telefono}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="email"
              etiqueta="Correo de contacto"
              ayuda="Puede ser distinto al de tu cuenta. Se publica en tu stand."
              errores={errores?.email}
            >
              <Entrada
                name="email"
                type="email"
                defaultValue={contacto.email ?? ""}
                errores={errores?.email}
              />
            </Campo>
            <Campo
              htmlFor="direccion"
              etiqueta="Dirección"
              ayuda="Uso administrativo. No se publica."
              errores={errores?.direccion}
            >
              <Entrada
                name="direccion"
                defaultValue={contacto.direccion ?? ""}
                errores={errores?.direccion}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              htmlFor="instagram"
              etiqueta="Instagram"
              errores={errores?.instagram}
            >
              <Entrada
                name="instagram"
                defaultValue={contacto.instagram ?? ""}
                placeholder="tuemprendimiento"
                errores={errores?.instagram}
              />
            </Campo>
            <Campo
              htmlFor="facebook"
              etiqueta="Facebook"
              errores={errores?.facebook}
            >
              <Entrada
                name="facebook"
                defaultValue={contacto.facebook ?? ""}
                placeholder="tuemprendimiento"
                errores={errores?.facebook}
              />
            </Campo>
            <Campo
              htmlFor="sitioWeb"
              etiqueta="Sitio web"
              errores={errores?.sitioWeb}
            >
              <Entrada
                name="sitioWeb"
                defaultValue={contacto.sitioWeb ?? ""}
                placeholder="tusitio.com.ar"
                errores={errores?.sitioWeb}
              />
            </Campo>
          </div>
        </div>
      )}
    </Editor>
  );
}
