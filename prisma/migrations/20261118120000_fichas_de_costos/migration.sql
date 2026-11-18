-- CreateTable
CREATE TABLE "fichas_de_costos" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" VARCHAR(120) NOT NULL,
    "datos" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fichas_de_costos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fichas_de_costos_vendedorId_idx" ON "fichas_de_costos"("vendedorId");

-- CreateIndex
CREATE INDEX "fichas_de_costos_productoId_idx" ON "fichas_de_costos"("productoId");

-- AddForeignKey
ALTER TABLE "fichas_de_costos" ADD CONSTRAINT "fichas_de_costos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_de_costos" ADD CONSTRAINT "fichas_de_costos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

