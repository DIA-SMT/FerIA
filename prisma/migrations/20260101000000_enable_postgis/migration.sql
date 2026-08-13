-- Habilita PostGIS antes de crear cualquier tabla con columnas `geometry`.
--
-- Se instala en el schema `extensions`, que es la convención de Supabase (y la
-- que usa el botón de extensiones del panel). Creamos el schema si no existe
-- para que la misma migración sirva también contra un PostgreSQL propio o
-- contra el stack local de la CLI de Supabase.
--
-- Como la extensión NO queda en `public`, todas las referencias a PostGIS
-- —el tipo `geometry` y las funciones `ST_*`— van calificadas con
-- `extensions.` a lo largo del proyecto. Así no dependemos del `search_path`
-- que fije el pool de conexiones.
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
