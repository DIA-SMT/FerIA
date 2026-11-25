-- El registro de las imágenes publicitarias generadas con IA, para el tope
-- por feriante. Sólo agrega una tabla.

-- CreateTable
CREATE TABLE "publicidades_generadas" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicidades_generadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publicidades_generadas_vendedorId_creadoEn_idx" ON "publicidades_generadas"("vendedorId", "creadoEn");

-- AddForeignKey
ALTER TABLE "publicidades_generadas" ADD CONSTRAINT "publicidades_generadas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

