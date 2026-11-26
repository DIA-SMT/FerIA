-- Los borradores de productos: los ve sólo el feriante y se borran solos a
-- los 7 días sin cambios. Sólo agrega una columna (todos los productos que ya
-- existen quedan en false) y un índice para encontrar los vencidos.

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "borrador" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "productos_borrador_actualizadoEn_idx" ON "productos"("borrador", "actualizadoEn");

