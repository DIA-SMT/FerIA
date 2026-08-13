import type { SVGProps } from "react";

/**
 * Íconos en SVG inline.
 *
 * Se dibujan a mano en lugar de sumar una librería: son pocos, pesan nada y
 * heredan el color del texto (`currentColor`), así que combinan solos con la
 * paleta institucional.
 */

type PropsIcono = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: PropsIcono) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconoMenu(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  );
}

export function IconoCerrar(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function IconoBuscar(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Base>
  );
}

export function IconoFiltro(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />
    </Base>
  );
}

export function IconoCalendario(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Base>
  );
}

export function IconoUbicacion(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Base>
  );
}

export function IconoReloj(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  );
}

export function IconoWhatsapp(props: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29z" />
    </svg>
  );
}

export function IconoInstagram(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconoFacebook(props: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.63A22 22 0 0014.29 3.5c-2.4 0-4.04 1.47-4.04 4.16V9.9H7.5V13h2.75v8h3.25z" />
    </svg>
  );
}

export function IconoWeb(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </Base>
  );
}

export function IconoTelefono(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M5 3h3l2 5-2.5 1.5a12 12 0 005 5L14 12l5 2v3a2 2 0 01-2.2 2A16 16 0 013 5.2 2 2 0 015 3z" />
    </Base>
  );
}

export function IconoCorreo(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </Base>
  );
}

export function IconoTilde(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M5 13l4 4L19 7" />
    </Base>
  );
}

export function IconoTildeCirculo(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Base>
  );
}

export function IconoAlerta(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M12 4l9 15.5H3L12 4z" />
      <path d="M12 10v4M12 17h.01" />
    </Base>
  );
}

export function IconoInfo(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Base>
  );
}

export function IconoChevronDerecha(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M9 5l7 7-7 7" />
    </Base>
  );
}

export function IconoChevronAbajo(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M5 9l7 7 7-7" />
    </Base>
  );
}

export function IconoFlechaIzquierda(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Base>
  );
}

export function IconoMas(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconoLapiz(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" />
      <path d="M14.5 6.5l3 3" />
    </Base>
  );
}

export function IconoTacho(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </Base>
  );
}

export function IconoTienda(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M4 4h16l1.2 4.4A3 3 0 0118.3 12a3 3 0 01-3-1.6 3 3 0 01-3.3 1.6 3 3 0 01-3-1.6A3 3 0 015.7 12a3 3 0 01-2.9-3.6L4 4z" />
      <path d="M5 12v8h14v-8" />
      <path d="M10 20v-5h4v5" />
    </Base>
  );
}

export function IconoGrilla(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </Base>
  );
}

export function IconoUsuarios(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M16 5.2a3.5 3.5 0 010 5.6M17.5 14.4A6.5 6.5 0 0121.5 20" />
    </Base>
  );
}

export function IconoDinero(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </Base>
  );
}

export function IconoGrafico(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-6M12.5 20V8M17 20v-9" />
    </Base>
  );
}

export function IconoBandeja(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M4 13l2-8h12l2 8" />
      <path d="M4 13h4l1.5 3h5L16 13h4v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5z" />
    </Base>
  );
}

export function IconoSalir(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </Base>
  );
}

export function IconoSubir(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </Base>
  );
}

export function IconoImagen(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M3.5 17l5-5 4 4 3-2.5 5 4" />
    </Base>
  );
}

export function IconoEnlaceExterno(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8.5 8.5" />
      <path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
    </Base>
  );
}

export function IconoEtiqueta(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M3 12.5V4h8.5l8.5 8.5-8.5 8.5L3 12.5z" />
      <circle cx="7.5" cy="8.5" r="1.3" />
    </Base>
  );
}

export function IconoDocumento(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </Base>
  );
}
