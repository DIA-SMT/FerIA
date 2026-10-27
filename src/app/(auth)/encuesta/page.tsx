import { redirect } from "next/navigation";

import {
  FormularioEncuesta,
  type FeriaParaElegir,
} from "@/components/vendedor/formulario-encuesta";
import { prisma } from "@/lib/db";
import { obtenerSesion, obtenerUsuarioAuth } from "@/lib/session";

export const metadata = { title: "Pedir el alta" };

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
          Pedí el alta como feriante
        </h1>
        <p className="mt-1 text-slate-600">
          Contanos de tu emprendimiento. Cuando la Dirección de Ferias y
          Mercados te dé el alta vas a tener tu stand online, y desde ahí podés
          pedir estar en las ferias presenciales que quieras.
        </p>
      </header>

      {/*
        El formulario se dibuja aunque no haya ninguna feria activa, y eso es un
        arreglo. Antes esta pantalla mostraba un cartel de «todavía no hay ferias
        abiertas» en lugar del formulario: como la feria era obligatoria, un
        período sin ferias publicadas dejaba a cualquier emprendedor sin poder
        darse de alta, ni siquiera para tener su vidriera. Ahora la feria es
        opcional, así que lo único que pasa sin ferias activas es que la última
        tarjeta no tiene nada para ofrecer.
      */}
      <FormularioEncuesta
        ferias={ferias satisfies FeriaParaElegir[]}
        persona={{
          nombre: sesion.nombre,
          email: sesion.email,
          documento: typeof documento === "string" ? documento : null,
        }}
      />
    </div>
  );
}
