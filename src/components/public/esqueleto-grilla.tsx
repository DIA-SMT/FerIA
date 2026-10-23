/**
 * Esqueleto de carga de los listados del market, con la misma grilla que las
 * páginas reales.
 *
 * Vivía en `(public)/loading.tsx`, o sea colgado de TODAS las páginas públicas.
 * Eso envolvía también las fichas de feria y de stand en un límite de
 * streaming, y hacía que `/stands/no-existe` respondiera HTTP 200 con la
 * pantalla de «no encontramos esta página»: el status ya había salido cuando
 * corría `notFound()`. Google indexaba URLs muertas como páginas válidas.
 *
 * Ahora es un componente común, y lo usan con `<Suspense>` las dos páginas de
 * listado —que nunca llaman a `notFound()`—. Las fichas quedan sin límite por
 * encima, así que su 404 sale con su código.
 */
export function EsqueletoGrilla() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="sr-only" role="status">
        Cargando contenido…
      </span>

      <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-lg bg-slate-100" />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, indice) => (
          <div
            key={indice}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="aspect-[16/10] w-full animate-pulse bg-slate-200" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
