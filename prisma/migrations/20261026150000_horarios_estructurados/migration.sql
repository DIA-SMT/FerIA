-- Días y horas de apertura, estructurados.
--
-- La portada necesita imprimir «Sáb · 8:00 a 14:00» en la tarjeta de cada
-- feria de la semana, y eso no sale de `horario`, que es una frase en prosa
-- ("Sábados y domingos de 17 a 23 h"): no hay forma de leerla sin adivinarla.
--
-- Las horas van como VARCHAR(5) "HH:MM" y no como TIME. Es exactamente lo que
-- produce y consume un <input type="time">, así que no hay conversión en
-- ninguno de los dos sentidos, ordena bien alfabéticamente, y sobre todo no
-- arrastra zona horaria: una feria abre a las ocho de la mañana de Tucumán, no
-- en un instante absoluto. Este proyecto ya pagó una vez por confundir las dos
-- cosas.
--
-- `horario` NO se elimina y pasa a opcional. Queda como la aclaración que no
-- entra en días y horas («se suspende por lluvia»), y además es el respaldo:
-- mientras una edición no tenga los campos nuevos cargados, la pantalla sigue
-- mostrando su texto. Así la Dirección completa de a poco en vez de tener que
-- recargar de golpe las ediciones que ya existen.

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- AlterTable
ALTER TABLE "ediciones_feria" ADD COLUMN     "diasSemana" "DiaSemana"[] DEFAULT ARRAY[]::"DiaSemana"[],
ADD COLUMN     "horaApertura" VARCHAR(5),
ADD COLUMN     "horaCierre" VARCHAR(5),
ALTER COLUMN "horario" DROP NOT NULL;


-- Formato de hora, validado también en la base.
--
-- El formulario ya lo valida, pero el seed, la importación y cualquier UPDATE
-- a mano no pasan por ahí. Un "8" o un "08:00:00" guardado acá se rompería
-- recién al pintar la tarjeta, que es el peor lugar para enterarse.
ALTER TABLE "ediciones_feria"
  ADD CONSTRAINT "ediciones_hora_apertura_formato"
  CHECK ("horaApertura" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "ediciones_feria"
  ADD CONSTRAINT "ediciones_hora_cierre_formato"
  CHECK ("horaCierre" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
