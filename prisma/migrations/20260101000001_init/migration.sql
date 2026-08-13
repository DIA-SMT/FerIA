-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "EstadoVendedor" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoEdicion" AS ENUM ('BORRADOR', 'PUBLICADA', 'EN_CURSO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'OTRO');

-- CreateEnum
CREATE TYPE "CategoriaFeria" AS ENUM ('ARTESANIAS', 'EMPRENDEDORES', 'GASTRONOMIA', 'PRODUCTOS_REGIONALES', 'LIBROS_Y_ARTE', 'MIXTA');

-- CreateEnum
CREATE TYPE "Rubro" AS ENUM ('ARTESANIAS', 'GASTRONOMIA', 'INDUMENTARIA', 'MARROQUINERIA', 'JOYERIA_Y_BIJOUTERIE', 'DECORACION', 'COSMETICA_NATURAL', 'LIBROS_Y_ARTE', 'PRODUCTOS_REGIONALES', 'HUERTA_Y_VIVERO', 'JUGUETES', 'OTROS');

-- CreateTable
-- `id` es el mismo UUID que `auth.users.id`. No se declara clave foránea
-- contra el schema `auth` para no atar las migraciones de Prisma a tablas que
-- administra Supabase; la sincronía la garantizan el registro público
-- (src/actions/auth.ts) y el seed, que crean siempre ambos registros juntos.
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'VENDEDOR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendedores" (
    "id" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "emprendimiento" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "rubro" "Rubro" NOT NULL,
    "descripcion" TEXT,
    "telefono" TEXT,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "sitioWeb" TEXT,
    "imagenPortada" TEXT,
    "logo" TEXT,
    "dni" TEXT,
    "direccion" TEXT,
    "estado" "EstadoVendedor" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "revisadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ferias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" "CategoriaFeria" NOT NULL,
    "direccion" TEXT NOT NULL,
    "ubicacion" extensions.geometry(Point, 4326),
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "imagen" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ferias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ediciones_feria" (
    "id" TEXT NOT NULL,
    "feriaId" TEXT NOT NULL,
    "nombre" TEXT,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "horario" TEXT NOT NULL,
    "estado" "EstadoEdicion" NOT NULL DEFAULT 'BORRADOR',
    "cantidadStands" INTEGER NOT NULL DEFAULT 0,
    "montoCanon" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vencimientoCanon" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ediciones_feria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stands" (
    "id" TEXT NOT NULL,
    "edicionId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "notas" TEXT,
    "vendedorId" TEXT,
    "asignadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL,
    "imagenes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_canon" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "edicionId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fechaPago" DATE,
    "medio" "MedioPago",
    "comprobante" TEXT,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_canon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_usuarioId_key" ON "vendedores"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_slug_key" ON "vendedores"("slug");

-- CreateIndex
CREATE INDEX "vendedores_estado_idx" ON "vendedores"("estado");

-- CreateIndex
CREATE INDEX "vendedores_rubro_idx" ON "vendedores"("rubro");

-- CreateIndex
CREATE UNIQUE INDEX "ferias_slug_key" ON "ferias"("slug");

-- CreateIndex
CREATE INDEX "ferias_categoria_idx" ON "ferias"("categoria");

-- CreateIndex
CREATE INDEX "ferias_activa_idx" ON "ferias"("activa");

-- CreateIndex
CREATE INDEX "ediciones_feria_feriaId_idx" ON "ediciones_feria"("feriaId");

-- CreateIndex
CREATE INDEX "ediciones_feria_estado_idx" ON "ediciones_feria"("estado");

-- CreateIndex
CREATE INDEX "ediciones_feria_fechaInicio_idx" ON "ediciones_feria"("fechaInicio");

-- CreateIndex
CREATE INDEX "stands_vendedorId_idx" ON "stands"("vendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "stands_edicionId_numero_key" ON "stands"("edicionId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "stands_edicionId_vendedorId_key" ON "stands"("edicionId", "vendedorId");

-- CreateIndex
CREATE INDEX "productos_vendedorId_idx" ON "productos"("vendedorId");

-- CreateIndex
CREATE INDEX "productos_disponible_idx" ON "productos"("disponible");

-- CreateIndex
CREATE INDEX "pagos_canon_vendedorId_idx" ON "pagos_canon"("vendedorId");

-- CreateIndex
CREATE INDEX "pagos_canon_edicionId_idx" ON "pagos_canon"("edicionId");

-- CreateIndex
CREATE INDEX "pagos_canon_estado_idx" ON "pagos_canon"("estado");

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ediciones_feria" ADD CONSTRAINT "ediciones_feria_feriaId_fkey" FOREIGN KEY ("feriaId") REFERENCES "ferias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stands" ADD CONSTRAINT "stands_edicionId_fkey" FOREIGN KEY ("edicionId") REFERENCES "ediciones_feria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stands" ADD CONSTRAINT "stands_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_canon" ADD CONSTRAINT "pagos_canon_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_canon" ADD CONSTRAINT "pagos_canon_edicionId_fkey" FOREIGN KEY ("edicionId") REFERENCES "ediciones_feria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índice espacial GIST para consultas de proximidad a futuro (mapa interactivo).
CREATE INDEX "ferias_ubicacion_idx" ON "ferias" USING GIST ("ubicacion");

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Supabase publica automáticamente todo el schema `public` a través de
-- PostgREST, accesible con la anon key (que es pública por diseño). Estas
-- tablas NO deben ser accesibles por esa vía: la aplicación entra por Prisma
-- con la cadena de conexión directa.
--
-- Habilitamos RLS sin definir ninguna política: eso deniega todo a los roles
-- `anon` y `authenticated`. Prisma se conecta como dueño de las tablas, y el
-- dueño no está sujeto a RLS mientras no se use FORCE ROW LEVEL SECURITY.
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendedores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ferias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ediciones_feria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "productos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagos_canon" ENABLE ROW LEVEL SECURITY;
