-- Quita el precio del catálogo de los feriantes.
--
-- Decisión de la Dirección de Ferias y Mercados: la plataforma es una vidriera,
-- no un canal de venta. Publicar precios obliga al feriante a mantenerlos al día
-- y expone al municipio a reclamos por diferencias entre lo publicado y lo que
-- se cobra en el puesto. El precio se acuerda directamente entre el vecino y
-- quien produce, por WhatsApp.
--
-- La columna se elimina sin reemplazo: no hay dato que preservar en otro lugar.
ALTER TABLE "productos" DROP COLUMN "precio";
