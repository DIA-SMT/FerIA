-- Postulaciones de feriantes a ferias.
--
-- Es la pieza que faltaba en el circuito. Hasta ahora un feriante se registraba
-- una sola vez, la Dirección lo aprobaba, y después alguien del panel le
-- asignaba un stand a mano sin que el feriante hubiera pedido nada: no había
-- forma de decir «quiero estar en la Feria de Artesanos». Con once feriantes se
-- resolvía por teléfono; con el padrón de Feria Digital adentro, no.
--
-- La postulación va contra la FERIA y no contra la edición. Lo que se decide
-- acá es «esta persona es feriante de esta feria», que es lo que el feriante ve
-- al entrar; en qué edición y en qué número de puesto se resuelve después, por
-- `stands`, que es donde están la capacidad y las fechas. Así aceptar a alguien
-- no obliga a tener resuelto el mapa de la edición.

-- CreateEnum
CREATE TYPE "EstadoPostulacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "postulaciones" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "feriaId" TEXT NOT NULL,
    "estado" "EstadoPostulacion" NOT NULL DEFAULT 'PENDIENTE',
    "mensaje" TEXT,
    "motivoRechazo" TEXT,
    "revisadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postulaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "postulaciones_estado_idx" ON "postulaciones"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "postulaciones_vendedorId_feriaId_key" ON "postulaciones"("vendedorId", "feriaId");

-- AddForeignKey
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_feriaId_fkey" FOREIGN KEY ("feriaId") REFERENCES "ferias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

