import { cn } from "@/lib/cn";

const KIT = "/ferias-hero";

/**
 * Los pines, en porcentajes de la caja de la ruta (`.pinBag`, `.pinLocation`…
 * del kit). Cada uno se corre medio ancho a la izquierda y un 40 % de su alto
 * hacia arriba, para que la punta caiga sobre la línea.
 */
const PINES = [
  { archivo: "pin-bolsa.svg", x: 6, y: 41 },
  { archivo: "pin-ubicacion.svg", x: 34, y: 3 },
  { archivo: "pin-eco.svg", x: 67, y: 39 },
  { archivo: "pin-comida.svg", x: 96, y: 30 },
];

/** La ruta punteada con sus pines. Decorativa. */
export function Ruta({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none", className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${KIT}/ruta-punteada.svg`}
        alt=""
        className="absolute inset-0 size-full object-fill"
      />
      {PINES.map((pin, indice) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={pin.archivo}
          src={`${KIT}/${pin.archivo}`}
          alt=""
          className="pin-ruta absolute h-auto w-[10%] -translate-x-1/2 -translate-y-[40%] drop-shadow-[0_5px_4px_rgb(0_26_49/0.33)] max-xl:w-[13%]"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            animationDelay: `${indice * 180}ms`,
          }}
        />
      ))}
    </div>
  );
}
