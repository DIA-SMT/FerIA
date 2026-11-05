-- Interés en la vidriera: cuánto miran y cuánto preguntan los vecinos.
--
-- Dos contadores agregados por día. No hay fila por evento, ni cookie, ni IP,
-- ni user agent, ni hora: la fila más detallada que llega a existir es «este
-- producto, este día, 12 consultas». Por eso esto no es un registro de
-- navegación de vecinos y no hay consentimiento que pedir.
--
-- `aperturas` es el denominador —cuántas veces se abrió la vidriera— y las
-- `consultas` por producto son el numerador. No hay página por producto, así
-- que el clic en «Consultar por este producto» es lo único que distingue un
-- producto de otro dentro de un mismo stand.
--
-- Ver docs/interes-en-la-vidriera.md para lo que se descartó y por qué.

-- CreateTable
CREATE TABLE "interes_stand" (
    "vendedorId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "aperturas" INTEGER NOT NULL DEFAULT 0,
    "consultas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "interes_stand_pkey" PRIMARY KEY ("vendedorId","fecha")
);

-- CreateTable
CREATE TABLE "interes_producto" (
    "productoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "consultas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "interes_producto_pkey" PRIMARY KEY ("productoId","fecha")
);

-- CreateIndex
CREATE INDEX "interes_stand_fecha_idx" ON "interes_stand"("fecha");

-- CreateIndex
CREATE INDEX "interes_producto_fecha_idx" ON "interes_producto"("fecha");

-- AddForeignKey
ALTER TABLE "interes_stand" ADD CONSTRAINT "interes_stand_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interes_producto" ADD CONSTRAINT "interes_producto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

