/**
 * Interruptor del módulo de canon.
 *
 * El canon —lo que un feriante pagaría por participar de una edición— dejó de
 * cobrarse: estar en una feria municipal no le cuesta nada al feriante y el
 * costo lo cubre el municipio. La indicación de la Dirección fue **ocultarlo,
 * no borrarlo**, así que el modelo `PagoCanon`, los pagos ya cargados y las
 * pantallas siguen donde estaban; lo único que cambia es que nadie los ve.
 *
 * Apagado —que es el default, porque hoy no se cobra— el módulo desaparece de
 * las dos navegaciones, del tablero y del prompt del asistente público; las
 * cuatro rutas contestan 404 y las acciones de servidor rechazan. El
 * formulario de edición conserva el canon ya cargado en campos ocultos: el
 * administrador no lo ve ni lo edita, pero guardar una edición no lo borra.
 *
 * Prenderlo es una decisión de la Dirección de Ferias y Mercados, no un
 * deploy: si la participación volviera a arancelarse, alcanza con la variable.
 */
export function hayCanon(): boolean {
  return process.env.MOSTRAR_CANON === "true";
}
