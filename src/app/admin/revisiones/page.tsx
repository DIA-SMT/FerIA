import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { RevisionDeCambio } from "@/components/admin/revision-de-cambio";
import { Avatar } from "@/components/ui/avatar";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoEnlaceExterno, IconoTildeCirculo } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { requerirAdmin } from "@/lib/session";

export const metadata = { title: "Revisiones" };

/**
 * Todo lo que los feriantes cambiaron en su stand y espera aprobación.
 *
 * Nada se publica sin pasar por acá (ver `src/lib/revision.ts`): la portada,
 * el logo, el nombre, la descripción, el contacto y cada producto. Los cambios
 * van agrupados por feriante, del que espera hace más tiempo al más nuevo, y
 * cada uno muestra lo que se ve hoy al lado de lo propuesto.
 */
export default async function PaginaRevisiones() {
  await requerirAdmin();

  const cambios = await prisma.cambioDelStand.findMany({
    where: { estado: "PENDIENTE" },
    orderBy: { actualizadoEn: "asc" },
    select: {
      id: true,
      seccion: true,
      datos: true,
      actualizadoEn: true,
      producto: {
        select: { nombre: true, descripcion: true, imagenes: true, destacado: true },
      },
      vendedor: {
        select: {
          id: true,
          slug: true,
          emprendimiento: true,
          rubro: true,
          descripcion: true,
          imagenPortada: true,
          logo: true,
          whatsapp: true,
          telefono: true,
          email: true,
          instagram: true,
          facebook: true,
          sitioWeb: true,
          direccion: true,
        },
      },
    },
  });

  // Agrupados por feriante, en el orden del cambio más viejo de cada uno.
  const porFeriante = new Map<string, typeof cambios>();
  for (const cambio of cambios) {
    const lista = porFeriante.get(cambio.vendedor.id) ?? [];
    lista.push(cambio);
    porFeriante.set(cambio.vendedor.id, lista);
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Revisiones"
        descripcion="Lo que los feriantes cambiaron en su stand. Nada se publica hasta que lo aprobás; si lo rechazás, el feriante ve el motivo y lo puede corregir."
      />

      {cambios.length === 0 ? (
        <EstadoVacio
          icono={IconoTildeCirculo}
          titulo="No hay nada para revisar"
          descripcion="Cuando un feriante cambie algo de su stand o agregue un producto, va a aparecer acá."
        />
      ) : (
        <div className="space-y-8">
          {[...porFeriante.values()].map((lista) => {
            const stand = lista[0]!.vendedor;
            return (
              <section key={stand.id} className="space-y-3">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      nombre={stand.emprendimiento}
                      imagen={stand.logo}
                      tamanio="sm"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-900">
                        {stand.emprendimiento}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {lista.length === 1
                          ? "1 cambio para revisar"
                          : `${lista.length} cambios para revisar`}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/stands/${stand.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-municipal-600 hover:text-municipal-700"
                  >
                    Ver el stand publicado
                    <IconoEnlaceExterno className="size-4" />
                  </Link>
                </header>

                {lista.map((cambio) => (
                  <RevisionDeCambio
                    key={cambio.id}
                    cambio={cambio}
                    stand={stand}
                    producto={cambio.producto}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
