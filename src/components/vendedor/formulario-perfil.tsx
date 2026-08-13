"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { Rubro } from "@prisma/client";

import { actualizarPerfilVendedor } from "@/actions/vendedores";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import {
  AreaTexto,
  Campo,
  CampoArchivo,
  Entrada,
  Seleccion,
} from "@/components/ui/campo";
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

export function FormularioPerfil({ perfil }: { perfil: ValoresPerfil }) {
  const [estado, accion] = useActionState(
    actualizarPerfilVendedor,
    ESTADO_INICIAL,
  );
  const errores = estado.errores;

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
                defaultValue={perfil.emprendimiento}
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
                defaultValue={perfil.rubro}
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
              defaultValue={perfil.descripcion ?? ""}
              errores={errores?.descripcion}
            />
          </Campo>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Imágenes"
          descripcion="La portada encabeza tu stand; el logo aparece en el directorio."
        />
        <TarjetaCuerpo className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-3">
              {urlPublica(perfil.imagenPortada) ? (
                <Image
                  src={urlPublica(perfil.imagenPortada) ?? ""}
                  alt="Portada actual"
                  width={320}
                  height={180}
                  className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                  Sin portada
                </div>
              )}
              <Campo
                htmlFor="imagenPortada"
                etiqueta="Foto de portada"
                ayuda="Apaisada. Hasta 5 MB."
                errores={errores?.imagenPortada}
              >
                <CampoArchivo
                  name="imagenPortada"
                  errores={errores?.imagenPortada}
                />
              </Campo>
            </div>

            <div className="space-y-3">
              {urlPublica(perfil.logo) ? (
                <Image
                  src={urlPublica(perfil.logo) ?? ""}
                  alt="Logo actual"
                  width={128}
                  height={128}
                  className="size-32 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex size-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                  Sin logo
                </div>
              )}
              <Campo
                htmlFor="logo"
                etiqueta="Logo"
                ayuda="Cuadrado. Hasta 5 MB."
                errores={errores?.logo}
              >
                <CampoArchivo name="logo" errores={errores?.logo} />
              </Campo>
            </div>
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
