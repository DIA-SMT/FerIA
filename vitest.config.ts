import { defineConfig } from "vitest/config";

/**
 * Corredor de pruebas.
 *
 * `npm test` las corre una vez; `npm run test:ver` se queda mirando archivos.
 *
 * Qué se prueba acá: **lógica pura**. Funciones que reciben datos y devuelven
 * datos, sin base, sin red y sin React. Es donde un error no se ve hasta que ya
 * pasó —una suma de plata que arrastra un centavo, un teléfono que no existe
 * publicado como contacto, un rubro del padrón traducido a cualquier cosa— y
 * donde una prueba cuesta tres líneas.
 *
 * Lo que no se prueba acá: las pantallas, las Server Actions y las consultas.
 * Eso necesita una base y un navegador, y es otro trabajo con otro costo de
 * mantenimiento; mientras no exista, se verifica a mano antes de cada deploy.
 *
 * `tsconfigPaths` es lo que hace que `@/lib/...` resuelva igual que en la app:
 * sin eso habría que importar por rutas relativas sólo en las pruebas, y una
 * prueba que no importa lo mismo que la app no prueba lo mismo que la app.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
  },
});
