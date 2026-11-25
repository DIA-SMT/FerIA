-- El registro de las fotos de producto mejoradas con IA, para el tope diario
-- por feriante. Sólo agrega una tabla.

-- CreateTable
CREATE TABLE "fotos_mejoradas" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_mejoradas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fotos_mejoradas_vendedorId_creadoEn_idx" ON "fotos_mejoradas"("vendedorId", "creadoEn");

-- AddForeignKey
ALTER TABLE "fotos_mejoradas" ADD CONSTRAINT "fotos_mejoradas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
