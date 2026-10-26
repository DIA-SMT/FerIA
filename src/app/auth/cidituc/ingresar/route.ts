import { NextResponse } from "next/server";

import {
  COOKIE_ESTADO,
  DURACION_ESTADO,
  hayIngresoCidituc,
  nuevoEstado,
  urlDeIngreso,
} from "@/lib/cidituc";
import { atributosCookie } from "@/lib/cookies";

/**
 * Salida hacia CiDiTuc.
 *
 * El botón «Ingresar con CiDiTuc» no apunta al Derivador: apunta acá. Una
 * página no puede escribir cookies mientras se dibuja, y hace falta plantar la
 * del `state` **antes** de redirigir.
 *
 * Por qué el `state`: sin él, alguien puede pedir un token con su propia
 * cuenta, no usarlo, y mandarle a otra persona el link del callback con ese
 * token. El token es legítimo, así que la víctima queda adentro con una sesión
 * ajena sin enterarse. Con el `state`, un link fabricado por otro no trae el
 * número que está en la cookie de quien lo abre.
 */
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  if (!hayIngresoCidituc()) {
    return NextResponse.json({ error: "no habilitado" }, { status: 404 });
  }

  const estado = nuevoEstado();
  const respuesta = NextResponse.redirect(urlDeIngreso(estado));

  respuesta.cookies.set(COOKIE_ESTADO, estado, {
    ...atributosCookie(),
    maxAge: DURACION_ESTADO,
  });

  return respuesta;
}
