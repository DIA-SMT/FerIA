"use client";

import { useActionState } from "react";

import { iniciarSesion } from "@/actions/auth";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { Campo, Entrada } from "@/components/ui/campo";
import { ESTADO_INICIAL } from "@/lib/form";

export function FormularioIngreso({ volverA }: { volverA: string }) {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
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
    </form>
  );
}
