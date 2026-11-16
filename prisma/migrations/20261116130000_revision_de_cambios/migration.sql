-- Revisión de los cambios del stand por la administración.
--
-- Todo lo que el feriante cambia en su stand (portada, logo, nombre y rubro,
-- descripción, contacto, productos) queda en `cambios_del_stand` como
-- PENDIENTE hasta que la administración lo aprueba o lo rechaza. Mientras
-- tanto el vecino ve la última versión aprobada.
--
-- `productos.publicado` nace en true: los productos que ya existían siguen a la
-- vista. Los nuevos se crean en false y se publican al aprobarse su alta.
--
-- Sólo agrega cosas: el código anterior no las mira, así que volver atrás de
-- versión no rompe nada.

-- CreateEnum
CREATE TYPE "SeccionDelStand" AS ENUM ('PORTADA', 'LOGO', 'IDENTIDAD', 'DESCRIPCION', 'CONTACTO', 'PRODUCTO');

-- CreateEnum
CREATE TYPE "EstadoRevision" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "publicado" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "cambios_del_stand" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "seccion" "SeccionDelStand" NOT NULL,
    "productoId" TEXT,
    "datos" JSONB NOT NULL,
    "estado" "EstadoRevision" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "revisadoEn" TIMESTAMP(3),
    "revisadoPorId" UUID,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cambios_del_stand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cambios_del_stand_estado_creadoEn_idx" ON "cambios_del_stand"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "cambios_del_stand_vendedorId_idx" ON "cambios_del_stand"("vendedorId");

-- CreateIndex
CREATE INDEX "cambios_del_stand_productoId_idx" ON "cambios_del_stand"("productoId");

-- CreateIndex
CREATE INDEX "productos_publicado_idx" ON "productos"("publicado");

-- AddForeignKey
ALTER TABLE "cambios_del_stand" ADD CONSTRAINT "cambios_del_stand_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_del_stand" ADD CONSTRAINT "cambios_del_stand_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_del_stand" ADD CONSTRAINT "cambios_del_stand_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

