import { IconoEnlaceExterno } from "@/components/ui/iconos";

/**
 * Entrada por CiDiTuc, la identidad digital del municipio.
 *
 * Es un enlace y no un botón de formulario: la ruta `/auth/cidituc/ingresar`
 * planta la cookie del `state` y redirige al Derivador.
 *
 * Va primero y con más peso visual que el formulario de correo y contraseña, a
 * propósito: para el feriante del padrón importado, CiDiTuc es la única puerta
 * que funciona —su ficha existe pero nunca tuvo contraseña acá—. El correo y
 * la contraseña quedan para quien se registró antes de todo esto.
 *
 * Esto **no** aparece para el vecino que compra: el carrito y el pedido no
 * piden cuenta en ningún momento.
 */
export function BotonCidituc() {
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

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">o</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
