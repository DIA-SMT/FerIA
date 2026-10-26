"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { crearPedido } from "@/actions/pedidos";
import { useCarrito } from "@/components/carrito/estado-carrito";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnvio } from "@/components/ui/boton-envio";
import { estilosBoton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoCarrito } from "@/components/ui/iconos";
import { ESTADO_INICIAL } from "@/lib/form";
import { formatearMoneda } from "@/lib/format";
import { subtotalLinea, totalPedido } from "@/lib/pedidos";

export interface EdicionDeRetiro {
  id: string;
  etiqueta: string;
}

/**
 * Confirmación del pedido a un stand.
 *
 * El carrito está en el navegador, así que el detalle lo arma este componente
 * y viaja en un campo oculto —sólo ids y cantidades—. El servidor vuelve a
 * buscar cada producto y pone los precios de la base: lo que se ve acá es para
 * que la persona sepa qué está pidiendo, no es lo que define el total.
 */
export function FormularioPedido({
  stand,
  ediciones,
}: {
  stand: { slug: string; emprendimiento: string };
  ediciones: EdicionDeRetiro[];
}) {
  const { carritos, listo } = useCarrito();
  const [estado, accion] = useActionState(crearPedido, ESTADO_INICIAL);
  const [modoEntrega, setModoEntrega] = useState(
    ediciones.length > 0 ? "RETIRO_EN_FERIA" : "ACUERDA_CON_FERIANTE",
  );

  const carrito = carritos[stand.slug];

  if (!listo) {
    return (
      <p className="mt-8 text-sm text-slate-500" role="status">
        Cargando tu pedido…
      </p>
    );
  }

  if (!carrito || carrito.items.length === 0) {
    return (
      <EstadoVacio
        icono={IconoCarrito}
        className="mt-8"
        titulo="No tenés nada para pedirle a este stand"
        descripcion="Puede que lo hayas vaciado o que ya hayas mandado el pedido."
        accion={
          <Link
            href={`/stands/${stand.slug}`}
            className={estilosBoton("primario", "md")}
          >
            Ver el catálogo
          </Link>
        }
      />
    );
  }

  // Lo único que viaja del carrito. Sin nombres y sin precios: el servidor los
  // tiene y son los que valen.
  const items = JSON.stringify(
    carrito.items.map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
    })),
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-5">
      <section className="lg:col-span-2" aria-labelledby="resumen">
        <h2 id="resumen" className="font-semibold text-slate-900">
          Tu pedido
        </h2>

        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {carrito.items.map((item) => (
            <li
              key={item.productoId}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{item.nombre}</p>
                <p className="text-sm text-slate-500">
                  {item.cantidad} × {formatearMoneda(item.precioUnitario)}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-slate-900">
                {formatearMoneda(subtotalLinea(item))}
              </p>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
            <p className="font-medium text-slate-700">Total</p>
            <p className="text-lg font-bold text-slate-900">
              {formatearMoneda(totalPedido(carrito.items))}
            </p>
          </li>
        </ul>

        <Link
          href="/carrito"
          className="mt-3 inline-block text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
        >
          Modificar el pedido
        </Link>
      </section>

      <form action={accion} className="space-y-5 lg:col-span-3">
        <input type="hidden" name="vendedorSlug" value={stand.slug} />
        <input type="hidden" name="items" value={items} />

        {estado.mensaje && !estado.ok && (
          <Alerta tipo="error">{estado.mensaje}</Alerta>
        )}

        <Campo
          htmlFor="compradorNombre"
          etiqueta="Tu nombre"
          requerido
          errores={estado.errores?.compradorNombre}
        >
          <Entrada
            id="compradorNombre"
            name="compradorNombre"
            autoComplete="name"
            required
            errores={estado.errores?.compradorNombre}
          />
        </Campo>

        <Campo
          htmlFor="compradorWhatsapp"
          etiqueta="Tu WhatsApp"
          requerido
          ayuda="Es por donde te va a escribir el feriante para coordinar el pago y la entrega."
          errores={estado.errores?.compradorWhatsapp}
        >
          <Entrada
            id="compradorWhatsapp"
            name="compradorWhatsapp"
            type="tel"
            inputMode="tel"
            placeholder="381 512-3456"
            autoComplete="tel"
            required
            errores={estado.errores?.compradorWhatsapp}
          />
        </Campo>

        <Campo
          htmlFor="compradorEmail"
          etiqueta="Tu correo (opcional)"
          errores={estado.errores?.compradorEmail}
        >
          <Entrada
            id="compradorEmail"
            name="compradorEmail"
            type="email"
            autoComplete="email"
            errores={estado.errores?.compradorEmail}
          />
        </Campo>

        <Campo
          htmlFor="modoEntrega"
          etiqueta="Cómo lo recibís"
          requerido
          errores={estado.errores?.modoEntrega}
        >
          <Seleccion
            name="modoEntrega"
            value={modoEntrega}
            onChange={(evento) => setModoEntrega(evento.target.value)}
            errores={estado.errores?.modoEntrega}
            opciones={[
              // Retirar en la feria sólo se ofrece si el feriante tiene stand
              // en alguna edición publicada: si no, no hay dónde ir a buscarlo.
              ...(ediciones.length > 0
                ? [
                    {
                      valor: "RETIRO_EN_FERIA",
                      etiqueta: "Lo retiro en la feria",
                    },
                  ]
                : []),
              {
                valor: "ACUERDA_CON_FERIANTE",
                etiqueta: "Lo arreglo con el feriante",
              },
            ]}
          />
        </Campo>

        {modoEntrega === "RETIRO_EN_FERIA" && ediciones.length > 0 && (
          <Campo
            htmlFor="edicionId"
            etiqueta="En qué feria lo retirás"
            errores={estado.errores?.edicionId}
          >
            <Seleccion
              name="edicionId"
              errores={estado.errores?.edicionId}
              opciones={ediciones.map((edicion) => ({
                valor: edicion.id,
                etiqueta: edicion.etiqueta,
              }))}
            />
          </Campo>
        )}

        <Campo
          htmlFor="notas"
          etiqueta="Aclaraciones (opcional)"
          ayuda="Talle, color, sin azúcar, a qué hora pasás…"
          errores={estado.errores?.notas}
        >
          <AreaTexto
            id="notas"
            name="notas"
            rows={3}
            maxLength={500}
            errores={estado.errores?.notas}
          />
        </Campo>

        <Alerta tipo="advertencia">
          Al enviarlo, tus datos de contacto quedan a disposición de{" "}
          {stand.emprendimiento} para responderte. El pago y la entrega los
          arreglan entre ustedes: la Municipalidad no cobra ni interviene.
        </Alerta>

        <BotonEnvio tamanio="lg" ancho textoEnviando="Enviando el pedido…">
          Enviar el pedido
        </BotonEnvio>
      </form>
    </div>
  );
}
