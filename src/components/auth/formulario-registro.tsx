"use client";

import { useActionState } from "react";

import { registrarFeriante } from "@/actions/auth";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { ESTADO_INICIAL } from "@/lib/form";
import { aOpciones, RUBROS } from "@/lib/labels";

export function FormularioRegistro() {
  const [estado, accion] = useActionState(registrarFeriante, ESTADO_INICIAL);
  const errores = estado.errores;

  return (
    <form action={accion} className="space-y-10" noValidate>
      {estado.ok === false && estado.mensaje && (
        <Alerta tipo="error" titulo="No pudimos completar el registro">
          {estado.mensaje}
        </Alerta>
      )}

      {/* --------------------------- Datos personales -------------------------- */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">
          Tus datos
        </legend>

        <Campo
          htmlFor="nombre"
          etiqueta="Nombre y apellido"
          errores={errores?.nombre}
          requerido
        >
          <Entrada
            name="nombre"
            autoComplete="name"
            placeholder="Ej. María Elena Quiroga"
            errores={errores?.nombre}
            required
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            htmlFor="email"
            etiqueta="Correo electrónico"
            ayuda="Lo vas a usar para ingresar a la plataforma."
            errores={errores?.email}
            requerido
          >
            <Entrada
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@ejemplo.com"
              errores={errores?.email}
              required
            />
          </Campo>

          <Campo htmlFor="dni" etiqueta="DNI" errores={errores?.dni}>
            <Entrada
              name="dni"
              inputMode="numeric"
              placeholder="Ej. 28.456.789"
              errores={errores?.dni}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            htmlFor="password"
            etiqueta="Contraseña"
            ayuda="Mínimo 8 caracteres."
            errores={errores?.password}
            requerido
          >
            <Entrada
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              errores={errores?.password}
              required
            />
          </Campo>

          <Campo
            htmlFor="confirmarPassword"
            etiqueta="Repetir contraseña"
            errores={errores?.confirmarPassword}
            requerido
          >
            <Entrada
              name="confirmarPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              errores={errores?.confirmarPassword}
              required
            />
          </Campo>
        </div>

        <Campo
          htmlFor="direccion"
          etiqueta="Dirección"
          ayuda="Sólo para uso administrativo. No se publica."
          errores={errores?.direccion}
        >
          <Entrada
            name="direccion"
            autoComplete="street-address"
            placeholder="Ej. Av. Mate de Luna 1234"
            errores={errores?.direccion}
          />
        </Campo>
      </fieldset>

      {/* ---------------------------- Emprendimiento --------------------------- */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">
          Tu emprendimiento
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            htmlFor="emprendimiento"
            etiqueta="Nombre del emprendimiento"
            errores={errores?.emprendimiento}
            requerido
          >
            <Entrada
              name="emprendimiento"
              placeholder="Ej. Tejidos del Cerro"
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
              placeholder="Elegí un rubro"
              opciones={aOpciones(RUBROS).map((opcion) => ({
                valor: opcion.valor,
                etiqueta: opcion.etiqueta,
              }))}
              errores={errores?.rubro}
              required
            />
          </Campo>
        </div>

        <Campo
          htmlFor="descripcion"
          etiqueta="Descripción"
          ayuda="Contá qué hacés, con qué materiales y qué te distingue. Es lo primero que van a leer los vecinos en tu stand."
          errores={errores?.descripcion}
        >
          <AreaTexto
            name="descripcion"
            rows={5}
            placeholder="Ej. Telar criollo con lana de oveja hilada a mano y teñida con tintes naturales…"
            errores={errores?.descripcion}
          />
        </Campo>
      </fieldset>

      {/* -------------------------------- Contacto ----------------------------- */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">
          Cómo te contactan
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            htmlFor="whatsapp"
            etiqueta="WhatsApp"
            ayuda="Es el botón principal de tu stand. Ej. 381 512-3456."
            errores={errores?.whatsapp}
            requerido
          >
            <Entrada
              name="whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="381 512-3456"
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
              placeholder="381 421-0000"
              errores={errores?.telefono}
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
              placeholder="tusitio.com.ar"
              errores={errores?.sitioWeb}
            />
          </Campo>
        </div>
      </fieldset>

      <div className="space-y-4 border-t border-slate-200 pt-6">
        <Alerta tipo="info">
          Al enviar el formulario, tu solicitud queda{" "}
          <strong>pendiente de aprobación</strong>. La Dirección de Ferias y
          Mercados la revisa y te avisa el resultado. Recién después vas a poder
          cargar tu catálogo y ser asignado a un stand.
        </Alerta>

        <BotonEnvio ancho tamanio="lg" textoEnviando="Enviando solicitud…">
          Enviar solicitud
        </BotonEnvio>
      </div>
    </form>
  );
}
