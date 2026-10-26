"use client";

import { useActionState, useState } from "react";

import { postularme } from "@/actions/postulaciones";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo, Seleccion } from "@/components/ui/campo";
import { ESTADO_INICIAL } from "@/lib/form";

export interface FeriaDisponible {
  id: string;
  nombre: string;
}

/**
 * Postularse a otra feria, con la ficha ya cargada.
 *
 * Arranca plegado: para la mayoría de los feriantes la pantalla de resumen es
 * para mirar sus próximas ferias, no para sumar otra, y un formulario abierto
 * compite con eso. Sólo pide la feria y el mensaje, porque todo lo demás ya
 * está en la ficha.
 */
export function FormularioPostulacion({
  ferias,
}: {
  ferias: FeriaDisponible[];
}) {
  const [estado, enviar] = useActionState(postularme, ESTADO_INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (ferias.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Ya te postulaste a todas las ferias publicadas.
      </p>
    );
  }

  if (estado.ok) {
    return <Alerta tipo="exito">{estado.mensaje}</Alerta>;
  }

  if (!abierto) {
    return (
      <Boton
        variante="contorno"
        tamanio="sm"
        onClick={() => setAbierto(true)}
        type="button"
      >
        Postularme a otra feria
      </Boton>
    );
  }

  return (
    <form action={enviar} className="space-y-4">
      {estado.mensaje && !estado.ok && (
        <Alerta tipo="error">{estado.mensaje}</Alerta>
      )}

      <Campo
        htmlFor="feriaId"
        etiqueta="Feria"
        errores={estado.errores?.feriaId}
        requerido
      >
        <Seleccion
          name="feriaId"
          errores={estado.errores?.feriaId}
          placeholder="Elegí una feria"
          opciones={ferias.map((feria) => ({
            valor: feria.id,
            etiqueta: feria.nombre,
          }))}
        />
      </Campo>

      <Campo
        htmlFor="mensaje"
        etiqueta="Por qué querés sumarte"
        ayuda="Es lo que lee quien decide."
        errores={estado.errores?.mensaje}
      >
        <AreaTexto
          name="mensaje"
          rows={3}
          maxLength={1000}
          errores={estado.errores?.mensaje}
        />
      </Campo>

      <div className="flex flex-wrap gap-2">
        <BotonEnvio tamanio="sm" textoEnviando="Enviando…">
          Enviar la postulación
        </BotonEnvio>
        <Boton
          variante="fantasma"
          tamanio="sm"
          type="button"
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
