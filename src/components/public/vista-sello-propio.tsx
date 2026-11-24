import Image from "next/image";
import Link from "next/link";

import {
  TarjetaPropuesta,
  type PropuestaParaTarjeta,
} from "@/components/public/tarjeta-propuesta";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCubiertos,
  IconoRegalo,
  type ComponenteIcono,
} from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { TIPOS_SELLO_PROPIO, type TipoSelloPropio } from "@/lib/sello-propio";

const KIT = "/ferias-hero";

const ICONO_TIPO: Record<TipoSelloPropio, ComponenteIcono> = {
  REGALO: IconoRegalo,
  SERVICIO: IconoCubiertos,
};

const TIPOS: TipoSelloPropio[] = ["REGALO", "SERVICIO"];

/**
 * «Modo Feria»: «Regalos con sello propio» y «Servicios con sello propio», una
 * página por tipo con pestañas para pasar de una a otra (son las dos opciones
 * del menú). El encabezado es el de `/ferias` —el mismo fondo de feria con su
 * velo— con el sello de la convocatoria en el lugar de Migue, y cambia de
 * nombre y de sello con la pestaña: son dos convocatorias con sello propio
 * cada una.
 */
export function VistaSelloPropio({
  tipo,
  propuestas,
}: {
  tipo: TipoSelloPropio;
  propuestas: PropuestaParaTarjeta[];
}) {
  const datos = TIPOS_SELLO_PROPIO[tipo];

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
          className="absolute inset-0 -z-10 bg-[#f1f8ff]/85 lg:bg-transparent lg:bg-gradient-to-r lg:from-[#f4f9ff]/95 lg:via-[#eef6fd]/85 lg:to-[#eef6fd]/70 dark:bg-[#07152f]/85 dark:lg:bg-transparent dark:lg:from-[#07152f]/95 dark:lg:via-[#07152f]/80 dark:lg:to-[#07152f]/70"
          aria-hidden="true"
        />

        <div className="mx-auto flex max-w-7xl items-start gap-4 px-4 py-9 sm:items-center sm:gap-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
          <div className="min-w-0 flex-1">
            <Link
              href="/modo-feria"
              className="mb-2 inline-block text-sm font-semibold text-[#0866F2] hover:underline dark:text-[#8ec2fc]"
            >
              Modo Feria
            </Link>
            <h1 className="font-globo text-[2.1rem] leading-[1.02] font-extrabold tracking-[-0.03em] text-[#081B45] sm:text-5xl dark:text-white">
              {datos.titulo}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-snug font-semibold text-[#374B70] sm:text-lg dark:text-[#d4e8ff]">
              {datos.bajada}
            </p>
            <p className="mt-2 max-w-xl text-sm text-[#374B70] dark:text-[#d4e8ff]/85">
              Escribile directo a quien lo hace: el presupuesto, las cantidades
              y la entrega los acuerdan entre ustedes.
            </p>

            <nav
              aria-label="Regalos o servicios"
              className="mt-6 flex flex-wrap gap-2"
            >
              {TIPOS.map((cada) => {
                const Icono = ICONO_TIPO[cada];
                const activa = cada === tipo;
                return (
                  <Link
                    key={cada}
                    href={TIPOS_SELLO_PROPIO[cada].href}
                    aria-current={activa ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-semibold shadow-[0_2px_8px_rgb(8_27_69/0.08)] ring-1 transition-colors",
                      activa
                        ? "paleta-original bg-[#0866F2] text-white ring-[#0866F2]"
                        : "bg-superficie/90 text-[#081B45] ring-[#cfe0f0] hover:bg-superficie dark:text-white dark:ring-white/15",
                    )}
                  >
                    <span
                      className={cn(
                        "paleta-original flex size-6 items-center justify-center rounded-full",
                        activa ? "bg-white/20" : "bg-[#0866F2] text-white",
                      )}
                      aria-hidden="true"
                    >
                      <Icono className="size-3.5" />
                    </span>
                    {TIPOS_SELLO_PROPIO[cada].corto}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* El sello dice lo mismo que el título: para quien lee la pantalla
              es una repetición, por eso el `alt` vacío. */}
          <Image
            src={datos.sello}
            alt=""
            width={280}
            height={280}
            priority
            sizes="(max-width: 640px) 96px, (max-width: 1024px) 160px, 224px"
            className="w-24 shrink-0 -rotate-6 drop-shadow-[0_10px_18px_rgb(10_21_69/0.22)] sm:w-40 lg:mr-8 lg:w-56"
          />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:px-8">
        {propuestas.length === 0 ? (
          <EstadoVacio
            icono={ICONO_TIPO[tipo]}
            titulo={
              tipo === "REGALO"
                ? "Todavía no hay regalos publicados"
                : "Todavía no hay servicios publicados"
            }
            descripcion="Los feriantes los están sumando. ¿Tenés un puesto en las ferias? Cargá el tuyo desde Mi stand, en «Modo Feria»."
            accion={
              <Link
                href="/mi-stand/modo-feria"
                className="text-sm font-medium text-municipal-600 hover:text-municipal-700"
              >
                Ir a Mi stand
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {propuestas.map((propuesta, indice) => (
              <li key={propuesta.id}>
                <TarjetaPropuesta
                  propuesta={propuesta}
                  prioridad={indice < 3}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
