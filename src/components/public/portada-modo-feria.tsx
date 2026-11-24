import Image from "next/image";
import Link from "next/link";

import { IconoChevronDerecha } from "@/components/ui/iconos";
import { TIPOS_SELLO_PROPIO, type TipoSelloPropio } from "@/lib/sello-propio";

const KIT = "/ferias-hero";

const PASOS = [
  {
    titulo: "Elegí un regalo o un servicio",
    texto:
      "Productos, cajas, combos, food trucks y patios gastronómicos de nuestras ferias.",
  },
  {
    titulo: "Escribile a quien lo hace",
    texto:
      "Cada propuesta tiene su botón de WhatsApp, con el mensaje ya escrito.",
  },
  {
    titulo: "Arreglen entre ustedes",
    texto:
      "El presupuesto, las cantidades y la entrega se acuerdan directamente.",
  },
];

/**
 * La entrada a Modo Feria: el logo de la convocatoria y sus dos opciones en
 * grande, cada una con su sello. Abajo, cómo funciona en tres pasos y, para
 * los feriantes, dónde sumar lo suyo.
 */
export function PortadaModoFeria({
  cantidades,
}: {
  /** Cuántas propuestas publicadas hay de cada tipo. */
  cantidades: Record<TipoSelloPropio, number>;
}) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#ddecf6] dark:bg-[#07152f]">
        <div className="absolute inset-0 -z-20" aria-hidden="true">
          <Image
            src={`${KIT}/fondo-feria-claro.webp`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_62%] transition-opacity duration-300 dark:opacity-0"
          />
          <Image
            src={`${KIT}/fondo-feria-oscuro.webp`}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[50%_62%] opacity-0 transition-opacity duration-300 dark:opacity-100"
          />
        </div>
        <div
          className="absolute inset-0 -z-10 bg-[#f1f8ff]/85 dark:bg-[#07152f]/85"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-5xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 lg:px-8 lg:pb-16">
          <div className="text-center">
            <h1>
              <span className="sr-only">Modo Feria</span>
              {/* En el tema oscuro el azul del logo se pierde sobre el fondo:
                  se pasa a blanco. */}
              <Image
                src="/sello-propio/modo-feria.webp"
                alt=""
                width={640}
                height={331}
                priority
                sizes="(max-width: 640px) 208px, 288px"
                className="mx-auto w-52 sm:w-72 dark:brightness-0 dark:invert"
              />
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-snug font-semibold text-[#374B70] sm:text-xl dark:text-[#d4e8ff]">
              Regalos y servicios con sello propio, hechos por feriantes de San
              Miguel de Tucumán, para empresas e instituciones.
            </p>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {(["REGALO", "SERVICIO"] as const).map((tipo) => {
              const datos = TIPOS_SELLO_PROPIO[tipo];
              const cantidad = cantidades[tipo];
              return (
                <li key={tipo}>
                  {/* En el celular va de costado, con el sello chico, para que
                      entren las dos opciones en la primera pantalla. */}
                  <Link
                    href={datos.href}
                    className="group flex h-full items-center gap-4 rounded-2xl bg-superficie p-4 shadow-[var(--shadow-tarjeta)] ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-tarjeta-hover)] hover:ring-celeste-300 sm:flex-col sm:gap-0 sm:px-6 sm:pt-7 sm:pb-6 sm:text-center"
                  >
                    {/* El nombre va escrito justo abajo. */}
                    <Image
                      src={datos.sello}
                      alt=""
                      width={224}
                      height={224}
                      sizes="(max-width: 640px) 96px, 192px"
                      className="w-24 shrink-0 -rotate-6 drop-shadow-[0_10px_18px_rgb(10_21_69/0.2)] transition-transform group-hover:rotate-0 sm:w-48"
                    />
                    <div className="flex min-w-0 flex-1 flex-col self-stretch sm:items-center">
                      <h2 className="font-globo text-xl leading-tight font-extrabold text-slate-900 sm:mt-5 sm:text-3xl">
                        {datos.titulo}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 sm:mt-2 sm:text-base">
                        {datos.bajada}
                      </p>
                      {cantidad > 0 && (
                        <p className="mt-1 text-sm font-medium text-slate-500 sm:mt-2">
                          {cantidad === 1
                            ? "1 propuesta"
                            : `${cantidad} propuestas`}
                        </p>
                      )}
                      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 font-semibold text-municipal-600 group-hover:text-municipal-700 sm:pt-5">
                        Ver {datos.corto.toLowerCase()}
                        <IconoChevronDerecha className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Cómo funciona
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo} className="flex gap-4 sm:flex-col sm:gap-3">
              <span
                className="paleta-original flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0866F2] font-globo text-lg font-extrabold text-white"
                aria-hidden="true"
              >
                {indice + 1}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{paso.titulo}</h3>
                <p className="mt-1 text-sm text-slate-600">{paso.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 rounded-xl bg-municipal-50 px-5 py-4 text-center text-sm text-slate-700 ring-1 ring-municipal-100">
          ¿Tenés un puesto en las ferias?{" "}
          <Link
            href="/mi-stand/modo-feria"
            className="font-semibold text-municipal-700 underline underline-offset-2"
          >
            Sumá tu propuesta desde Mi stand
          </Link>
          : la revisa la Dirección de Relaciones Institucionales y aparece acá.
        </p>
      </section>
    </>
  );
}
