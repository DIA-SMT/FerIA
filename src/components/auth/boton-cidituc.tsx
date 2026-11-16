import { IconoEnlaceExterno } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

/**
 * Entrada por CiDiTuc, la identidad digital del municipio.
 *
 * Es un enlace y no un botón de formulario: la ruta `/auth/cidituc/ingresar`
 * planta la cookie del `state` y redirige al login de Ciudad Digital.
 *
 * Para el feriante es la única puerta: su ficha viene del padrón importado de
 * Feria Digital y nunca tuvo contraseña acá. El correo y la contraseña quedan
 * para el personal municipal, en la pantalla del panel.
 *
 * Esto **no** aparece para el vecino que compra: el carrito y el pedido no
 * piden cuenta en ningún momento.
 */
export function BotonCidituc({
  /**
   * El separador «o» sólo tiene sentido si abajo viene otra forma de entrar.
   * Solo en la pantalla, deja una raya suelta al final de la tarjeta.
   */
  conSeparador = true,
  /**
   * Grande cuando es la única puerta de la pantalla: tiene que ser lo que más
   * se ve. Chico cuando comparte la tarjeta con el formulario de correo.
   */
  grande = false,
}: {
  conSeparador?: boolean;
  grande?: boolean;
}) {
  return (
    <div>
      <a
        href="/auth/cidituc/ingresar"
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 bg-municipal-500 text-white transition-colors hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2",
          grande
            ? "h-14 rounded-xl px-6 text-base font-bold shadow-lg shadow-municipal-500/30 focus-visible:outline-acento-400"
            : "rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm focus-visible:outline-municipal-600",
        )}
      >
        <IconoEnlaceExterno className={grande ? "size-5" : "size-4"} />
        Ingresar con CiDiTuc
      </a>

      <p
        className={cn(
          "mx-auto mt-2 text-center text-slate-500",
          grande ? "mt-3.5 max-w-xs text-sm text-slate-600" : "text-xs",
        )}
      >
        Con tu CUIL y la clave de Ciudadano Digital de San Miguel de Tucumán.
      </p>

      {conSeparador && (
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-400">o</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      )}
    </div>
  );
}
