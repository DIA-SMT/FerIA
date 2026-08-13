import { PrismaClient } from "@prisma/client";

/**
 * Cliente de Prisma como singleton.
 *
 * En desarrollo Next.js recarga los módulos en caliente, lo que crearía una
 * conexión nueva en cada cambio hasta agotar el pool de PostgreSQL. Guardamos
 * la instancia en `globalThis` para reutilizarla.
 */
const globalParaPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
