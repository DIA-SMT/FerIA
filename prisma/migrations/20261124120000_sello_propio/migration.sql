-- «Modo Feria»: regalos y servicios con sello propio. Sólo agrega: un enum,
-- una tabla, un valor de SeccionDelStand (para que las propuestas de los
-- feriantes pasen por la revisión) y una columna opcional en cambios_del_stand.

-- CreateEnum
CREATE TYPE "ModalidadSelloPropio" AS ENUM ('PRODUCTO', 'CAJA', 'COMBO', 'FOOD_TRUCK', 'PATIO_GASTRONOMICO');

-- AlterEnum
ALTER TYPE "SeccionDelStand" ADD VALUE 'SELLO_PROPIO';

-- AlterTable
ALTER TABLE "cambios_del_stand" ADD COLUMN     "propuestaId" TEXT;

-- CreateTable
CREATE TABLE "propuestas_sello_propio" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "modalidad" "ModalidadSelloPropio" NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(1500) NOT NULL,
    "imagen" TEXT,
    "precio" INTEGER,
    "precioUnidad" VARCHAR(40),
    "minimo" VARCHAR(80),
    "capacidad" VARCHAR(120),
    "anticipacion" VARCHAR(80),
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propuestas_sello_propio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "propuestas_sello_propio_publicada_modalidad_idx" ON "propuestas_sello_propio"("publicada", "modalidad");

-- CreateIndex
CREATE INDEX "propuestas_sello_propio_vendedorId_idx" ON "propuestas_sello_propio"("vendedorId");

-- CreateIndex
CREATE INDEX "cambios_del_stand_propuestaId_idx" ON "cambios_del_stand"("propuestaId");

-- AddForeignKey
ALTER TABLE "cambios_del_stand" ADD CONSTRAINT "cambios_del_stand_propuestaId_fkey" FOREIGN KEY ("propuestaId") REFERENCES "propuestas_sello_propio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propuestas_sello_propio" ADD CONSTRAINT "propuestas_sello_propio_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

