"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ModalidadSelloPropio } from "@prisma/client";

import type { FerianteElegible } from "@/actions/sello-propio";
import { SelectorFeriante } from "@/components/admin/selector-feriante";
import { AvisoDelEnvio } from "@/components/ui/aviso-flotante";
import { estilosBoton } from "@/components/ui/boton";
import { BotonEnvio } from "@/components/ui/boton-envio";
import {
  AreaTexto,
  Campo,
  Casilla,
  Entrada,
  Seleccion,
} from "@/components/ui/campo";
import { CampoImagen } from "@/components/ui/campo-imagen";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
  TarjetaPie,
} from "@/components/ui/tarjeta";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/lib/form";
import { formatearNumero } from "@/lib/format";
import { urlPublica } from "@/lib/media";
import {
  MODALIDADES_POR_TIPO,
  MODALIDADES_SELLO_PROPIO,
  TIPOS_SELLO_PROPIO,
  tipoDeModalidad,
  UNIDAD_SUGERIDA,
} from "@/lib/sello-propio";

export interface ValoresPropuesta {
  id: string;
  modalidad: ModalidadSelloPropio;
  titulo: string;
  descripcion: string;
  imagen: string | null;
  precio: number | null;
  precioUnidad: string | null;
  minimo: string | null;
  capacidad: string | null;
  anticipacion: string | null;
  publicada: boolean;
  /** Sólo en el panel: en Mi stand el feriante es quien la carga. */
  feriante?: FerianteElegible;
}

interface PropsFormularioPropuesta {
  accion: (
    estado: EstadoFormulario,
    datos: FormData,
  ) => Promise<EstadoFormulario>;
  /**
   * Con el buscador es el formulario del panel: se elige el feriante y se
   * publica con una casilla. Sin él es el de Mi stand, donde el feriante es
   * quien la carga y la publicación la decide la revisión.
   */
  buscarFeriantes?: (texto: string) => Promise<FerianteElegible[]>;
  propuesta?: ValoresPropuesta;
  /** Adónde lleva «Cancelar». */
  volver: string;
}

/** «Regalo · Caja», agrupadas por tipo en el orden de las pestañas. */
const OPCIONES_MODALIDAD = (["REGALO", "SERVICIO"] as const).flatMap((tipo) =>
  MODALIDADES_POR_TIPO[tipo].map((modalidad) => ({
    valor: modalidad,
    etiqueta: `${TIPOS_SELLO_PROPIO[tipo].singular} · ${MODALIDADES_SELLO_PROPIO[modalidad]}`,
  })),
);

export function FormularioPropuesta({
  accion,
  buscarFeriantes,
  propuesta,
  volver,
}: PropsFormularioPropuesta) {
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL);
  const errores = estado.errores;
  // Sólo para los textos de ejemplo: «por caja» o «por persona», «10 cajas»
  // o «30 personas».
  const [modalidad, setModalidad] = useState<ModalidadSelloPropio | "">(
    propuesta?.modalidad ?? "",
  );
  const servicio =
    modalidad !== "" && tipoDeModalidad(modalidad) === "SERVICIO";

  return (
    <form action={enviar} className="space-y-5" noValidate>
      {propuesta && (
        <input type="hidden" name="propuestaId" value={propuesta.id} />
      )}

      <AvisoDelEnvio estado={estado} />

      <Tarjeta>
        <TarjetaEncabezado
          titulo="La propuesta"
          descripcion="Lo que ven las empresas e instituciones en la página."
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-5">
            <Campo
              htmlFor="modalidad"
              etiqueta="Qué es"
              className="sm:col-span-2"
              errores={errores?.modalidad}
              requerido
            >
              <Seleccion
                name="modalidad"
                defaultValue={propuesta?.modalidad ?? ""}
                placeholder="Elegí una"
                opciones={OPCIONES_MODALIDAD}
                onChange={(evento) =>
                  setModalidad(evento.target.value as ModalidadSelloPropio | "")
                }
                errores={errores?.modalidad}
                required
              />
            </Campo>

            <Campo
              htmlFor="titulo"
              etiqueta="Título"
              className="sm:col-span-3"
              errores={errores?.titulo}
              requerido
            >
              <Entrada
                name="titulo"
                defaultValue={propuesta?.titulo}
                placeholder={
                  servicio
                    ? "Ej. Patio de empanadas y pastelería"
                    : "Ej. Caja dulce navideña"
                }
                maxLength={120}
                errores={errores?.titulo}
                required
              />
            </Campo>
          </div>

          <Campo
            htmlFor="descripcion"
            etiqueta="Descripción"
            ayuda={
              servicio
                ? "Qué ofrece, para qué tipo de evento, qué equipamiento lleva."
                : "Qué incluye, cómo se presenta, si se puede personalizar con el logo."
            }
            errores={errores?.descripcion}
            requerido
          >
            <AreaTexto
              name="descripcion"
              rows={4}
              maxLength={1500}
              defaultValue={propuesta?.descripcion}
              errores={errores?.descripcion}
              required
            />
          </Campo>

          <CampoImagen
            name="imagen"
            etiqueta={propuesta?.imagen ? "Reemplazar foto" : "Foto"}
            ayuda={
              servicio
                ? "Una foto del puesto o de lo que sirve, o el menú. JPG, PNG, WEBP o AVIF, hasta 5 MB."
                : "Una foto del producto, la caja o el combo. JPG, PNG, WEBP o AVIF, hasta 5 MB."
            }
            errores={errores?.imagen}
            actual={urlPublica(propuesta?.imagen)}
            vacio="Sin foto"
            forma="apaisada"
          />
        </TarjetaCuerpo>
      </Tarjeta>

      {buscarFeriantes && (
        <Tarjeta>
          <TarjetaEncabezado
            titulo="Quién la ofrece"
            descripcion="La tarjeta lleva a su stand y a su WhatsApp, con el mensaje ya escrito."
          />
          <TarjetaCuerpo>
            <Campo
              htmlFor="vendedorId"
              etiqueta="Feriante"
              ayuda="Sólo aparecen los feriantes aprobados."
              errores={errores?.vendedorId}
              requerido
            >
              <SelectorFeriante
                name="vendedorId"
                inicial={propuesta?.feriante}
                errores={errores?.vendedorId}
                buscar={buscarFeriantes}
              />
            </Campo>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Precio y condiciones"
          descripcion={
            buscarFeriantes
              ? "Lo que contó el feriante. Lo que quede vacío no se muestra."
              : "Lo que quede vacío no se muestra."
          }
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="precio"
              etiqueta="Precio orientativo"
              ayuda="En pesos, sin centavos."
              errores={errores?.precio}
            >
              <Entrada
                name="precio"
                inputMode="numeric"
                defaultValue={
                  propuesta?.precio ? formatearNumero(propuesta.precio) : ""
                }
                placeholder="Ej. 15.000"
                errores={errores?.precio}
              />
            </Campo>

            <Campo
              htmlFor="precioUnidad"
              etiqueta="¿Por…?"
              ayuda="A qué corresponde el precio."
              errores={errores?.precioUnidad}
            >
              <Entrada
                name="precioUnidad"
                defaultValue={propuesta?.precioUnidad ?? ""}
                placeholder={`Ej. ${modalidad ? UNIDAD_SUGERIDA[modalidad] : "por caja"}`}
                maxLength={40}
                errores={errores?.precioUnidad}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo htmlFor="minimo" etiqueta="Mínimo" errores={errores?.minimo}>
              <Entrada
                name="minimo"
                defaultValue={propuesta?.minimo ?? ""}
                placeholder={servicio ? "Ej. 30 personas" : "Ej. 10 cajas"}
                maxLength={80}
                errores={errores?.minimo}
              />
            </Campo>

            <Campo
              htmlFor="capacidad"
              etiqueta={
                servicio ? "Para cuántas personas" : "Cuántas puede preparar"
              }
              errores={errores?.capacidad}
            >
              <Entrada
                name="capacidad"
                defaultValue={propuesta?.capacidad ?? ""}
                placeholder={
                  servicio
                    ? "Ej. hasta 150 personas"
                    : "Ej. 50 cajas por semana"
                }
                maxLength={120}
                errores={errores?.capacidad}
              />
            </Campo>

            <Campo
              htmlFor="anticipacion"
              etiqueta="Anticipación"
              errores={errores?.anticipacion}
            >
              <Entrada
                name="anticipacion"
                defaultValue={propuesta?.anticipacion ?? ""}
                placeholder="Ej. 7 días"
                maxLength={80}
                errores={errores?.anticipacion}
              />
            </Campo>
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCuerpo>
          {buscarFeriantes ? (
            <Casilla
              name="publicada"
              etiqueta="Publicada"
              ayuda="Mientras no la marques queda como borrador: la ve el equipo y nadie más."
              defaultChecked={propuesta?.publicada ?? false}
            />
          ) : (
            <p className="text-sm text-slate-600">
              {propuesta?.publicada
                ? "Los cambios los revisa la Dirección de Relaciones Institucionales. Mientras tanto se sigue viendo la versión publicada."
                : "La revisa la Dirección de Relaciones Institucionales y, cuando la aprueba, aparece en Modo Feria."}
            </p>
          )}
        </TarjetaCuerpo>

        <TarjetaPie>
          <Link href={volver} className={estilosBoton("contorno")}>
            Cancelar
          </Link>
          <BotonEnvio>
            {buscarFeriantes
              ? propuesta
                ? "Guardar cambios"
                : "Crear propuesta"
              : "Enviar a revisión"}
          </BotonEnvio>
        </TarjetaPie>
      </Tarjeta>
    </form>
  );
}
