-- CreateTable
CREATE TABLE "consultas_admin" (
    "id" TEXT NOT NULL,
    "usuarioId" UUID,
    "pregunta" VARCHAR(500) NOT NULL,
    "herramientas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fallo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultas_admin_creadoEn_idx" ON "consultas_admin"("creadoEn");

-- CreateIndex
CREATE INDEX "consultas_admin_usuarioId_idx" ON "consultas_admin"("usuarioId");

-- AddForeignKey
ALTER TABLE "consultas_admin" ADD CONSTRAINT "consultas_admin_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

