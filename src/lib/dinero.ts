import { aNumero, type ValorDecimal } from "@/lib/format";

/**
 * Aritmética de plata, compartida por todo lo que suma importes.
 *
 * Vivía en `canon.ts`, que era su único consumidor. Salió de ahí cuando
 * aparecieron los pedidos: el canon es lo que el feriante le paga al municipio
 * y el pedido es lo que el vecino le paga al feriante, y que uno importara del
 * otro invitaba a confundirlos. La aritmética es la misma; los dominios no.
 */

/**
 * Importe en centavos enteros.
 *
 * La plata **no se suma en pesos**: en punto flotante, un canon de $12.500,10
 * pagado en tres cuotas de $4.166,70 da 12500.099999999998, así que quedaba un
 * saldo de 1,8e-12 > 0. El permiso figuraba VENCIDO y la columna «Saldo»
 * mostraba «$ 0», porque el formateador redondea: el feriante aparecía moroso
 * por una deuda invisible. En centavos, 1250010 − 3 × 416670 = 0 y se acabó.
 *
 * Se redondea al centavo porque `aNumero` ya convirtió el `Decimal` a
 * `number`: el error relativo que arrastra un double es del orden de 1e-16, o
 * sea que ni en el tope del validador ($999.999.999) se acerca a medio
 * centavo. El redondeo lo absorbe y el resultado es exacto.
 */
export function aCentavos(valor: ValorDecimal | null | undefined): number {
  return Math.round(aNumero(valor) * 100);
}

/**
 * Suma importes en pesos sin arrastrar el error del punto flotante.
 *
 * El `reduce<number>` es necesario, no decorativo: sin el parámetro de tipo,
 * TypeScript ve que el `0` inicial es asignable a `ValorDecimal` —`number` está
 * dentro de esa unión— y elige la sobrecarga no genérica de `reduce`, con lo
 * que el acumulador queda tipado como `ValorDecimal | null | undefined` y la
 * suma no compila.
 */
export function sumarImportes(
  importes: Array<ValorDecimal | null | undefined>,
): number {
  return (
    importes.reduce<number>((suma, importe) => suma + aCentavos(importe), 0) /
    100
  );
}
