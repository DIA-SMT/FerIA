-- Credenciales propias: la aplicación deja de depender de Supabase Auth.
--
-- Hasta acá la identidad vivía en `auth.users` (de Supabase) y el perfil con el
-- rol en `public.usuarios`. El rol ya era la fuente de verdad del lado de la
-- aplicación; lo único que aportaba Supabase era validar la contraseña y emitir
-- el token. Estas dos columnas traen eso adentro.
--
-- Ver docs/autenticacion.md para por qué, y por qué no se levantó un GoTrue.

-- bcrypt. Nulo para quien entra por CiDiTuc y nunca eligió una contraseña: esa
-- cuenta existe, pero no se puede ingresar a ella por formulario.
ALTER TABLE "usuarios" ADD COLUMN "passwordHash" TEXT;

-- Ningún token emitido antes de este instante vale.
--
-- Un JWT no se puede revocar antes de que venza, así que la revocación se hace
-- comparando contra esta fecha en cada verificación de sesión. Arranca en
-- `now()` para las filas que ya existen, que es lo correcto: en el momento de
-- correr esta migración ninguna sesión nuestra fue emitida todavía.
ALTER TABLE "usuarios"
  ADD COLUMN "sesionesValidasDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- El documento que CiDiTuc verifica.
--
-- Vivía en el `user_metadata` de Supabase, que con autenticación propia no
-- existe. Es el transporte entre el ingreso por CiDiTuc y la encuesta de alta,
-- que lo copia a `vendedores.dni`. Nulo para quien entra con contraseña: ahí
-- nadie verificó nada contra el padrón.
ALTER TABLE "usuarios" ADD COLUMN "documento" TEXT;
