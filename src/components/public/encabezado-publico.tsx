import Link from "next/link";

import { cerrarSesion } from "@/actions/auth";
import { MenuMovil } from "@/components/public/menu-movil";
import { estilosBoton } from "@/components/ui/boton";
import { LogoMunicipal } from "@/components/ui/logo-municipal";
import { obtenerSesion } from "@/lib/session";

const ENLACES = [
  { href: "/", texto: "Inicio" },
  { href: "/ferias", texto: "Ferias" },
  { href: "/stands", texto: "Stands" },
];

export async function EncabezadoPublico() {
  const sesion = await obtenerSesion();
  const rol = sesion?.rol;

  const acciones = sesion ? (
    <div className="flex items-center gap-2">
      <Link
        href={rol === "ADMIN" ? "/admin" : "/mi-stand"}
        className={estilosBoton("contorno", "sm")}
      >
        {rol === "ADMIN" ? "Panel municipal" : "Mi stand"}
      </Link>
      <form action={cerrarSesion}>
        <button type="submit" className={estilosBoton("fantasma", "sm")}>
          Salir
        </button>
      </form>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link href="/ingresar" className={estilosBoton("fantasma", "sm")}>
        Ingresar
      </Link>
      <Link href="/registro" className={estilosBoton("primario", "sm")}>
        Quiero ser feriante
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <LogoMunicipal />

        <nav className="hidden items-center gap-1 md:flex">
          {ENLACES.map((enlace) => (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-municipal-700"
            >
              {enlace.texto}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">{acciones}</div>

        <MenuMovil enlaces={ENLACES} acciones={acciones} />
      </div>
    </header>
  );
}
