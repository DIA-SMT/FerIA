import { redirect } from "next/navigation";

import {
  FormularioEncuesta,
  type FeriaParaElegir,
} from "@/components/vendedor/formulario-encuesta";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoTienda } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { obtenerSesion, obtenerUsuarioAuth } from "@/lib/session";

export const metadata = { title: "Sumarme a una feria" };

/**
 * La encuesta, para alguien que ya entró y todavía no tiene ficha.
 *
 * Vive en el grupo `(auth)` y no bajo `/mi-stand`: el layout de `/mi-stand`
 * exige ficha de feriante, y quien llega acá justamente no la tiene todavía —la
 * pantalla no se habría dibujado nunca—. Igual pide sesión: es el paso
 * siguiente al ingreso por CiDiTuc, no una alternativa al ingreso.
 *
 * Quien ya tiene ficha no la necesita y se lo manda al resumen, donde puede
 * postularse a otra feria sin volver a cargar sus datos.
 */
export default async function PaginaEncuesta() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar?volverA=/encuesta");

  const vendedor = await prisma.vendedor.findUnique({
    where: { usuarioId: sesion.id },
    select: { id: true },
  });
  if (vendedor) redirect("/mi-stand");

  const ferias = await prisma.feria.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  /*
    El documento se muestra, no se pide. Se muestra porque la ley 25.326 (art.
    6) obliga a decir qué datos se guardan y para qué, y porque alguien que ve
    su propio DNI en pantalla entiende de un vistazo por qué no se le pidió:
    ya vino verificado de CiDiTuc.
  */
  const usuario = await obtenerUsuarioAuth();
  const documento = usuario?.user_metadata?.["documento"];

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sumate a una feria
        </h1>
        <p className="mt-1 text-slate-600">
          Contanos de tu emprendimiento y elegí a qué feria querés ir. La
          Dirección de Ferias y Mercados revisa cada postulación.
        </p>
      </header>

      {ferias.length === 0 ? (
        <EstadoVacio
          icono={IconoTienda}
          titulo="Todavía no hay ferias abiertas"
          descripcion="Cuando la municipalidad publique las ferias de la temporada vas a poder postularte."
        />
      ) : (
        <FormularioEncuesta
          ferias={ferias satisfies FeriaParaElegir[]}
          persona={{
            nombre: sesion.nombre,
            email: sesion.email,
            documento: typeof documento === "string" ? documento : null,
          }}
        />
      )}
    </div>
  );
}
