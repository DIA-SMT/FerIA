"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CategoriaFeria } from "@prisma/client";

import { Alerta } from "@/components/ui/alerta";
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
import { CENTRO_SMT } from "@/lib/geo";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/lib/form";
import { urlPublica } from "@/lib/media";
import { aOpciones, CATEGORIAS_FERIA } from "@/lib/labels";

export interface ValoresFeria {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaFeria;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  imagen: string | null;
  activa: boolean;
}

interface PropsFormularioFeria {
  accion: (
    estado: EstadoFormulario,
    datos: FormData,
  ) => Promise<EstadoFormulario>;
  feria?: ValoresFeria;
}

export function FormularioFeria({ accion, feria }: PropsFormularioFeria) {
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL);
  const errores = estado.errores;
  const editando = Boolean(feria);

  return (
    <form action={enviar} className="space-y-5" noValidate>
      {feria && <input type="hidden" name="feriaId" value={feria.id} />}

      {estado.mensaje && (
        <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta>
      )}

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Datos de la feria"
          descripcion="La información que ven los vecinos en el market."
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              htmlFor="nombre"
              etiqueta="Nombre"
              className="sm:col-span-2"
              ayuda="La dirección web pública se genera a partir del nombre."
              errores={errores?.nombre}
              requerido
            >
              <Entrada
                name="nombre"
                defaultValue={feria?.nombre}
                placeholder="Ej. Feria de Artesanos — Parque 9 de Julio"
                errores={errores?.nombre}
                required
              />
            </Campo>

            <Campo
              htmlFor="categoria"
              etiqueta="Categoría"
              errores={errores?.categoria}
              requerido
            >
              <Seleccion
                name="categoria"
                defaultValue={feria?.categoria}
                placeholder="Elegí una"
                opciones={aOpciones(CATEGORIAS_FERIA)}
                errores={errores?.categoria}
                required
              />
            </Campo>
          </div>

          <Campo
            htmlFor="descripcion"
            etiqueta="Descripción"
            ayuda="Qué se puede encontrar, cómo es el paseo, para quién está pensada."
            errores={errores?.descripcion}
            requerido
          >
            <AreaTexto
              name="descripcion"
              rows={5}
              defaultValue={feria?.descripcion}
              errores={errores?.descripcion}
              required
            />
          </Campo>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Ubicación"
          descripcion="Las coordenadas se guardan en PostGIS y hoy se usan para el enlace a Google Maps."
        />
        <TarjetaCuerpo className="space-y-4">
          <Campo
            htmlFor="direccion"
            etiqueta="Dirección"
            ayuda="Sin la ciudad ni la provincia: se agregan solas."
            errores={errores?.direccion}
            requerido
          >
            <Entrada
              name="direccion"
              defaultValue={feria?.direccion}
              placeholder="Ej. Parque 9 de Julio, Av. Benjamín Aráoz y Av. Soldati"
              errores={errores?.direccion}
              required
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="latitud"
              etiqueta="Latitud"
              ayuda={`Centro de la ciudad: ${CENTRO_SMT.lat}`}
              errores={errores?.latitud}
            >
              <Entrada
                name="latitud"
                type="number"
                step="any"
                inputMode="decimal"
                defaultValue={feria?.latitud ?? ""}
                placeholder="-26.8354"
                errores={errores?.latitud}
              />
            </Campo>

            <Campo
              htmlFor="longitud"
              etiqueta="Longitud"
              ayuda={`Centro de la ciudad: ${CENTRO_SMT.lng}`}
              errores={errores?.longitud}
            >
              <Entrada
                name="longitud"
                type="number"
                step="any"
                inputMode="decimal"
                defaultValue={feria?.longitud ?? ""}
                placeholder="-65.2038"
                errores={errores?.longitud}
              />
            </Campo>
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Portada y publicación"
          descripcion="La imagen encabeza la página pública de la feria."
        />
        <TarjetaCuerpo className="space-y-4">
          {/* El mismo componente que la vidriera del feriante: muestra la foto
              elegida en el acto, con el recorte real y el cartel «Sin guardar».
              Antes acá se veía la portada vieja y, abajo, el nombre del archivo
              nuevo: no había forma de saber si habías agarrado el que querías
              hasta después de guardar.

              El ancho mínimo va en la ayuda porque no decirlo ya costó: una
              portada entró a 633 px y se ve blanda estirada a ancho completo.
              Subirla de tamaño en el servidor no arregla nada —estirar píxeles
              que no existen la empeora— así que lo único que sirve es pedir una
              foto más grande antes de que se suba. */}
          <CampoImagen
            name="imagen"
            etiqueta={feria?.imagen ? "Reemplazar portada" : "Portada"}
            ayuda="Apaisada y de al menos 1200 px de ancho. JPG, PNG, WEBP o AVIF, hasta 5 MB."
            errores={errores?.imagen}
            actual={urlPublica(feria?.imagen)}
            vacio="Sin portada"
            forma="apaisada"
          />

          <Casilla
            name="activa"
            etiqueta="Feria activa"
            ayuda="Si la desmarcás, deja de aparecer en el market público."
            defaultChecked={feria?.activa ?? true}
          />
        </TarjetaCuerpo>

        <TarjetaPie>
          <Link
            href={feria ? `/admin/ferias/${feria.id}` : "/admin/ferias"}
            className={estilosBoton("contorno")}
          >
            Cancelar
          </Link>
          <BotonEnvio>
            {editando ? "Guardar cambios" : "Crear feria"}
          </BotonEnvio>
        </TarjetaPie>
      </Tarjeta>
    </form>
  );
}
