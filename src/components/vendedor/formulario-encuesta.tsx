"use client";

import { useActionState } from "react";

import { enviarEncuesta } from "@/actions/postulaciones";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { ESTADO_INICIAL } from "@/lib/form";
import { aOpciones, RUBROS } from "@/lib/labels";

export interface FeriaParaElegir {
  id: string;
  nombre: string;
}

/**
 * La encuesta con la que un feriante se suma a una feria.
 *
 * Reemplaza al registro para los feriantes. El registro pedía catorce campos;
 * acá hay nueve, porque el nombre, el correo y el documento los trae CiDiTuc
 * —ya verificados por el municipio— y la contraseña dejó de existir: quien
 * llega a esta pantalla ya está autenticado.
 *
 * Por eso arriba se muestra quién está completando: es el dato que explica por
 * qué no se piden esas cosas, y evita que alguien crea que se las saltearon.
 */
export function FormularioEncuesta({
  ferias,
  persona,
}: {
  ferias: FeriaParaElegir[];
  /** Lo que ya trajo CiDiTuc. `documento` es null si entró con contraseña. */
  persona: { nombre: string; email: string; documento: string | null };
}) {
  const [estado, enviar] = useActionState(enviarEncuesta, ESTADO_INICIAL);
  const errores = estado.errores;

  return (
    <form action={enviar} className="space-y-6">
      {estado.mensaje && !estado.ok && (
        <Alerta tipo="error">{estado.mensaje}</Alerta>
      )}

      <Alerta tipo="info">
        Estás completando la encuesta como{" "}
        <strong className="font-semibold">{persona.nombre}</strong> (
        {persona.email}
        {persona.documento ? `, DNI ${persona.documento}` : ""}). Esos datos los
        tomamos de tu cuenta de CiDiTuc —por eso no te los pedimos acá— y los
        guardamos junto con tu ficha. Lo único que te preguntamos es por tu
        emprendimiento.
      </Alerta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="A qué feria querés sumarte"
          descripcion="Podés postularte a otras más adelante, de a una por vez."
        />
        <TarjetaCuerpo className="space-y-4">
          <Campo
            htmlFor="feriaId"
            etiqueta="Feria"
            errores={errores?.feriaId}
            requerido
          >
            <Seleccion
              name="feriaId"
              errores={errores?.feriaId}
              placeholder="Elegí una feria"
              opciones={ferias.map((feria) => ({
                valor: feria.id,
                etiqueta: feria.nombre,
              }))}
            />
          </Campo>

          <Campo
            htmlFor="mensaje"
            etiqueta="Contanos de tu emprendimiento"
            ayuda="Qué llevás, desde cuándo producís, si ya participaste de alguna feria. Es lo que lee quien decide."
            errores={errores?.mensaje}
          >
            <AreaTexto
              name="mensaje"
              rows={4}
              maxLength={1000}
              errores={errores?.mensaje}
            />
          </Campo>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Tu emprendimiento"
          descripcion="Esto es lo que va a ver el vecino en tu stand."
        />
        <TarjetaCuerpo className="space-y-4">
          <Campo
            htmlFor="emprendimiento"
            etiqueta="Nombre del emprendimiento"
            errores={errores?.emprendimiento}
            requerido
          >
            <Entrada
              name="emprendimiento"
              placeholder="Ej. Tejidos del Norte"
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
              errores={errores?.rubro}
              placeholder="Elegí un rubro"
              opciones={aOpciones(RUBROS).map((opcion) => ({
                valor: opcion.valor,
                etiqueta: opcion.etiqueta,
              }))}
            />
          </Campo>

          <Campo
            htmlFor="descripcion"
            etiqueta="Descripción"
            ayuda="Materiales, técnicas, qué te distingue."
            errores={errores?.descripcion}
          >
            <AreaTexto
              name="descripcion"
              rows={3}
              maxLength={1500}
              errores={errores?.descripcion}
            />
          </Campo>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Cómo te contactan"
          descripcion="El WhatsApp es el botón principal de tu stand, así que tiene que ser uno que atiendas."
        />
        <TarjetaCuerpo className="space-y-4">
          <Campo
            htmlFor="whatsapp"
            etiqueta="WhatsApp"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="telefono"
              etiqueta="Otro teléfono"
              errores={errores?.telefono}
            >
              <Entrada name="telefono" errores={errores?.telefono} />
            </Campo>

            <Campo
              htmlFor="direccion"
              etiqueta="Domicilio"
              errores={errores?.direccion}
            >
              <Entrada name="direccion" errores={errores?.direccion} />
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
                placeholder="@tumarca"
                errores={errores?.instagram}
              />
            </Campo>
            <Campo
              htmlFor="facebook"
              etiqueta="Facebook"
              errores={errores?.facebook}
            >
              <Entrada name="facebook" errores={errores?.facebook} />
            </Campo>
            <Campo
              htmlFor="sitioWeb"
              etiqueta="Sitio web"
              errores={errores?.sitioWeb}
            >
              <Entrada name="sitioWeb" errores={errores?.sitioWeb} />
            </Campo>
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <BotonEnvio tamanio="lg" textoEnviando="Enviando la encuesta…">
        Enviar la encuesta
      </BotonEnvio>
    </form>
  );
}
