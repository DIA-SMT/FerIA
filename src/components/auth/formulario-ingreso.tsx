"use client";

import { useActionState, useRef } from "react";

import { iniciarSesion } from "@/actions/auth";
import { AccesosDemo } from "@/components/auth/accesos-demo";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { Campo, Entrada } from "@/components/ui/campo";
import { ESTADO_INICIAL } from "@/lib/form";

export function FormularioIngreso({ volverA }: { volverA: string }) {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  /**
   * Completa y envía el formulario desde los accesos de prueba.
   *
   * Escribimos en el DOM en lugar de llevar el valor en el estado de React:
   * los campos son no controlados, así que `requestSubmit()` puede leer los
   * valores en el mismo tick. Con estado habría que esperar el re-render.
   */
  function ingresarComo(email: string, password: string): void {
    const form = formulario.current;
    if (!form) return;

    const campoEmail = form.elements.namedItem("email");
    const campoPassword = form.elements.namedItem("password");
    if (
      !(campoEmail instanceof HTMLInputElement) ||
      !(campoPassword instanceof HTMLInputElement)
    ) {
      return;
    }

    campoEmail.value = email;
    campoPassword.value = password;
    form.requestSubmit();
  }

  return (
    <form ref={formulario} action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="volverA" value={volverA} />

      {estado.ok === false && estado.mensaje && (
        <Alerta tipo="error">{estado.mensaje}</Alerta>
      )}

      <Campo
        htmlFor="email"
        etiqueta="Correo electrónico"
        errores={estado.errores?.email}
        requerido
      >
        <Entrada
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@ejemplo.com"
          errores={estado.errores?.email}
          required
        />
      </Campo>

      <Campo
        htmlFor="password"
        etiqueta="Contraseña"
        errores={estado.errores?.password}
        requerido
      >
        <Entrada
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          errores={estado.errores?.password}
          required
        />
      </Campo>

      <BotonEnvio ancho tamanio="lg" textoEnviando="Ingresando…">
        Ingresar
      </BotonEnvio>

      {/* No renderiza nada fuera de desarrollo. */}
      <AccesosDemo onElegir={ingresarComo} />
    </form>
  );
}
