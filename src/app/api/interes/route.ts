import { NextResponse, type NextRequest } from "next/server";

import {
  registrarConsultaDeProducto,
  registrarConsultaDeStand,
} from "@/lib/interes";
import { esVisitaDeUnaPersona } from "@/lib/visitas";

/**
 * Recibe el aviso de que alguien consultó por WhatsApp.
 *
 * Lo manda `EnlaceConsulta` con `navigator.sendBeacon` al hacer clic. Llega un
 * identificador y nada más: ni quién, ni desde dónde, ni a qué hora. Lo que se
 * escribe es un `+1` en el contador del día.
 *
 * **Siempre contesta 204**, pase lo que pase. El del otro lado es un beacon que
 * ni siquiera mira la respuesta, y contestar distinto según el caso convertiría
 * este endpoint en una forma de averiguar qué identificadores existen.
 */
export async function POST(peticion: NextRequest): Promise<NextResponse> {
  const listo = new NextResponse(null, { status: 204 });

  // Mismo filtro que la apertura: un bot que recorre todo por igual no agrega
  // ruido, aplana las diferencias, que es lo único que estamos midiendo.
  if (!esVisitaDeUnaPersona(peticion.headers)) return listo;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return listo;
  }

  if (typeof cuerpo !== "object" || cuerpo === null) return listo;
  const evento = cuerpo as Record<string, unknown>;

  // Los cuid rondan los 25 caracteres; el tope es para no mandar a la base una
  // cadena de un megabyte que de todos modos no va a existir.
  const identificador = (valor: unknown): string | null =>
    typeof valor === "string" && valor.length > 0 && valor.length <= 64
      ? valor
      : null;

  const producto = identificador(evento.producto);
  if (producto) {
    await registrarConsultaDeProducto(producto);
    return listo;
  }

  const stand = identificador(evento.stand);
  if (stand) await registrarConsultaDeStand(stand);

  return listo;
}
