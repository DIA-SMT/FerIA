import { IconoEnlaceExterno } from "@/components/ui/iconos";

/**
 * Entrada por CiDiTuc, la identidad digital del municipio.
 *
 * Es un enlace y no un botón de formulario: la ruta `/auth/cidituc/ingresar`
 * planta la cookie del `state` y redirige al Derivador.
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
}: {
  conSeparador?: boolean;
}) {
  return (
    <div>
      <a
        href="/auth/cidituc/ingresar"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-municipal-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
      >
        <IconoEnlaceExterno className="size-4" />
        Ingresar con CiDiTuc
      </a>

      <p className="mt-2 text-center text-xs text-slate-500">
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
