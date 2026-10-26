-- Marketplace y padrón importado.
--
-- Dos cambios que llegan juntos porque vienen del mismo pedido:
--
-- 1. El precio vuelve a `productos`. Lo había sacado
--    `20260814000000_quitar_precio_productos` por decisión de la Dirección de
--    Ferias y Mercados: la plataforma era vidriera y no canal de venta. La
--    columna vuelve, pero **no se publica**: `PERMITIR_PRECIOS` la mantiene
--    apagada hasta que esa Dirección y Legales confirmen el cambio, porque los
--    términos publicados todavía dicen «La plataforma no publica precios».
--    Ver src/lib/marketplace.ts.
--
-- 2. `vendedores.usuarioId` pasa a ser opcional. Hasta hoy toda ficha nacía de
--    alguien registrándose. El padrón de miferiadigital.smt.gob.ar son fichas
--    del municipio que todavía nadie reclamó: existe el emprendimiento y el
--    nombre del responsable, no la cuenta. La FK pasa de CASCADE a SET NULL
--    para que dar de baja una cuenta no borre el registro municipal.
--
-- `pedidos` no tiene medio de pago, comisión ni estado de acreditación, y es a
-- propósito: el municipio transporta el pedido y no cobra. El total tampoco se
-- guarda — se calcula desde los items en src/lib/pedidos.ts, para que no haya
-- dos números que puedan contradecirse.

-- CreateEnum
CREATE TYPE "OrigenVendedor" AS ENUM ('PROPIO', 'FERIA_DIGITAL');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ModoEntrega" AS ENUM ('RETIRO_EN_FERIA', 'ACUERDA_CON_FERIANTE');

-- DropForeignKey
ALTER TABLE "vendedores" DROP CONSTRAINT "vendedores_usuarioId_fkey";

-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN     "feriaOrigen" TEXT,
ADD COLUMN     "idExterno" TEXT,
ADD COLUMN     "nombreResponsable" TEXT,
ADD COLUMN     "origen" "OrigenVendedor" NOT NULL DEFAULT 'PROPIO',
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "precio" DECIMAL(12,2),
ADD COLUMN     "stock" INTEGER;

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "compradorNombre" TEXT NOT NULL,
    "compradorWhatsapp" TEXT NOT NULL,
    "compradorEmail" TEXT,
    "notas" TEXT,
    "modoEntrega" "ModoEntrega" NOT NULL DEFAULT 'RETIRO_EN_FERIA',
    "edicionId" TEXT,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "motivoCancelacion" TEXT,
    "respondidoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_pedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" TEXT NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "items_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");

-- CreateIndex
CREATE INDEX "pedidos_vendedorId_idx" ON "pedidos"("vendedorId");

-- CreateIndex
CREATE INDEX "pedidos_estado_idx" ON "pedidos"("estado");

-- CreateIndex
CREATE INDEX "pedidos_creadoEn_idx" ON "pedidos"("creadoEn");

-- CreateIndex
CREATE INDEX "items_pedido_pedidoId_idx" ON "items_pedido"("pedidoId");

-- CreateIndex
CREATE INDEX "items_pedido_productoId_idx" ON "items_pedido"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_origen_idExterno_key" ON "vendedores"("origen", "idExterno");

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_edicionId_fkey" FOREIGN KEY ("edicionId") REFERENCES "ediciones_feria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integridad de cantidades y de plata.
--
-- Prisma no expresa CHECK, así que van a mano. Un item con cantidad 0 o precio
-- negativo no es un caso de borde teórico: es la forma más barata de que un
-- total dé cualquier cosa, y el total acá es lo que el vecino va a pagar.
ALTER TABLE "items_pedido"
  ADD CONSTRAINT "items_pedido_cantidad_positiva" CHECK ("cantidad" > 0);
ALTER TABLE "items_pedido"
  ADD CONSTRAINT "items_pedido_precio_no_negativo" CHECK ("precioUnitario" >= 0);

-- En productos el precio y el stock pueden ser NULL (sin precio cargado, sin
-- control de stock). CHECK no se evalúa contra NULL, así que esto sólo acota
-- los valores que sí están cargados.
ALTER TABLE "productos"
  ADD CONSTRAINT "productos_precio_no_negativo" CHECK ("precio" >= 0);
ALTER TABLE "productos"
  ADD CONSTRAINT "productos_stock_no_negativo" CHECK ("stock" >= 0);
