-- DropIndex
DROP INDEX "ferias_ubicacion_idx";

-- CreateTable
CREATE TABLE "consultas_asistente" (
    "id" TEXT NOT NULL,
    "pregunta" VARCHAR(500) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_asistente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultas_asistente_creadoEn_idx" ON "consultas_asistente"("creadoEn");
