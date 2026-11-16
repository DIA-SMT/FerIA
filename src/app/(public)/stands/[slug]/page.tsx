import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { TarjetaProducto } from "@/components/public/tarjeta-producto";
import { VistaStand } from "@/components/public/vista-stand";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoEtiqueta } from "@/components/ui/iconos";
import { EDICIONES_PUBLICAS } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { aNumero, hoyEnZona, truncar } from "@/lib/format";
import { registrarApertura } from "@/lib/interes";
import { RUBROS } from "@/lib/labels";
import { hayPedidos, hayPreciosPublicos } from "@/lib/marketplace";
import { hayUnidades } from "@/lib/pedidos";
import { esVisitaDeUnaPersona } from "@/lib/visitas";

async function obtenerStand(slug: string) {
  return prisma.vendedor.findFirst({
    where: { slug, estado: "APROBADO" },
    include: {
      productos: {
        orderBy: [
          { destacado: "desc" },
          { disponible: "desc" },
          { nombre: "asc" },
        ],
      },
      stands: {
        where: { edicion: EDICIONES_PUBLICAS },
        orderBy: { edicion: { fechaInicio: "asc" } },
        include: {
          edicion: {
            include: {
              feria: { select: { nombre: true, slug: true, direccion: true } },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vendedor = await prisma.vendedor.findFirst({
    where: { slug, estado: "APROBADO" },
    select: {
      emprendimiento: true,
      descripcion: true,
      rubro: true,
      imagenPortada: true,
    },
  });

  if (!vendedor) return { title: "Stand no encontrado" };

  const descripcion = vendedor.descripcion
    ? truncar(vendedor.descripcion, 155)
    : `${RUBROS[vendedor.rubro]} en las ferias municipales de San Miguel de Tucumán.`;

  return {
    title: vendedor.emprendimiento,
    description: descripcion,
    openGraph: {
      title: vendedor.emprendimiento,
      description: descripcion,
      ...(vendedor.imagenPortada ? { images: [vendedor.imagenPortada] } : {}),
    },
  };
}

export default async function PaginaStand({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vendedor = await obtenerStand(slug);

  /**
   * El 404 se decide acá, y tiene que decidirse ANTES de que salga el primer
   * byte de la respuesta: el status viaja en la cabecera, así que una vez que
   * Next empezó a streamear, `notFound()` alcanza a cambiar el cuerpo pero no
   * el código.
   *
   * Hasta el 23/10 había un `loading.tsx` en `(public)` que envolvía todas las
   * páginas del market en un Suspense. El cascarón salía apenas este
   * componente se quedaba esperando la consulta, y entonces
   * /stands/no-existe respondía **HTTP 200** con la pantalla de «no
   * encontramos esta página». Para un buscador eso no es una URL muerta: es
   * una página válida, y la indexa. Por eso se borró ese `loading.tsx`: sin
   * límite de streaming por encima, la página se renderiza entera antes de
   * responder y el 404 sale con su código.
   *
   * Si alguien quiere devolver el esqueleto de carga, va con un `<Suspense>`
   * propio dentro de las páginas de listado (/ferias y /stands), que es donde
   * tenía sentido —el esqueleto era una grilla de tarjetas, que no se parece
   * en nada a esta pantalla—. Un `loading.tsx` por encima de esta ruta vuelve
   * a convertir el 404 en 200 sin romper nada visible, que es lo que lo hace
   * difícil de notar.
   */
  if (!vendedor) notFound();

  /**
   * El denominador: cuántas veces se abrió esta vidriera.
   *
   * Va dentro de `after()` para que el incremento ocurra con la respuesta ya
   * enviada: contar no le puede agregar un milisegundo a la página de un
   * feriante. Lo que descarta `esVisitaDeUnaPersona` son sobre todo los
   * prefetch de Next —pasar el mouse por la lista de stands se traería veinte
   * vidrieras— y los bots. Ver docs/interes-en-la-vidriera.md.
   */
  if (esVisitaDeUnaPersona(await headers())) {
    after(() => registrarApertura(vendedor.id));
  }

  const hoy = hoyEnZona();
  const participaciones = vendedor.stands.filter(
    (stand) => stand.edicion.fechaFin >= hoy,
  );

  // El `Decimal` de Prisma no se puede serializar hacia un Client Component,
  // y el botón de agregar al carrito lo es. Se convierte acá, una sola vez.
  const productos = vendedor.productos.map((producto) => ({
    ...producto,
    precio: producto.precio === null ? null : aNumero(producto.precio),
  }));

  const disponibles = productos.filter(hayUnidades);
  const agotados = productos.filter((producto) => !hayUnidades(producto));

  const marketplace = { precios: hayPreciosPublicos(), pedidos: hayPedidos() };
  const stand = {
    slug: vendedor.slug,
    emprendimiento: vendedor.emprendimiento,
  };

  const resumenCatalogo =
    productos.length === 0
      ? null
      : `${disponibles.length} ${disponibles.length === 1 ? "disponible" : "disponibles"}${
          agotados.length > 0 ? ` · ${agotados.length} sin stock` : ""
        }`;

  return (
    <VistaStand
      vendedor={vendedor}
      participaciones={participaciones}
      resumenCatalogo={resumenCatalogo}
      catalogo={
        productos.length === 0 ? (
          <EstadoVacio
            icono={IconoEtiqueta}
            className="mt-4"
            titulo="Catálogo en preparación"
            descripcion="Este feriante todavía no cargó sus productos. Podés escribirle por WhatsApp para consultarle qué tiene disponible."
          />
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...disponibles, ...agotados].map((producto) => (
              <TarjetaProducto
                key={producto.id}
                producto={producto}
                stand={stand}
                whatsapp={vendedor.whatsapp}
                marketplace={marketplace}
              />
            ))}
          </div>
        )
      }
    />
  );
}
