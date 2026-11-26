import Link from "next/link";

import {
  ListaDeBorradores,
  SubirVariasFotos,
} from "@/components/vendedor/borradores";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { cuandoSeBorra, MAXIMO_BORRADORES } from "@/lib/borradores";
import { prisma } from "@/lib/db";
import { urlPublica } from "@/lib/media";
import { podarSinFrenar } from "@/lib/poda-de-borradores";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Borradores" };

/**
 * Hasta un minuto por pedido, como el alta: cada foto que se sube pasa por
 * el mismo arreglo, y en un celular con mala señal la subida sola tarda.
 */
export const maxDuration = 60;

/**
 * Los borradores del feriante: para subir varias fotos de una vez y ponerles
 * nombre y descripción a todas en el mismo lugar (ver `src/lib/borradores.ts`).
 */
export default async function PaginaBorradores() {
  const { vendedor } = await requerirVendedorAprobado();
  await podarSinFrenar();

  const borradores = await prisma.producto.findMany({
    where: { vendedorId: vendedor.id, borrador: true },
    orderBy: { creadoEn: "asc" },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      imagenes: true,
      actualizadoEn: true,
    },
  });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/mi-stand#catalogo"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-municipal-700"
        >
          <IconoFlechaIzquierda className="size-4" />
          Volver a mi stand
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Borradores
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Los ves sólo vos, y lo que escribís se guarda solo. Cuando estén
          listos, mandalos a revisión. Si no los tocás en 7 días, se borran.
        </p>
      </header>

      <div className="space-y-6">
        <SubirVariasFotos
          lugares={Math.max(0, MAXIMO_BORRADORES - borradores.length)}
        />
        <ListaDeBorradores
          borradores={borradores.map((borrador) => ({
            id: borrador.id,
            nombre: borrador.nombre,
            descripcion: borrador.descripcion ?? "",
            foto: borrador.imagenes[0]
              ? urlPublica(borrador.imagenes[0])
              : null,
            seBorra: cuandoSeBorra(borrador.actualizadoEn),
          }))}
        />
      </div>
    </div>
  );
}
