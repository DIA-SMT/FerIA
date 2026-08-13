"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { EstadoPago, MedioPago } from "@prisma/client";

import { Alerta } from "@/components/ui/alerta";
import { estilosBoton } from "@/components/ui/boton";
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
import { ESTADO_INICIAL, type EstadoFormulario } from "@/lib/form";
import { formatearMoneda } from "@/lib/format";
import { urlComprobante } from "@/lib/media";
import { aOpciones, ESTADOS_PAGO, MEDIOS_PAGO } from "@/lib/labels";

export interface OpcionEdicion {
  id: string;
  etiqueta: string;
  montoCanon: number;
}

export interface OpcionVendedor {
  id: string;
  etiqueta: string;
}

export interface ValoresPago {
  id: string;
  vendedorId: string;
  edicionId: string;
  monto: number;
  fechaPago: string;
  medio: MedioPago | null;
  estado: EstadoPago;
  observaciones: string | null;
  comprobante: string | null;
}

interface PropsFormularioPago {
  accion: (
    estado: EstadoFormulario,
    datos: FormData,
  ) => Promise<EstadoFormulario>;
  ediciones: OpcionEdicion[];
  vendedores: OpcionVendedor[];
  pago?: ValoresPago;
  /** Valores preseleccionados al venir desde una edición o un permiso puntual. */
  inicial?: { edicionId?: string; vendedorId?: string };
}

export function FormularioPago({
  accion,
  ediciones,
  vendedores,
  pago,
  inicial,
}: PropsFormularioPago) {
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL);
  const errores = estado.errores;

  const [edicionId, setEdicionId] = useState(
    pago?.edicionId ?? inicial?.edicionId ?? "",
  );
  const [monto, setMonto] = useState(
    pago ? String(pago.monto) : montoSugerido(ediciones, inicial?.edicionId),
  );

  const edicionElegida = ediciones.find(
    (edicion) => edicion.id === edicionId,
  );

  /** Al cambiar de edición, proponemos su canon como monto. */
  function alCambiarEdicion(nuevoId: string): void {
    setEdicionId(nuevoId);
    const edicion = ediciones.find((item) => item.id === nuevoId);
    if (edicion) setMonto(String(edicion.montoCanon));
  }

  return (
    <form action={enviar} className="space-y-5" noValidate>
      {pago && <input type="hidden" name="pagoId" value={pago.id} />}

      {estado.mensaje && (
        <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta>
      )}

      <Tarjeta>
        <TarjetaEncabezado
          titulo="Datos del pago"
          descripcion="Un feriante puede tener más de un pago por edición (pagos parciales)."
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="edicionId"
              etiqueta="Edición"
              errores={errores?.edicionId}
              requerido
            >
              <Seleccion
                name="edicionId"
                value={edicionId}
                onChange={(evento) => alCambiarEdicion(evento.target.value)}
                placeholder="Elegí una edición"
                opciones={ediciones.map((edicion) => ({
                  valor: edicion.id,
                  etiqueta: `${edicion.etiqueta} · ${formatearMoneda(edicion.montoCanon)}`,
                }))}
                errores={errores?.edicionId}
                required
              />
            </Campo>

            <Campo
              htmlFor="vendedorId"
              etiqueta="Feriante"
              errores={errores?.vendedorId}
              requerido
            >
              <Seleccion
                name="vendedorId"
                defaultValue={pago?.vendedorId ?? inicial?.vendedorId ?? ""}
                placeholder="Elegí un feriante"
                opciones={vendedores.map((vendedor) => ({
                  valor: vendedor.id,
                  etiqueta: vendedor.etiqueta,
                }))}
                errores={errores?.vendedorId}
                required
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              htmlFor="monto"
              etiqueta="Monto"
              ayuda={
                edicionElegida
                  ? `Canon de la edición: ${formatearMoneda(edicionElegida.montoCanon)}`
                  : "En pesos."
              }
              errores={errores?.monto}
              requerido
            >
              <Entrada
                name="monto"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                errores={errores?.monto}
                required
              />
            </Campo>

            <Campo
              htmlFor="estado"
              etiqueta="Estado"
              ayuda="«Pagado» requiere fecha y medio."
              errores={errores?.estado}
              requerido
            >
              <Seleccion
                name="estado"
                defaultValue={pago?.estado ?? "PAGADO"}
                opciones={aOpciones(ESTADOS_PAGO)}
                errores={errores?.estado}
                required
              />
            </Campo>

            <Campo
              htmlFor="fechaPago"
              etiqueta="Fecha de pago"
              errores={errores?.fechaPago}
            >
              <Entrada
                name="fechaPago"
                type="date"
                defaultValue={pago?.fechaPago ?? hoyComoValor()}
                errores={errores?.fechaPago}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              htmlFor="medio"
              etiqueta="Medio de pago"
              errores={errores?.medio}
            >
              <Seleccion
                name="medio"
                defaultValue={pago?.medio ?? ""}
                placeholder="Elegí un medio"
                opciones={aOpciones(MEDIOS_PAGO)}
                errores={errores?.medio}
              />
            </Campo>

            <Campo
              htmlFor="comprobante"
              etiqueta={pago?.comprobante ? "Reemplazar comprobante" : "Comprobante"}
              ayuda="Opcional. Imagen o PDF, hasta 5 MB."
              errores={errores?.comprobante}
            >
              <CampoArchivo
                name="comprobante"
                accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                errores={errores?.comprobante}
              />
            </Campo>
          </div>

          {pago?.comprobante && (
            <p className="text-sm text-slate-500">
              Comprobante actual:{" "}
              <a
                href={urlComprobante(pago.comprobante) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-municipal-600 hover:text-municipal-700"
              >
                ver archivo
              </a>
            </p>
          )}

          <Campo
            htmlFor="observaciones"
            etiqueta="Observaciones"
            errores={errores?.observaciones}
          >
            <AreaTexto
              name="observaciones"
              rows={3}
              defaultValue={pago?.observaciones ?? ""}
              placeholder="Ej. Pago parcial, saldo a abonar antes del inicio de la feria."
              errores={errores?.observaciones}
            />
          </Campo>
        </TarjetaCuerpo>

        <TarjetaPie>
          <Link href="/admin/canon" className={estilosBoton("contorno")}>
            Cancelar
          </Link>
          <BotonEnvio>
            {pago ? "Guardar cambios" : "Registrar pago"}
          </BotonEnvio>
        </TarjetaPie>
      </Tarjeta>
    </form>
  );
}

function montoSugerido(
  ediciones: OpcionEdicion[],
  edicionId?: string,
): string {
  if (!edicionId) return "";
  const edicion = ediciones.find((item) => item.id === edicionId);
  return edicion ? String(edicion.montoCanon) : "";
}

function hoyComoValor(): string {
  return new Date().toISOString().slice(0, 10);
}
