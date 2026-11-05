import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { formatearFecha } from "@/lib/format";
import {
  DIAS_PARA_LA_DEVOLUCION,
  type ResumenDeInteres,
} from "@/lib/interes";

/** Cuántos productos consultados se listan antes de cortar. */
const PRODUCTOS_EN_LA_LISTA = 8;

/**
 * Lo que mira el vecino, contado para el feriante.
 *
 * Dos pantallas distintas, y la primera importa tanto como la segunda:
 *
 *   · Antes del mes, avisa que se está contando y **no opina**. Una devolución
 *     armada sobre cuatro días es ruido con tono de conclusión, y de paso el
 *     cartel evita la otra incomodidad: que un buen día le aparezca un panel
 *     diciéndole hace cuánto lo miran sin que nadie se lo hubiera avisado.
 *   · Pasado el mes, los números del último mes y nada más que los suyos.
 */
export function InteresEnLaVidriera({ resumen }: { resumen: ResumenDeInteres }) {
  if (resumen.diasQueFaltan > 0) {
    return (
      <Tarjeta>
        <TarjetaCuerpo>
          <p className="text-sm font-semibold text-slate-900">
            Estamos contando cuánto miran tu vidriera
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {resumen.fechaDeLaDevolucion
              ? `Con un mes de datos vas a poder ver qué productos te consultan y cuáles no. Tu primer resumen: ${formatearFecha(resumen.fechaDeLaDevolucion)}.`
              : `Con un mes de datos vas a poder ver qué productos te consultan y cuáles no. Faltan ${resumen.diasQueFaltan} días.`}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Se cuentan aperturas y consultas, en total y por día. No guardamos
            quién entra.
          </p>
        </TarjetaCuerpo>
      </Tarjeta>
    );
  }

  const consultados = resumen.productos.filter(
    (producto) => producto.consultas > 0,
  );
  const sinConsultas = resumen.productos.length - consultados.length;
  const consultasTotales =
    resumen.consultasDelStand +
    consultados.reduce((total, producto) => total + producto.consultas, 0);

  /** «De cada 100 que abrieron tu vidriera, N preguntaron por esto.» */
  function porCien(consultas: number): string | null {
    if (resumen.aperturas === 0) return null;
    const tasa = Math.round((consultas / resumen.aperturas) * 100);
    return tasa >= 1 ? `${tasa} de cada 100` : "menos de 1 de cada 100";
  }

  return (
    <Tarjeta>
      <TarjetaEncabezado
        titulo="Tu vidriera"
        descripcion={`Últimos ${DIAS_PARA_LA_DEVOLUCION} días`}
      />
      <TarjetaCuerpo className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Veces que la abrieron</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {resumen.aperturas}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Consultas por WhatsApp</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {consultasTotales}
            </p>
          </div>
        </div>

        {consultados.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-slate-900">
              Lo que más te consultan
            </p>
            <ul className="mt-2 divide-y divide-slate-100">
              {consultados.slice(0, PRODUCTOS_EN_LA_LISTA).map((producto) => {
                const tasa = porCien(producto.consultas);
                return (
                  <li
                    key={producto.id}
                    className="flex items-baseline justify-between gap-3 py-2 first:pt-0"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-700">
                      {producto.nombre}
                    </span>
                    <span className="shrink-0 text-sm text-slate-500">
                      <span className="font-semibold text-slate-900">
                        {producto.consultas}
                      </span>
                      {tasa && ` · ${tasa}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            {consultados.length > PRODUCTOS_EN_LA_LISTA && (
              <p className="mt-2 text-xs text-slate-500">
                Y {consultados.length - PRODUCTOS_EN_LA_LISTA} más.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Todavía nadie usó el botón de consultar por un producto. Es el que
            aparece en cada tarjeta de tu catálogo.
          </p>
        )}

        {sinConsultas > 0 && (
          <p className="text-sm text-slate-600">
            {sinConsultas === 1
              ? "Hay 1 producto que no recibió ninguna consulta en el mes."
              : `Hay ${sinConsultas} productos que no recibieron ninguna consulta en el mes.`}{" "}
            Puede ser que no interesen, o que estén al final de la vidriera:
            arriba van los destacados.
          </p>
        )}

        {/* Lo que el número no dice, dicho por el número mismo. */}
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
          Son consultas y aperturas, no personas: no guardamos quién entra a tu
          vidriera, así que alguien que vuelve cuenta dos veces.
        </p>
      </TarjetaCuerpo>
    </Tarjeta>
  );
}
