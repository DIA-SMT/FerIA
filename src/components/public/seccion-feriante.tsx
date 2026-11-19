import Image from "next/image";

import { BotonLink } from "@/components/ui/boton";

/**
 * Los tres pasos para ser feriante. Los textos son de la Dirección; los
 * stickers, de `public/inicio/`, generados con IA como los de los rubros.
 */
const PASOS = [
  {
    sticker: "/inicio/paso-registro.webp",
    titulo: "Registrás tu emprendimiento",
    texto:
      "Entrás con tu cuenta de CiDiTuc y completás los datos de tu emprendimiento.",
  },
  {
    sticker: "/inicio/paso-revision.webp",
    titulo: "La Dirección de Relaciones Institucionales revisa tu solicitud",
    texto:
      "Verifica que cumpla con el reglamento de ferias vigente. Si se aprueba, se habilita tu stand online para que cargues tus productos.",
  },
  {
    sticker: "/inicio/paso-puesto.webp",
    titulo: "Esperás un lugar en una feria",
    texto:
      "Tu solicitud queda en lista de espera hasta que haya cupo. Los lugares se asignan según lo que se necesite en cada rubro y tipo de producto.",
  },
];

/** «¿Tenés un emprendimiento y querés participar?», al pie de la portada. */
export function SeccionFeriante() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[1.75rem] border-[1.5px] border-municipal-100 bg-municipal-50">
        {/* Los banderines del hero, de punta a punta. */}
        <div
          className="pointer-events-none absolute -top-3.5 -right-2.5 -left-2.5 h-18 bg-[url(/ferias-hero/banderines.svg)] bg-[length:340px_73px] bg-repeat-x dark:opacity-45"
          aria-hidden="true"
        />

        <div className="grid items-center gap-8 px-6 pt-20 pb-10 sm:px-10 lg:grid-cols-[11rem_1fr_1fr] lg:gap-9 lg:pr-11 lg:pl-5">
          {/* Festejando con el pulgar arriba, recortado por el borde de abajo
              de la caja. En el teléfono y la tablet no entra y no va. */}
          <Image
            src="/inicio/migue-celebrando.webp"
            alt=""
            width={273}
            height={620}
            sizes="(min-width: 1024px) 135px, 1px"
            className="pointer-events-none -mb-10 hidden h-76 w-auto self-end justify-self-center lg:block"
          />

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              ¿Tenés un emprendimiento y querés participar?
            </h2>
            {/* Pedido de la Dirección: dejar claro que anotarse no asegura un
                lugar, porque la gente creía que presentaba los datos y ya
                tenía puesto. El cómo y el porqué del cupo están en el paso
                3; acá va sólo la advertencia, para no decirlo dos veces. */}
            <p className="mt-3 text-slate-600">
              Registrarte es el primer paso, pero no te asegura un lugar en una
              feria.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <BotonLink href="/registro" tamanio="lg">
                Registrarme como feriante
              </BotonLink>
              <BotonLink href="/ingresar" variante="contorno" tamanio="lg">
                Ya tengo cuenta
              </BotonLink>
            </div>
          </div>

          {/* Los pasos unidos por una ruta punteada, como la del hero. */}
          <ol className="relative space-y-2 before:absolute before:top-10 before:bottom-10 before:left-[2.0625rem] before:border-l-[3px] before:border-dashed before:border-municipal-300">
            {PASOS.map((paso, indice) => (
              <li
                key={paso.titulo}
                className="relative flex items-center gap-4 py-2"
              >
                <span className="relative size-17 shrink-0">
                  <Image
                    src={paso.sticker}
                    alt=""
                    width={160}
                    height={160}
                    sizes="68px"
                    className="size-full object-contain drop-shadow-[0_6px_8px_rgb(15_23_42/0.18)]"
                  />
                  {/* El número ya lo dice la lista; esto es para la vista. */}
                  <span
                    className="absolute -top-1 -right-1.5 flex size-6 items-center justify-center rounded-full border-2 border-white bg-municipal-500 text-[0.8rem] font-extrabold text-white"
                    aria-hidden="true"
                  >
                    {indice + 1}
                  </span>
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{paso.titulo}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{paso.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
