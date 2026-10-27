-- El feriante puede bajarse de una feria presencial por su cuenta.
--
-- Valor nuevo y no reutilizar RECHAZADA: rechazada es una decisión de la
-- Dirección y lleva motivo, retirada es del feriante. Mezclarlas borraría quién
-- tomó la decisión, que es justo lo que la Dirección necesita saber cuando ve
-- que un puesto asignado quedó sin dueño.
ALTER TYPE "EstadoPostulacion" ADD VALUE IF NOT EXISTS 'RETIRADA';
