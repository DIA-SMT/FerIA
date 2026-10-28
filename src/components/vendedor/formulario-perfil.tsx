"use client";

import { useActionState, useState } from "react";
import type { Rubro } from "@prisma/client";

import { actualizarPerfilVendedor } from "@/actions/vendedores";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import {
  AreaTexto,
  Campo,
  Entrada,
  Seleccion,
} from "@/components/ui/campo";
import { CampoImagen } from "@/components/ui/campo-imagen";
import { AsistenteDeDescripcion } from "@/components/vendedor/asistente-de-descripcion";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
  TarjetaPie,
} from "@/components/ui/tarjeta";
import { ESTADO_INICIAL } from "@/lib/form";
import { aOpciones, RUBROS } from "@/lib/labels";
import { urlPublica } from "@/lib/media";

export interface ValoresPerfil {
  emprendimiento: string;
  rubro: Rubro;
  descripcion: string | null;
  whatsapp: string;
  telefono: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  sitioWeb: string | null;
  direccion: string | null;
  imagenPortada: string | null;
  logo: string | null;
}

export function FormularioPerfil({
  perfil,
  hayIA = true,
}: {
  perfil: ValoresPerfil;
  /**
   * Si la plataforma tiene `OPENROUTER_API_KEY` cargada. Llega por props y no
   * se consulta acá: `hayIAConfigurada()` lee `process.env` del servidor y este
   * componente es de cliente, donde esa variable no existe.
   *
   * `src/app/mi-stand/perfil/page.tsx` ya lo pasa; el default en `true` queda
   * para cualquier otro lugar que monte esto sin decir nada, donde es preferible
   * ofrecer el botón de más a esconder una función que sí está configurada.
   */
  hayIA?: boolean;
}) {
  const [estado, accion] = useActionState(
    actualizarPerfilVendedor,
    ESTADO_INICIAL,
  );
  const errores = estado.errores;

  // Estos tres son controlados porque el asistente de redacción los lee en vivo:
  // la descripción para saber si mejora o arma un borrador, y el nombre y el
  // rubro para ambientar el texto —el feriante puede estar cambiándolos acá
  // mismo—. El resto del formulario sigue sin control.
  const [emprendimiento, setEmprendimiento] = useState(perfil.emprendimiento);
  const [rubro, setRubro] = useState<Rubro>(perfil.rubro);
  const [descripcion, setDescripcion] = useState(perfil.descripcion ?? "");

  return (
    <form action={accion} className="space-y-5" noValidate>
      {estado.mensaje && (
        <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta>
      )}

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Tu emprendimiento"
          descripcion="Es lo primero que ven los vecinos al entrar a tu stand."
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="emprendimiento"
              etiqueta="Nombre del emprendimiento"
              ayuda="Si lo cambiás, también cambia la dirección web de tu stand."
              errores={errores?.emprendimiento}
              requerido
            >
              <Entrada
                name="emprendimiento"
                value={emprendimiento}
                onChange={(evento) => setEmprendimiento(evento.target.value)}
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
                value={rubro}
                onChange={(evento) => setRubro(evento.target.value as Rubro)}
                opciones={aOpciones(RUBROS)}
                errores={errores?.rubro}
                required
              />
            </Campo>
          </div>

          <Campo
            htmlFor="descripcion"
            etiqueta="Descripción"
            ayuda="Contá qué hacés, con qué materiales trabajás y qué te distingue."
            errores={errores?.descripcion}
          >
            <AreaTexto
              name="descripcion"
              rows={6}
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
              errores={errores?.descripcion}
            />
          </Campo>

          {/* Sin IA configurada no se ofrece el botón de redactar: apretarlo
              sólo devolvía el error de la acción. El campo de descripción
              queda intacto y se escribe a mano, como siempre. */}
          {hayIA && (
            <AsistenteDeDescripcion
              valor={descripcion}
              nombreEmprendimiento={emprendimiento}
              rubro={rubro}
              onAplicar={setDescripcion}
            />
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Imágenes"
          descripcion="La portada encabeza tu stand; el logo aparece en el directorio."
        />
        <TarjetaCuerpo className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoImagen
              name="imagenPortada"
              etiqueta="Foto de portada"
              ayuda="Apaisada y de al menos 1200 px de ancho. Hasta 5 MB."
              errores={errores?.imagenPortada}
              actual={urlPublica(perfil.imagenPortada)}
              vacio="Sin portada"
              forma="apaisada"
            />

            <CampoImagen
              name="logo"
              etiqueta="Logo"
              ayuda="Cuadrado y de al menos 400 px. Hasta 5 MB."
              errores={errores?.logo}
              actual={urlPublica(perfil.logo)}
              vacio="Sin logo"
              forma="cuadrada"
            />
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Contacto y redes"
          descripcion="El WhatsApp es el botón principal de tu stand."
        />
        <TarjetaCuerpo className="space-y-4">
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
                defaultValue={perfil.whatsapp}
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
                defaultValue={perfil.telefono ?? ""}
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
                defaultValue={perfil.email ?? ""}
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
                defaultValue={perfil.direccion ?? ""}
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
                defaultValue={perfil.instagram ?? ""}
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
                defaultValue={perfil.facebook ?? ""}
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
                defaultValue={perfil.sitioWeb ?? ""}
                placeholder="tusitio.com.ar"
                errores={errores?.sitioWeb}
              />
            </Campo>
          </div>
        </TarjetaCuerpo>

        <TarjetaPie>
          <BotonEnvio>Guardar cambios</BotonEnvio>
        </TarjetaPie>
      </Tarjeta>
    </form>
  );
}
