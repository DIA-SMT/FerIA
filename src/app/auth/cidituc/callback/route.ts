import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  COOKIE_ESTADO,
  consultarPerfil,
  hayIngresoCidituc,
  mismoEstado,
} from "@/lib/cidituc";
import { vincularFeriante } from "@/lib/cidituc-feriante";
import { borradoCookie } from "@/lib/cookies";
import { redireccionRelativa } from "@/lib/redireccion";

/**
 * Vuelta desde CiDiTuc.
 *
 * Esta URL es la que DITEC registró en el login, así que **no se puede
 * mover**: cambiarla obliga a un deploy de ellos.
 *
 * Siempre termina en una redirección a una URL limpia. El token llega en la
 * barra de direcciones y de ahí pasa al historial, a los logs de acceso y a la
 * cabecera `Referer` de la página siguiente: se consume acá, se canjea por
 * nuestra propia sesión y no se guarda en ningún lado.
 */
export const runtime = "nodejs";

/**
 * Cada motivo es un código distinto porque no todos se arreglan igual:
 * «no pudimos consultar tus datos» se reintenta y «tu cuenta no tiene
 * documento» no. La pantalla de ingreso los traduce.
 */
function volver(motivo?: string): NextResponse {
  const destino = motivo
    ? `/ingresar?${new URLSearchParams({ error: motivo })}`
    : "/mi-stand";

  // Relativa y no contra `request.url`: ver `redireccionRelativa`.
  const respuesta = redireccionRelativa(destino);

  // El estado es de un solo uso: se borra pase lo que pase, y con los mismos
  // atributos con que se escribió, o el navegador ignora el borrado.
  respuesta.cookies.delete(borradoCookie(COOKIE_ESTADO));

  return respuesta;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!hayIngresoCidituc()) {
    return NextResponse.json({ error: "no habilitado" }, { status: 404 });
  }

  const parametros = new URL(request.url).searchParams;

  const token = parametros.get("auth");
  if (!token) return volver("cidituc-sin-token");

  const estadoGuardado = (await cookies()).get(COOKIE_ESTADO)?.value;
  if (!mismoEstado(estadoGuardado, parametros.get("state"))) {
    return volver("cidituc-estado");
  }

  const perfil = await consultarPerfil(token);
  if (!perfil.ok) return volver(`cidituc-${perfil.motivo}`);

  // Autenticar no es autorizar: el token prueba quién es la persona, no que
  // pueda hacer algo acá. Lo que sigue es nuestro: encontrar o crear su
  // cuenta, engancharle la ficha del padrón si la tiene y abrir la sesión.
  let vinculo;
  try {
    vinculo = await vincularFeriante(perfil.persona);
  } catch (causa) {
    console.error("[cidituc] falló el vínculo con la ficha:", causa);
    return volver("cidituc-sin-cuenta");
  }

  if (!vinculo.ok) return volver(`cidituc-${vinculo.motivo}`);

  // Sin ficha la persona entra igual, pero a completar su alta: no es un
  // error, es alguien que todavía no se postuló a ninguna feria.
  if (!vinculo.tieneFicha) {
    // Sin ficha va a la encuesta, que es el alta de feriante desde que CiDiTuc
    // es la puerta: el registro con correo y contraseña quedó para el personal
    // municipal.
    const respuesta = redireccionRelativa("/encuesta");
    respuesta.cookies.delete(borradoCookie(COOKIE_ESTADO));
    return respuesta;
  }

  return volver();
}
