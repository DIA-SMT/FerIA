import { Agent, request as pedirHttps } from "node:https";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { rootCertificates } from "node:tls";

import { nombreCookie } from "@/lib/cookies";

/**
 * Ingreso con CiDiTuc, la identidad digital de la Municipalidad.
 *
 * **No es OpenID Connect.** No hay `client_id`, ni `client_secret`, ni
 * descubrimiento: la app se manda a una pantalla del Derivador, la persona
 * vuelve con un token en la URL y ese token se valida consultando el perfil.
 * Si el backend contesta el perfil, el token es bueno.
 *
 * Lo único que pide DITEC es registrar la app en el Derivador. Eso es un
 * cambio en **su** repo y un deploy de **ellos**: hasta que el bundle
 * desplegado de cidituc.smt.gob.ar nombre nuestra clave, la persona entra
 * bien a CiDiTuc y queda varada ahí, sin mensaje. Por eso el botón se prende
 * recién después de verificarlo, con `CIDITUC_INGRESO_HABILITADO`.
 *
 * Es sólo para feriantes. El vecino que compra no necesita cuenta: el carrito
 * y el pedido no piden sesión en ningún momento.
 *
 * La especificación completa, con las trampas que costaron caro en el
 * Presupuesto Participativo y en el Portal del Becario, está en el documento
 * «Integrar el login de CIDITUC» de la Dirección.
 */

// Las URLs van en el código y no en el entorno a propósito: la de ingreso
// lleva un `#`, y en un archivo `.env` el `#` abre un comentario y se come el
// resto de la línea. La redirección moría en silencio.
const DERIVADOR = "https://cidituc.smt.gob.ar";
const PERFIL = "https://estadisticas.smt.gob.ar:5000/usuarios/authStatus";

/**
 * La clave con la que DITEC registró esta app en el Derivador.
 *
 * La URL del callback que les pedimos registrar es
 * `https://feria.smt.gob.ar/auth/cidituc/callback`, el dominio definitivo —no
 * el de Vercel—, porque **no se puede cambiar después sin un deploy de ellos**.
 * Hasta que ese dominio esté apuntando acá, el ingreso real no se puede
 * probar: por eso `CIDITUC_INGRESO_HABILITADO` queda apagado.
 *
 * Nada de este archivo depende del dominio: el callback arma sus redirecciones
 * contra la URL del pedido que recibe, así que anda en cualquiera de los dos.
 */
export const CLAVE_APP = process.env.CIDITUC_APP ?? "feria";

export const COOKIE_ESTADO = nombreCookie("feria_cidituc_estado");

/** Diez minutos y un solo uso: alcanza para entrar, no para quedar colgado. */
export const DURACION_ESTADO = 600;

export function hayIngresoCidituc(): boolean {
  return process.env.CIDITUC_INGRESO_HABILITADO === "true";
}

export function nuevoEstado(): string {
  return randomBytes(16).toString("hex");
}

/**
 * El `state` va **dentro del fragmento**, al lado de `next`: el Derivador usa
 * HashRouter y lee la query del hash, no la de la URL. Puesto afuera, la
 * vuelta falla siempre con «estado» y no hay forma de darse cuenta mirando el
 * código de acá.
 */
export function urlDeIngreso(estado: string): string {
  const parametros = new URLSearchParams({ next: CLAVE_APP, state: estado });
  return `${DERIVADOR}/#/login?${parametros}`;
}

/**
 * Compara el `state` de la vuelta con el de la cookie.
 *
 * En tiempo constante, y comparando el largo **en bytes** antes: el valor de
 * la vuelta lo escribe cualquiera, y `timingSafeEqual` tira si los buffers
 * miden distinto. Un caracter con tilde mide 1 caracter y 2 bytes, así que
 * medir en caracteres deja pasar un 500.
 */
export function mismoEstado(
  uno?: string | null,
  otro?: string | null,
): boolean {
  if (!uno || !otro) return false;
  const a = Buffer.from(uno, "utf8");
  const b = Buffer.from(otro, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Consulta del perfil: es la validación del token
// ---------------------------------------------------------------------------

/**
 * El backend a veces no manda el certificado intermedio, y desde Vercel eso
 * falla con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. `CIDITUC_CA_PEM` lo aporta.
 *
 * Se **suma** a las raíces de Node porque la opción `ca` reemplaza el almacén
 * entero: con el PEM solo, el raíz queda sin ancla y falla distinto
 * (`UNABLE_TO_GET_ISSUER_CERT`). Nunca `rejectUnauthorized: false`.
 */
function autoridades(): string[] | undefined {
  const pem = process.env.CIDITUC_CA_PEM?.trim();
  if (!pem) return undefined;
  return [...rootCertificates, pem.replace(/\\n/g, "\n")];
}

function pedirPerfil(
  token: string,
): Promise<{ estado: number; cuerpo: string }> {
  const url = new URL(PERFIL);

  return new Promise((resolver, rechazar) => {
    const pedido = pedirHttps(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
        // El token va **pelado**. Con `Bearer ` adelante contesta 401 siempre.
        headers: { Authorization: token, Accept: "application/json" },
        agent: new Agent({ ca: autoridades(), keepAlive: false }),
        timeout: 10_000,
      },
      (respuesta) => {
        let cuerpo = "";
        respuesta.setEncoding("utf8");
        respuesta.on("data", (parte: string) => (cuerpo += parte));
        respuesta.on("end", () =>
          resolver({ estado: respuesta.statusCode ?? 0, cuerpo }),
        );
      },
    );

    pedido.on("timeout", () => pedido.destroy(new Error("TIMEOUT")));
    pedido.on("error", rechazar);
    pedido.end();
  });
}

export interface PersonaCidituc {
  /** Id de la persona en CiDiTuc. */
  id: string | null;
  /** Documento, sólo dígitos. Es la identidad con la que enganchamos la ficha. */
  documento: string;
  nombre: string | null;
  email: string | null;
}

/**
 * El backend hace `SELECT p.*` sobre MySQL, así que `documento_persona` e
 * `id_persona` pueden llegar como **número**. Exigir string descarta
 * documentos perfectamente válidos.
 */
function texto(valor: unknown): string | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  if (typeof valor === "string" && valor.trim() !== "") return valor.trim();
  return null;
}

/**
 * De todo lo que trae el perfil —incluye permisos sobre otros sistemas,
 * teléfono, barrio— leemos sólo lo que vamos a usar: lo que no se guarda no se
 * puede filtrar.
 */
function personaDeRespuesta(cuerpo: unknown): PersonaCidituc | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;

  const envoltorio = cuerpo as Record<string, unknown>;
  const persona = (envoltorio["usuarioSinContraseña"] ??
    envoltorio.user ??
    envoltorio) as Record<string, unknown>;

  const documento = texto(persona.documento_persona)?.replace(/\D/g, "") ?? "";
  if (!/^\d{6,11}$/.test(documento)) return null;

  const nombre =
    [texto(persona.nombre_persona), texto(persona.apellido_persona)]
      .filter(Boolean)
      .join(" ") || null;

  return {
    id: texto(persona.id_persona),
    documento,
    nombre,
    email: texto(persona.email_persona)?.toLowerCase() ?? null,
  };
}

export type MotivoFallo = "sin-perfil" | "token-invalido" | "sin-documento";

export type ResultadoPerfil =
  { ok: true; persona: PersonaCidituc } | { ok: false; motivo: MotivoFallo };

/**
 * Consultar el perfil **es** validar el token: con uno falso o vencido el
 * backend contesta 401.
 *
 * El endpoint es `/usuarios/authStatus`. El `/usuarios/authStatusIA` es de
 * empleados municipales y a un vecino le da 401.
 */
export async function consultarPerfil(token: string): Promise<ResultadoPerfil> {
  let respuesta: { estado: number; cuerpo: string };

  try {
    respuesta = await pedirPerfil(token);
  } catch (causa) {
    // El token nunca va a un log.
    console.error(
      "[cidituc] no se pudo consultar el perfil:",
      (causa as NodeJS.ErrnoException)?.code ?? causa,
    );
    return { ok: false, motivo: "sin-perfil" };
  }

  if (respuesta.estado === 401) return { ok: false, motivo: "token-invalido" };
  if (respuesta.estado < 200 || respuesta.estado >= 300) {
    console.error("[cidituc] el perfil respondió", respuesta.estado);
    return { ok: false, motivo: "sin-perfil" };
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(respuesta.cuerpo);
  } catch {
    return { ok: false, motivo: "sin-perfil" };
  }

  const persona = personaDeRespuesta(cuerpo);
  if (!persona) return { ok: false, motivo: "sin-documento" };

  return { ok: true, persona };
}
