import Link from "next/link";

import { eliminarFichaDeCostos } from "@/actions/costos";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoLapiz, IconoMas } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { CalcularConMigue } from "@/components/vendedor/calcular-con-migue";
import { hayIAConfigurada } from "@/lib/ai";
import { cn } from "@/lib/cn";
import { calcularCostos, datosDeCostosSchema } from "@/lib/costos";
import { prisma } from "@/lib/db";
import { formatearFecha, formatearMoneda } from "@/lib/format";
import { obtenerVendedorActual } from "@/lib/session";

export const metadata = { title: "Precios y costos" };

const plata = (valor: number) => formatearMoneda(valor, { centavos: true });

/**
 * Las fichas de costos del feriante: cuánto le cuesta cada cosa y a cuánto le
 * conviene venderla.
 *
 * Son suyas y de nadie más: la Dirección no las ve, y el precio que sale no se
 * publica. La cuenta no se guarda: se rehace con los datos cada vez que se
 * abre, así siempre es la de hoy.
 *
 * Con IA, lo primero es Migue: arma la ficha conversando, de a una pregunta
 * y con botones para responder. El formulario queda como «Prefiero
 * completarlo yo».
 */
export default async function PaginaPreciosYCostos() {
  const { vendedor } = await obtenerVendedorActual();

  const conMigue = hayIAConfigurada();
  const [fichas, sinFicha] = await Promise.all([
    prisma.fichaDeCostos.findMany({
      where: { vendedorId: vendedor.id },
      orderBy: { actualizadoEn: "desc" },
      select: {
        id: true,
        nombre: true,
        datos: true,
        actualizadoEn: true,
        producto: { select: { nombre: true } },
      },
    }),
    // Los botones de la primera pregunta de Migue: los productos que todavía
    // no tienen ficha, primero los destacados.
    conMigue
      ? prisma.producto.findMany({
          where: {
            vendedorId: vendedor.id,
            borrador: false,
            fichasDeCostos: { none: {} },
          },
          orderBy: [{ destacado: "desc" }, { creadoEn: "desc" }],
          select: { nombre: true },
          take: 4,
        })
      : [],
  ]);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Precios y costos
          </h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Cuánto te cuesta hacer cada cosa y a cuánto te conviene venderla. Es
            tuyo: no lo ve nadie más y no se publica.
          </p>
        </div>
        {!conMigue && fichas.length > 0 && (
          <BotonLink href="/mi-stand/costos/nueva">
            <IconoMas className="size-4" />
            Nueva ficha
          </BotonLink>
        )}
      </header>

      {conMigue && (
        <CalcularConMigue
          productos={sinFicha.map((producto) => producto.nombre)}
        />
      )}

      {fichas.length === 0 ? (
        !conMigue && (
          <EstadoVacio
            titulo="Todavía no armaste ninguna ficha"
            descripcion="Contás qué materia prima usás, cuánto tiempo te lleva y cuánto querés ganar, y te sale el precio."
            accion={
              <BotonLink href="/mi-stand/costos/nueva">
                <IconoMas className="size-4" />
                Armar la primera
              </BotonLink>
            }
          />
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {fichas.map((ficha) => {
            const datos = datosDeCostosSchema.safeParse(ficha.datos);
            const resultado = datos.success ? calcularCostos(datos.data) : null;
            const valido = resultado !== null && !("error" in resultado);

            return (
              <Tarjeta key={ficha.id}>
                <TarjetaCuerpo className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900">
                        {ficha.nombre}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Actualizada el {formatearFecha(ficha.actualizadoEn)}
                      </p>
                    </div>
                    {ficha.producto && (
                      <Badge tono="azul" tamanio="sm">
                        De tu catálogo
                      </Badge>
                    )}
                  </div>

                  {valido ? (
                    <>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500">
                            Precio sugerido
                          </p>
                          <p className="text-2xl font-bold tracking-tight text-municipal-700 tabular-nums">
                            {plata(resultado.precioSugerido)}
                          </p>
                        </div>
                        <dl className="text-right text-sm">
                          <div>
                            <dt className="inline text-slate-500">
                              Te cuesta{" "}
                            </dt>
                            <dd className="inline font-medium text-slate-800 tabular-nums">
                              {plata(resultado.porUnidad.total)}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline text-slate-500">Le ganás </dt>
                            <dd className="inline font-medium text-slate-800 tabular-nums">
                              {plata(resultado.gananciaPorUnidad)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      {resultado.conPrecioActual && (
                        <p
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            resultado.conPrecioActual.gananciaPorUnidad < 0
                              ? "bg-red-50 text-red-800"
                              : "bg-slate-50 text-slate-700",
                          )}
                        >
                          {resultado.conPrecioActual.gananciaPorUnidad < 0
                            ? `Hoy lo vendés a ${plata(resultado.conPrecioActual.precio)}: perdés ${plata(-resultado.conPrecioActual.gananciaPorUnidad)} por unidad.`
                            : `Hoy lo vendés a ${plata(resultado.conPrecioActual.precio)}: le ganás ${plata(resultado.conPrecioActual.gananciaPorUnidad)} (${resultado.conPrecioActual.margen} %).`}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-red-700">
                      {resultado && "error" in resultado
                        ? resultado.error
                        : "Le faltan datos a esta ficha. Abrila para completarla."}
                    </p>
                  )}

                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <Link
                      href={`/mi-stand/costos/${ficha.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 hover:text-municipal-700"
                    >
                      <IconoLapiz className="size-3.5" />
                      Ver y editar
                    </Link>
                    <BotonConfirmar
                      accion={eliminarFichaDeCostos}
                      campos={{ fichaId: ficha.id }}
                      confirmacion={`¿Borrar la ficha de «${ficha.nombre}»?`}
                      variante="fantasma"
                      className="ml-auto text-red-600 hover:bg-red-50"
                    >
                      Borrar
                    </BotonConfirmar>
                  </div>
                </TarjetaCuerpo>
              </Tarjeta>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Las cuentas son orientativas. Para impuestos y facturación, consultá con
        un contador.
      </p>
    </>
  );
}
