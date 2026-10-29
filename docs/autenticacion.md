# Autenticación

Por qué FerIA no usa Supabase Auth, y cómo funciona en su lugar.

Escrito el 29/10/2026, antes de implementarlo, como diseño a revisar. Se deja
en el repositorio porque las decisiones que explica no se leen en el código:
ahí se ve *qué* hace, no por qué se descartó lo otro.

---

## Qué se reemplaza

FerIA usa sólo seis cosas de Supabase Auth:

| hoy | dónde |
|---|---|
| `getUser()` — validar el token | `middleware.ts`, `session.ts` |
| `signInWithPassword()` | `actions/auth.ts` |
| `signOut()` | `actions/auth.ts` |
| `admin.createUser()` / `deleteUser()` | registro y puente CiDiTuc |
| `admin.updateUserById()` — escribir el rol en el token | puente CiDiTuc |
| `generateLink()` + `verifyOtp()` — el puente CiDiTuc | `cidituc-feriante.ts` |

Lo que **no** cambia, y es casi todo:

- `public.usuarios` sigue siendo la fuente de verdad del rol.
- Los `id` siguen siendo los mismos UUID, así que `vendedores.usuarioId` y todas
  las relaciones quedan intactas.
- Los guardianes de `session.ts` (`requerirSesion`, `requerirAdmin`,
  `requerirVendedor`, `obtenerVendedorActual`) conservan su firma. Ninguna
  página ni Server Action se entera del cambio.
- La arquitectura de dos barreras: el middleware filtra rápido con el token, y
  la página o la acción vuelve a verificar contra la base. Se mantiene tal cual,
  porque es lo que hace que un error en la primera barrera no sea una brecha.

---

## 1. Base de datos

Una migración, dos columnas en `usuarios`:

```prisma
model Usuario {
  id     String @id @db.Uuid
  email  String @unique
  nombre String
  rol    Rol    @default(VENDEDOR)

  /// bcrypt. Nulo para quien entra sólo por CiDiTuc y nunca eligió contraseña.
  passwordHash String?

  /// Ningún token emitido antes de este instante vale. Es el botón de pánico:
  /// cambiar la contraseña, cambiar el rol o cerrar todas las sesiones mueven
  /// esta fecha y los tokens viejos dejan de servir en la siguiente petición.
  sesionesValidasDesde DateTime @default(now())
}
```

`passwordHash` es nullable a propósito: ya existen usuarios sin contraseña —los
que entran por CiDiTuc— y forzar una inventada sería peor.

---

## 2. La sesión

Una cookie `feria_sesion` con un JWT firmado HS256.

```
{ sub: "<uuid del usuario>", rol: "ADMIN" | "VENDEDOR", iat, exp }
```

- `httpOnly` — el JavaScript de la página no la puede leer.
- `secure` — sólo por HTTPS. En desarrollo sobre `http://localhost` se apaga, y
  ésa es la única excepción, explícita en el código.
- `sameSite: "lax"` — sobrevive a volver desde CiDiTuc, que es una navegación de
  nivel superior, y no viaja en peticiones de otros sitios.
- `path: "/"`, **tres días** de vida.

Se firma con `jose`, que anda tanto en Node como en el runtime Edge. Eso importa:
el middleware de Next corre en Edge por defecto, donde no se puede hablar con
Postgres.

**Renovación deslizante:** cuando el middleware ve un token pasada la mitad de
su vida, emite uno nuevo. Quien usa el sistema no se desloguea nunca; quien lo
abandona, caduca a los tres días. No hace falta refresh token.

Tres días y no siete: el panel de administración municipal aprueba feriantes y
registra pagos de canon, y se abre desde máquinas de oficina que son
compartidas. Con la renovación deslizante, para quien entra seguido se comporta
igual que una sesión eterna; lo que acorta es la ventana de una sesión olvidada
en una máquina que usa otra persona.

### Las dos barreras, explícitas

| | quién | qué verifica | con qué |
|---|---|---|---|
| Primera | `middleware.ts` | firma, vencimiento y el rol que trae el token | sólo criptografía: sin red ni base |
| Segunda | `session.ts` | que el usuario exista, su rol real, y que `iat >= sesionesValidasDesde` | consulta a Postgres |

Es la misma estructura de hoy, pero la primera barrera deja de ser una llamada
HTTP a Supabase y pasa a ser una verificación local. Más rápida, y el sitio no
depende de que un tercero conteste para dejar entrar a alguien.

**Si degradan a un ADMIN:** su token sigue diciendo ADMIN hasta que venza, así
que el middleware lo deja pasar a `/admin`. Pero `requerirAdmin()` consulta la
base, ve el rol nuevo y lo redirige. Para cortar también la primera barrera, al
cambiar un rol se mueve `sesionesValidasDesde`. Hoy pasa lo mismo: un JWT de
Supabase emitido tampoco se puede revocar antes de vencer.

---

## 3. El secreto

Una variable nueva, `SESION_SECRETO`, de 32 bytes al azar.

- Sin ella la aplicación **no arranca**. No hay valor por defecto: un secreto por
  defecto es un sistema sin autenticación.
- Si se cambia, todas las sesiones se caen. Es la forma de echar a todo el mundo
  si hiciera falta.
- Distinta en cada entorno.

---

## 4. Inicio de sesión

```
1. Buscar el usuario por email.
2. Comparar la contraseña contra passwordHash con bcrypt.
3. Si coincide: emitir el token y poner la cookie.
4. Redirigir según el rol que dice la BASE, no el token.
```

Dos detalles que no son opcionales:

- **Si el usuario no existe, igual se corre un bcrypt** contra un hash de
  descarte. Sin eso, el tiempo de respuesta delata qué correos están registrados.
- **El mensaje de error no distingue** «no existe» de «contraseña incorrecta».
  Es lo que ya hace hoy, y el comentario del código explica por qué.

---

## 5. El puente con CiDiTuc

Hoy son tres pasos: pedirle a Supabase un enlace mágico con `generateLink`,
canjearlo con `verifyOtp`, y que eso escriba las cookies.

Mañana es uno: **buscar o crear el usuario, y poner la cookie.**

El resto de `cidituc-feriante.ts` —validar el token contra
`estadisticas.smt.gob.ar`, leer el DNI, crear la ficha— no se toca. Esa parte no
tenía nada que ver con Supabase.

Esto además le saca a la Fase D una complicación que hoy tiene.

---

## 6. Mudanza de los usuarios existentes

Supabase guarda las contraseñas en `auth.users.encrypted_password`, en **bcrypt
estándar** (`$2a$10$`, 60 caracteres). Lo verifiqué sobre la base real. Las lee
cualquier librería.

Un script, con simulación por defecto como todos los demás:

```
npm run db:migrar-credenciales          # dice qué haría
npm run db:migrar-credenciales -- --si  # lo hace
```

Copia el hash a `usuarios.passwordHash` emparejando por `id`. Son 16 usuarios.
**Nadie tiene que cambiar su contraseña.**

---

## 7. Qué se borra

- `src/lib/supabase/servidor.ts`, `navegador.ts`, `middleware.ts`
- La dependencia `@supabase/ssr`
- Los usos de `auth.admin.*` en `actions/auth.ts` y `cidituc-feriante.ts`

`clienteAdmin()` **se queda**: todavía lo usa el almacenamiento en Supabase, que
es el que sigue sirviendo a Vercel.

---

## 8. Vercel durante la transición

Acá hay una diferencia con la Fase B, y conviene tenerla clara.

Con los archivos pudimos dejar las dos implementaciones conviviendo y elegir con
una variable. **Con la autenticación no vale la pena**: serían dos mecanismos de
sesión y dos middlewares a la vez, que es justo donde no se quiere complejidad.

La salida es más simple: la migración y el backfill se corren **en las dos
bases**, la de la VPS y la de Supabase. El mismo código autentica igual en los
dos lados, cada uno contra su propia base, y no hace falta ninguna bandera.

**Costo:** al desplegar, todas las sesiones abiertas se caen y hay que volver a
entrar una vez. Son 16 personas. Conviene avisar antes para que no parezca una
falla.

---

## 9. Riesgos, y qué contiene cada uno

| riesgo | qué lo contiene |
|---|---|
| Un error deja entrar a quien no debe | Se conservan las dos barreras. El middleware nunca es la única verificación. |
| Robo de cookie | `httpOnly` + `secure` + `sameSite`, con pruebas que miran esos atributos: es el tipo de cosa que alguien «limpia» sin querer. |
| Enumeración de correos | bcrypt también cuando el usuario no existe; mensaje de error único. |
| El hash se filtra en una consulta | `passwordHash` nunca entra en un `select` que no sea el del login. |
| No se puede echar a alguien | `sesionesValidasDesde` corta en la segunda barrera dentro de la misma petición. |
| El secreto se filtra o se pierde | Cambiarlo cierra todas las sesiones; no hay valor por defecto. |

---

## 10. Orden de trabajo

1. Migración de Prisma con las dos columnas.
2. Script de mudanza de credenciales, primero en simulación.
3. `src/lib/auth/` — contraseñas, token, cookie. Con pruebas.
4. Reescribir `session.ts`, `middleware.ts`, `actions/auth.ts` y el puente CiDiTuc.
5. Pruebas de los guardianes y de los atributos de la cookie.
6. Correr migración y backfill en las dos bases.
7. Desplegar en la VPS y verificar entrando de verdad con las tres cuentas.
8. Avisar que hay que volver a ingresar.

Los pasos 1 a 5 no tocan nada que esté corriendo. El 6 es el primero que
escribe, y el 7 el primero que se nota.

---

## Decisiones tomadas

- **Duración de la sesión: tres días**, con renovación deslizante.
- Este documento vive en el repositorio, no suelto: el próximo que toque la
  autenticación va a querer saber por qué está como está.

Queda una cosa por resolver, y no bloquea nada hasta el paso 7: **a quién hay
que avisarle antes del corte.** Al desplegar se caen todas las sesiones y hay
que volver a entrar una vez. Son 16 cuentas, pero una es la de administración
del municipio.
