import { ZONA } from "@/lib/format";
import { rutaEsDelVendedor } from "@/lib/fotos-producto";

/*
  Los borradores de productos (pedido de la Dirección, 26/11/2026).

  Un producto en borrador lo ve sólo el feriante mientras lo arma: no está
  publicado ni le llega a la Dirección. Así puede subir varias fotos de una
  vez —cada una se vuelve un producto—, ponerles nombre y descripción después,
  ver cómo quedan en su stand y mandar a revisión sólo lo terminado.

  Se guarda solo: en el alta, apenas sube la primera foto o escribe el nombre.
  Si pasa 7 días sin cambios, se borra con sus fotos (`poda-de-borradores.ts`).

  Este archivo no toca la base: lo usan también las pantallas.
*/

/** Días sin cambios después de los cuales un borrador se borra solo. */
export const DIAS_DE_BORRADOR = 7;

/** Cuántos borradores puede tener un feriante a la vez. */
export const MAXIMO_BORRADORES = 30;

/** Las fotos de un producto, igual que en el alta y la edición. */
export const MAXIMO_FOTOS = 4;

const UN_DIA = 24 * 60 * 60 * 1000;

/** Para mandarlo a revisión le alcanza con el nombre: el resto es opcional. */
export function borradorCompleto(nombre: string): boolean {
  return nombre.trim().length >= 2;
}

/** El momento en que se borra un borrador que no se vuelva a tocar. */
export function seBorraEl(actualizadoEn: Date): Date {
  return new Date(actualizadoEn.getTime() + DIAS_DE_BORRADOR * UN_DIA);
}

/** «el jueves 3 de diciembre», en la hora de Tucumán. */
export function cuandoSeBorra(actualizadoEn: Date): string {
  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA,
  }).format(seBorraEl(actualizadoEn));
  return `el ${fecha.replace(",", "")}`;
}

/**
 * Las fotos con que queda el producto: las que ya tenía y el feriante dejó, y
 * las nuevas que eligió.
 *
 * Las rutas vienen del navegador, así que no se creen: las que ya tenía tienen
 * que estar de verdad en el producto, y las nuevas, en la carpeta del
 * feriante. Sin eso podría colgarse la foto de otro, o hacérnosla borrar.
 */
export function fotosDelProducto({
  enElProducto,
  conservadas,
  nuevas,
  vendedorId,
}: {
  enElProducto: string[];
  conservadas: string[];
  nuevas: string[];
  vendedorId: string;
}): string[] {
  const quedan = conservadas.filter((ruta) => enElProducto.includes(ruta));
  const agregadas = nuevas.filter(
    (ruta) => rutaEsDelVendedor(ruta, vendedorId) && !quedan.includes(ruta),
  );
  return [...new Set([...quedan, ...agregadas])].slice(0, MAXIMO_FOTOS);
}

/**
 * Las fotos que hay que borrar del disco después de guardar: las que tenía el
 * producto y ya no, y las variantes que el feriante descartó. Nunca una que
 * siga en uso, ni una que no sea de su carpeta.
 */
export function fotosQueSobran({
  antes,
  descartadas,
  ahora,
  vendedorId,
}: {
  antes: string[];
  descartadas: string[];
  ahora: string[];
  vendedorId: string;
}): string[] {
  return [
    ...new Set([
      ...antes,
      ...descartadas.filter((ruta) => rutaEsDelVendedor(ruta, vendedorId)),
    ]),
  ].filter((ruta) => !ahora.includes(ruta));
}
