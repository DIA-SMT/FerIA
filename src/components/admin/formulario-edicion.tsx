"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoEdicion } from "@prisma/client";

import { Alerta } from "@/components/ui/alerta";
import { estilosBoton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
  TarjetaPie,
} from "@/components/ui/tarjeta";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/lib/form";
import { aOpciones, ESTADOS_EDICION } from "@/lib/labels";

export interface ValoresEdicion {
  id: string;
  nombre: string | null;
  fechaInicio: string;
  fechaFin: string;
  horario: string;
  estado: EstadoEdicion;
  cantidadStands: number;
  montoCanon: number;
  vencimientoCanon: string;
}

interface PropsFormularioEdicion {
  accion: (
    estado: EstadoFormulario,
    datos: FormData,
  ) => Promise<EstadoFormulario>;
  feriaId: string;
  edicion?: ValoresEdicion;
}

export function FormularioEdicion({
  accion,
  feriaId,
  edicion,
}: PropsFormularioEdicion) {
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL);
  const errores = estado.errores;

  return (
    <form action={enviar} className="space-y-5" noValidate>
      <input type="hidden" name="feriaId" value={feriaId} />
      {edicion && <input type="hidden" name="edicionId" value={edicion.id} />}

      {estado.mensaje && (
        <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta>
      )}

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Fechas y horarios"
          descripcion="Cuándo se realiza esta edición de la feria."
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="nombre"
              etiqueta="Nombre de la edición"
              ayuda="Opcional. Ej. «Edición Aniversario»."
              errores={errores?.nombre}
            >
              <Entrada
                name="nombre"
                defaultValue={edicion?.nombre ?? ""}
                placeholder="Ej. Edición Primavera"
                errores={errores?.nombre}
              />
            </Campo>

            <Campo
              htmlFor="estado"
              etiqueta="Estado"
              ayuda="Sólo las publicadas y en curso se ven en el market."
              errores={errores?.estado}
              requerido
            >
              <Seleccion
                name="estado"
                defaultValue={edicion?.estado ?? "BORRADOR"}
                opciones={aOpciones(ESTADOS_EDICION)}
                errores={errores?.estado}
                required
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="fechaInicio"
              etiqueta="Fecha de inicio"
              errores={errores?.fechaInicio}
              requerido
            >
              <Entrada
                name="fechaInicio"
                type="date"
                defaultValue={edicion?.fechaInicio}
                errores={errores?.fechaInicio}
                required
              />
            </Campo>

            <Campo
              htmlFor="fechaFin"
              etiqueta="Fecha de fin"
              errores={errores?.fechaFin}
              requerido
            >
              <Entrada
                name="fechaFin"
                type="date"
                defaultValue={edicion?.fechaFin}
                errores={errores?.fechaFin}
                required
              />
            </Campo>
          </div>

          <Campo
            htmlFor="horario"
            etiqueta="Horario"
            ayuda="Texto libre, tal como se le muestra al vecino."
            errores={errores?.horario}
            requerido
          >
            <Entrada
              name="horario"
              defaultValue={edicion?.horario}
              placeholder="Ej. Viernes a domingo de 17 a 22 h"
              errores={errores?.horario}
              required
            />
          </Campo>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Stands y canon"
          descripcion="La grilla de stands se genera automáticamente con la numeración 1 a N."
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              htmlFor="cantidadStands"
              etiqueta="Cantidad de stands"
              ayuda="Al reducirla, sólo se eliminan los que estén libres."
              errores={errores?.cantidadStands}
              requerido
            >
              <Entrada
                name="cantidadStands"
                type="number"
                min={0}
                max={500}
                step={1}
                inputMode="numeric"
                defaultValue={edicion?.cantidadStands ?? 20}
                errores={errores?.cantidadStands}
                required
              />
            </Campo>

            <Campo
              htmlFor="montoCanon"
              etiqueta="Canon por feriante"
              ayuda="En pesos. Poné 0 si esta edición no cobra canon."
              errores={errores?.montoCanon}
              requerido
            >
              <Entrada
                name="montoCanon"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={edicion?.montoCanon ?? 0}
                errores={errores?.montoCanon}
                required
              />
            </Campo>

            <Campo
              htmlFor="vencimientoCanon"
              etiqueta="Vence el"
              ayuda="Pasada esta fecha, lo impago figura como vencido."
              errores={errores?.vencimientoCanon}
            >
              <Entrada
                name="vencimientoCanon"
                type="date"
                defaultValue={edicion?.vencimientoCanon ?? ""}
                errores={errores?.vencimientoCanon}
              />
            </Campo>
          </div>
        </TarjetaCuerpo>

        <TarjetaPie>
          <Link
            href={
              edicion ? `/admin/ediciones/${edicion.id}` : `/admin/ferias/${feriaId}`
            }
            className={estilosBoton("contorno")}
          >
            Cancelar
          </Link>
          <BotonEnvio>
            {edicion ? "Guardar cambios" : "Crear edición"}
          </BotonEnvio>
        </TarjetaPie>
      </Tarjeta>
    </form>
  );
}
