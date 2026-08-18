# Ferias Municipales — San Miguel de Tucumán

Plataforma de gestión de ferias municipales y sus stands, con un market público
donde cada feriante tiene su vidriera online.

Desarrollada para la **Dirección de Ferias y Mercados** de la Municipalidad de
San Miguel de Tucumán.

---

## Índice

1. [Qué hace la plataforma](#qué-hace-la-plataforma)
2. [Stack](#stack)
3. [Puesta en marcha](#puesta-en-marcha)
4. [Usuarios de ejemplo](#usuarios-de-ejemplo)
5. [Comandos disponibles](#comandos-disponibles)
6. [Estructura del proyecto](#estructura-del-proyecto)
7. [Modelo de datos](#modelo-de-datos)
8. [Decisiones de diseño](#decisiones-de-diseño)
9. [Identidad visual](#identidad-visual)
10. [Despliegue a producción](#despliegue-a-producción)
11. [Problemas frecuentes](#problemas-frecuentes)

---

## Qué hace la plataforma

Tres áreas bien separadas, con acceso por rol:

### Market público — `/` (sin login)

La cara visible para los vecinos.

- **Inicio**: hero institucional, ferias en curso y próximas, stands destacados.
- **Ferias** (`/ferias`): listado filtrable por categoría.
- **Detalle de feria** (`/ferias/[slug]`): descripción, fechas de cada edición,
  ubicación con enlace a Google Maps y los feriantes que participan.
- **Directorio de stands** (`/stands`): todos los feriantes aprobados, con
  búsqueda por nombre o producto y filtros por rubro y por feria.
- **Vidriera del feriante** (`/stands/[slug]`): portada, descripción, catálogo
  y **botón de contacto por WhatsApp** con el mensaje ya escrito.

> No hay carrito ni pagos online, y **el catálogo no publica precios**: el
> modelo es vidriera + contacto directo entre el vecino y quien produce. El
> precio se acuerda por WhatsApp.

### Panel municipal — `/admin` (rol `ADMIN`)

- **Estadísticas**: stands ocupados vs. libres por edición, feriantes por rubro,
  recaudación de canon por edición y acumulada, solicitudes pendientes y alertas
  de morosidad.
- **Ferias y ediciones**: ABM completo. Cada edición define fechas, horario,
  estado (borrador / publicada / en curso / finalizada), cantidad de stands y
  canon.
- **Grilla de stands**: vista de un vistazo con ocupados y libres; se toca un
  stand y se le asigna o libera un feriante.
- **Solicitudes**: bandeja de registros pendientes con los datos del
  emprendimiento; se aprueban o se rechazan con motivo (el feriante lo ve en su
  panel). Sólo los aprobados aparecen en el market y pueden ocupar stands.
- **Feriantes**: listado completo filtrable por estado.
- **Canon y permisos**: registro de pagos por feriante y edición, con estado del
  permiso (al día / pendiente / vencido), comprobantes y alertas visuales de
  morosidad.

### Panel del feriante — `/mi-stand` (rol `VENDEDOR`)

- **Registro público** (`/registro`) con los datos del emprendimiento. Queda
  pendiente de aprobación y el feriante ve claramente ese estado al ingresar.
- Una vez aprobado: edición de su **vidriera** (nombre, descripción, portada,
  logo, contacto y redes) y de su **catálogo de productos** (nombre,
  descripción, hasta 4 fotos, disponible sí/no).
- **Sus ferias**: a qué ediciones y stands fue asignado.
- **Canon**: estado de sus pagos, en sólo lectura.

---

## Stack

| Pieza          | Tecnología                                          |
| -------------- | --------------------------------------------------- |
| Framework      | Next.js 15 (App Router) + React 19                  |
| Lenguaje       | TypeScript en modo estricto                         |
| Estilos        | Tailwind CSS v4 (tokens en `src/app/globals.css`)   |
| Base de datos  | Supabase (PostgreSQL 17 + PostGIS)                  |
| ORM            | Prisma 6 (con migraciones y seed)                   |
| Autenticación  | Supabase Auth (email + contraseña) con roles        |
| Archivos       | Supabase Storage                                    |
| Validación     | Zod                                                 |
| IA             | Cliente de OpenRouter configurado, **sin uso aún**  |

Sin librerías de gráficos ni de íconos: ambos están hechos con SVG propio para
no sumar peso al bundle y respetar exactamente la paleta institucional.

---

## Puesta en marcha

### Requisitos

- **Node.js 20 o superior** (probado con 24.19 LTS).
- Una cuenta en [supabase.com](https://supabase.com) (el plan gratuito alcanza
  de sobra para desarrollo).

### 1. Crear el proyecto de Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) y creá un
   proyecto nuevo.
2. Elegí la región **South America (São Paulo)**: es la más cercana a Tucumán y
   se nota en la latencia.
3. **Guardá la contraseña de la base** que te muestra al crearlo. Se ve una sola
   vez; si la perdés, se puede regenerar desde *Project Settings → Database*.

### 2. Instalar dependencias

```bash
npm install
```

> npm 11 bloquea por defecto los scripts de instalación. Los paquetes que sí los
> necesitan (Prisma, esbuild, sharp) ya están autorizados en el campo
> `allowScripts` de `package.json`, así que no hace falta hacer nada extra.

### 3. Configurar las variables de entorno

```bash
cp .env.example .env
```

Necesitás cinco valores del panel de Supabase:

| Variable                        | Dónde sale                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | *Project Settings → Database → Connection string* → pestaña **Transaction pooler** (puerto **6543**)            |
| `DIRECT_URL`                    | La misma pantalla → pestaña **Session pooler** (puerto **5432**)                                                |
| `NEXT_PUBLIC_SUPABASE_URL`      | *Project Settings → API* → **Project URL**                                                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *Project Settings → API* → clave **anon / publishable**                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | *Project Settings → API* → clave **service_role / secret**                                                     |

En las dos cadenas de conexión reemplazá `[YOUR-PASSWORD]` por la contraseña del
paso 1. A `DATABASE_URL` dejale los parámetros `?pgbouncer=true&connection_limit=1`
que ya trae el `.env.example`: el pooler de transacciones no soporta *prepared
statements* y así se lo avisamos a Prisma.

> ⚠️ La `service_role` key da acceso total a la base y a la administración de
> usuarios, salteándose RLS. Nunca la pongas en una variable `NEXT_PUBLIC_*` ni
> la subas al repositorio. El `.env` ya está en el `.gitignore`.

### 4. Aplicar las migraciones

```bash
npm run db:deploy
```

Esto crea la extensión PostGIS (en el schema `extensions`), todas las tablas,
los índices —incluido el GIST espacial— y habilita RLS.

### 5. Cargar los datos de ejemplo

```bash
npm run db:seed
```

El seed hace cuatro cosas: crea los buckets de Storage, crea los usuarios en
Supabase Auth con su rol, genera y sube las imágenes de ejemplo, y carga los
datos. Son cinco ferias en puntos reales
de la ciudad (Parque 9 de Julio, Plaza Urquiza, Parque Avellaneda, Plaza
Independencia y Plaza Alberdi), con ediciones pasadas, en curso y próximas,
catorce feriantes en distintos estados de aprobación, sus catálogos y pagos de
canon —algunos al día y otros vencidos, para poder ver las alertas de morosidad
funcionando.

> El seed **borra todo** antes de cargar, incluidos los usuarios de Auth con
> esos correos. No lo corras contra producción.

### 6. Levantar la aplicación

```bash
npm run dev
```

Abrí <http://localhost:3000>.

<details>
<summary>Desarrollo totalmente local (opcional)</summary>

Si preferís no depender del proyecto en la nube, la CLI de Supabase levanta el
stack completo —PostgreSQL, Auth, Storage y Studio— en tu máquina. Requiere
Docker:

```bash
npx supabase init && npx supabase start
```

El comando imprime la URL de la API y las claves locales; poné esos valores en
el `.env` y seguí desde el paso 4.

</details>

---

## Usuarios de ejemplo

Los crea el seed en Supabase Auth. Cambiá estas contraseñas antes de cualquier
despliegue real.

| Rol                | Correo                        | Contraseña       |
| ------------------ | ----------------------------- | ---------------- |
| Personal municipal | `admin@smt.gob.ar`            | `Ferias.2026`    |
| Feriante aprobado  | `tejidosdelcerro@example.com` | `Feriante.2026`  |
| Feriante pendiente | `telarandino@example.com`     | `Feriante.2026`  |
| Feriante rechazado | `importadoslh@example.com`    | `Feriante.2026`  |

Todos los feriantes del seed usan la misma contraseña. Los correos están en
`prisma/seed.ts`.

### Accesos rápidos en el login

`/ingresar` puede mostrar un panel con estas cuatro cuentas: un click completa
el formulario y entra, para no tipear credenciales cada vez que se prueba otro
rol. Aparece **siempre en desarrollo**, y en un deploy sólo declarando
`ACCESOS_DEMO=true`.

> ⚠️ Prenderlo en una URL pública significa que cualquiera que la encuentre
> entra como ADMIN con un click y puede aprobar feriantes, borrar ferias o
> registrar pagos. Sirve para una demo; hay que apagarlo antes de que el sitio
> sea real.

**Las credenciales viven sólo en el servidor**, en `src/lib/accesos-demo.ts`.
`cuentasDemo()` decide si el panel corresponde y devuelve la lista o un arreglo
vacío; `src/components/auth/accesos-demo.tsx` sólo presenta lo que recibe. Con
el flag apagado no se manda nada y las credenciales no existen en el bundle del
navegador. Comprobable buscándolas en `.next/static` después de un
`npm run build`.

Dos detalles de esa separación, que no son casuales:

- **El flag no lleva el prefijo `NEXT_PUBLIC_`.** Así lo lee únicamente el
  servidor, en tiempo de ejecución: prenderlo o apagarlo no necesita recompilar.
- **La decisión no puede vivir en el componente de cliente.** La primera versión
  lo hacía, confiando en que el minificador eliminara el bloque al compilar.
  No es confiable: con la variable vacía, Next no la reemplaza por una constante,
  no se elimina nada y las credenciales terminan en el bundle igual. Una
  propiedad de seguridad no se apoya en la eliminación de código muerto.

---

## Comandos disponibles

| Comando              | Qué hace                                                     |
| -------------------- | ------------------------------------------------------------ |
| `npm run dev`        | Servidor de desarrollo.                                      |
| `npm run build`      | Genera el cliente de Prisma y compila para producción.       |
| `npm run start`      | Sirve el build de producción.                                |
| `npm run typecheck`  | Verifica los tipos sin compilar.                             |
| `npm run lint`       | ESLint.                                                      |
| `npm run db:deploy`  | **Aplica las migraciones.** Es el comando a usar con Supabase. |
| `npm run db:migrate` | Crea una migración nueva a partir de cambios en el schema.    |
| `npm run db:seed`    | Buckets + usuarios + datos de ejemplo (borra todo antes).     |
| `npm run db:studio`  | Prisma Studio, para inspeccionar la base.                    |

> `db:migrate` (`prisma migrate dev`) necesita crear una *shadow database* para
> calcular el diff. Contra Supabase eso a veces falla por permisos: si te pasa,
> escribí el archivo SQL a mano en `prisma/migrations/` y aplicalo con
> `db:deploy`, que es lo que hacen las dos migraciones actuales.

---

## Estructura del proyecto

```
ferias-smt/
├─ prisma/
│  ├─ schema.prisma            Modelo de datos
│  ├─ migrations/
│  │  ├─ …_enable_postgis/     CREATE EXTENSION postgis en `extensions`
│  │  ├─ …_init/               Tablas, índices, GIST espacial y RLS
│  │  └─ …_quitar_precio_…/    DROP de `productos.precio`
│  ├─ seed.ts                  Buckets + usuarios + datos de ejemplo
│  └─ imagenes-seed.ts         Imágenes geométricas por rubro para el seed
├─ public/logo.png             Isologo municipal
└─ src/
   ├─ app/
   │  ├─ icon.png              Favicon (lo sirve Next automáticamente)
   │  ├─ apple-icon.png        Ícono para iOS
   │  ├─ layout.tsx            Layout raíz, tipografía y metadatos
   │  ├─ globals.css           Tokens de Tailwind v4 y utilidades
   │  ├─ (public)/             MARKET PÚBLICO
   │  ├─ (auth)/               Ingreso y registro
   │  ├─ admin/                PANEL MUNICIPAL
   │  ├─ mi-stand/             PANEL DEL FERIANTE
   │  └─ api/comprobantes/     Entrega de comprobantes con URL firmada
   ├─ actions/                 Server Actions (todas las mutaciones)
   ├─ components/
   │  ├─ ui/                   Sistema de diseño (botones, campos, tablas…)
   │  ├─ public/               Componentes del market
   │  ├─ admin/                Componentes del panel municipal
   │  ├─ auth/                 Formularios de ingreso y registro
   │  └─ vendedor/             Componentes del panel del feriante
   ├─ lib/
   │  ├─ supabase/
   │  │   ├─ servidor.ts       Cliente para Server Components y Actions
   │  │   ├─ navegador.ts      Cliente para el navegador
   │  │   ├─ admin.ts          Cliente service role (sólo servidor)
   │  │   ├─ middleware.ts     Refresco de sesión en el Edge
   │  │   └─ config.ts         Lectura de variables de entorno
   │  ├─ db.ts                 Cliente de Prisma (singleton)
   │  ├─ session.ts            Helpers de sesión y rol
   │  ├─ storage.ts            Subida y borrado en Supabase Storage
   │  ├─ media.ts              Resolución de URLs (seguro en cliente)
   │  ├─ ai.ts                 Cliente de OpenRouter (sin uso)
   │  ├─ geo.ts                Utilidades PostGIS y Google Maps
   │  ├─ canon.ts              Cálculo del estado del permiso
   │  ├─ consultas.ts          Consultas compartidas
   │  ├─ estadisticas.ts       Métricas del dashboard
   │  ├─ validations/          Esquemas Zod
   │  └─ …                     format, labels, slug, whatsapp, redes, cn
   └─ middleware.ts            Refresco de sesión y protección por rol
```

---

## Modelo de datos

```
auth.users  (Supabase Auth — credenciales)
     │ mismo UUID
     ▼
  Usuario ──1:1── Vendedor ──1:N── Producto
                     │  │
                     │  └──1:N── PagoCanon ──N:1── EdicionFeria
                     │                                  │
                     └──────1:N── Stand ────────N:1─────┘
                                                        │
                                               Feria ──1:N
```

| Modelo         | Para qué                                                     |
| -------------- | ------------------------------------------------------------ |
| `Usuario`      | Perfil de la aplicación. `id` = `auth.users.id`. Guarda nombre y rol. |
| `Vendedor`     | Perfil del feriante y su vidriera. Estado de aprobación.     |
| `Feria`        | Feria itinerante, con ubicación PostGIS.                     |
| `EdicionFeria` | Fechas concretas, estado, cantidad de stands y canon.        |
| `Stand`        | Un lugar numerado dentro de una edición, con feriante o sin él. |
| `Producto`     | Ítem del catálogo del feriante.                              |
| `PagoCanon`    | Pago de canon de un feriante para una edición.               |

Restricciones que vale la pena conocer:

- `@@unique([edicionId, numero])` — no se repite el número de stand dentro de
  una edición.
- `@@unique([edicionId, vendedorId])` — un feriante ocupa como máximo un stand
  por edición. PostgreSQL permite varios `NULL` en un índice único, así que los
  stands libres no chocan entre sí.
- Al eliminar una feria caen en cascada sus ediciones, stands y pagos.
- Al rechazar a un feriante se liberan automáticamente los stands que ocupaba.

---

## Decisiones de diseño

### Autenticación: Supabase Auth con el rol en dos lugares

Las credenciales las administra Supabase en `auth.users`; el perfil de la
aplicación vive en `public.usuarios` con el mismo UUID como clave primaria.

El **rol está duplicado a propósito**:

- En `public.usuarios.rol` — es la **fuente de verdad**. Lo consultan las
  páginas y las Server Actions a través de `src/lib/session.ts`.
- En `app_metadata` del JWT — lo lee el middleware, que corre en el Edge y no
  puede usar Prisma. `app_metadata` sólo se puede escribir con la service role
  key, así que un usuario no puede ascenderse a sí mismo.

Si alguna vez divergen gana la base: el middleware es la primera barrera, no la
última. Un feriante que llegue a `/admin` pasando el middleware queda igual
frenado por `requerirAdmin()`.

El registro público usa `auth.admin.createUser` con `email_confirm: true`, es
decir **sin verificación por correo**. Es deliberado: la verificación real la
hace la Dirección de Ferias al aprobar la solicitud, y así el proyecto arranca
sin configurar un SMTP. Para activarla, configurá el SMTP en *Authentication →
Emails* y cambiá esa llamada por `supabase.auth.signUp`.

### RLS: habilitado y sin políticas

Supabase publica automáticamente todo el schema `public` por PostgREST, y la
anon key es pública por diseño. Si estas tablas no tuvieran RLS, cualquiera con
esa clave podría leerlas y escribirlas.

La migración habilita RLS en las siete tablas **sin definir ninguna política**,
lo que deniega todo a `anon` y `authenticated`. La aplicación no se ve afectada
porque entra por Prisma con la cadena de conexión directa, como dueña de las
tablas, y el dueño no está sujeto a RLS.

### Storage: rutas en la base, URLs armadas al vuelo

En la base se guarda la ruta del objeto con su bucket adelante
(`vendedores/8f3a….webp`), nunca la URL completa: así cambiar de proyecto de
Supabase no obliga a migrar datos.

- `src/lib/media.ts` arma las URL. Sólo usa `NEXT_PUBLIC_SUPABASE_URL`, así que
  puede importarse desde componentes de cliente.
- `src/lib/storage.ts` sube y borra archivos. Usa la service role key, así que
  es exclusivo del servidor.

Buckets: `ferias`, `vendedores` y `productos` son **públicos**;
`comprobantes` es **privado**. Los comprobantes de canon son documentación
administrativa, así que se sirven por `/api/comprobantes`, que verifica la
sesión —el personal municipal ve todos, cada feriante sólo los suyos— y recién
entonces genera una URL firmada de un minuto.

### La ubicación PostGIS

`Feria.ubicacion` es una columna `geometry(Point, 4326)` declarada en Prisma
como `Unsupported(...)`. Prisma **no puede leer ni escribir** ese tipo de
columnas, así que:

- La geometría es la fuente de verdad y se escribe por SQL crudo desde
  `src/lib/geo.ts` (`guardarUbicacion`).
- Las columnas `latitud` / `longitud` son un **espejo legible** desde Prisma. Se
  escriben en la misma sentencia `UPDATE` que la geometría, de modo que no
  pueden quedar desincronizadas.
- En Supabase PostGIS vive en el schema `extensions`, no en `public`. Por eso
  todas las referencias van calificadas (`extensions.ST_MakePoint`, …): así no
  dependemos del `search_path` que fije el pool de conexiones.
- Hoy la ubicación sólo se muestra como enlace a Google Maps. La migración ya
  crea un índice GIST y `src/lib/geo.ts` incluye `feriasCercanas()`, así que el
  mapa interactivo y las búsquedas por proximidad se pueden sumar sin tocar el
  esquema.

### El estado del permiso no se guarda: se deriva

`PagoCanon` tiene su propio estado (`PENDIENTE` / `PAGADO` / `ANULADO`), pero el
**estado del permiso** (al día / pendiente / vencido) se calcula en
`src/lib/canon.ts` comparando lo efectivamente abonado contra el canon de la
edición y su fecha de vencimiento. Así no puede quedar desactualizado y se
admiten pagos parciales sin lógica extra.

### Las imágenes del seed son generadas, no fotos

No podemos garantizar derechos de uso de fotos reales para un sitio municipal, y
dejar todo con el placeholder del degradé hacía ver el market más plano de lo
que se ve en producción. `prisma/imagenes-seed.ts` genera imágenes geométricas
—nada representacional, sin problema de licencia— y las sube a Storage.

- **Un motivo por rubro**: telar para artesanías, círculos concéntricos para
  gastronomía, cerros para productos regionales, y así con los doce. Se
  distinguen de un vistazo en la grilla del directorio.
- **Sólo la paleta institucional**, con el amarillo como realce puntual.
- **Determinista**: las variaciones salen de un hash del slug, no de
  `Math.random()`. Dos corridas del seed producen las mismas imágenes.
- **Nombres de objeto derivados del slug** y subida con `upsert`, así reejecutar
  el seed sobreescribe en lugar de acumular huérfanos en el bucket.
- Se rasteriza a WebP con `sharp` (que ya viene con Next.js). El set completo
  pesa unos 550 KB.

Cuatro feriantes quedan **a propósito sin imágenes** —los no aprobados y uno
aprobado— para que los placeholders y el avatar de iniciales sigan visibles en
la demo.

### OpenRouter

`src/lib/ai.ts` deja el cliente configurado y listo, pero **ninguna parte de la
aplicación lo usa todavía**. Se construye de forma perezosa, así que la app
arranca sin problemas con `OPENROUTER_API_KEY` vacía.

---

## Identidad visual

Los tres colores salen del isologo municipal y están definidos como tokens de
Tailwind en `src/app/globals.css`:

| Token          | Color     | Uso                                                |
| -------------- | --------- | -------------------------------------------------- |
| `municipal-500`| `#0567F2` | Primario: botones, enlaces, navegación, énfasis.   |
| `celeste-400`  | `#33ADFF` | Secundario: fondos claros, badges, degradés.       |
| `acento-400`   | `#F5D90A` | Acento puntual: destacados e indicadores.          |
| `slate-*`      | —         | Fondos, bordes y texto.                            |

Cada color tiene su escala completa de 50 a 950 (`bg-municipal-50`,
`text-celeste-900`, etc.).

**Contraste verificado (WCAG AA):**

- Blanco sobre `municipal-500` → 4.9:1 ✔
- `slate-900` sobre `acento-400` → 12.1:1 ✔
- Blanco sobre `celeste-400` → 2.4:1 ✘ — por eso el celeste **nunca** lleva
  texto blanco: se usa como fondo claro (`celeste-50`/`100`) con texto oscuro,
  en bordes, hovers y degradés.

Tipografía: **Inter** vía `next/font/google`, por su legibilidad en pantallas
chicas — la mayoría de los vecinos entra desde el celular.

### Las fotos del área pública

Son dos, las dos **imágenes generadas**, y cada una lleva su velo porque el
texto blanco va encima:

| Archivo | Dónde | Velo |
| ------- | ----- | ---- |
| `hero-feria-nocturna.webp` | Hero de inicio | Horizontal: denso a la izquierda, se abre a la derecha |
| `ferias-encabezado-dia.webp` | Encabezado de `/ferias` | Vertical: denso abajo, se abre hacia arriba |

Los velos van en sentidos distintos a propósito. La nocturna es oscura y el
texto ocupa la mitad izquierda, así que conviene oscurecer ese lado y dejar ver
los puestos del otro. La diurna es luminosa y lo que la hace linda es la luz
entre los árboles, así que se oscurece sólo el pie, donde va el título.

En las dos, **abajo de `lg` el velo es parejo**: en pantallas chicas el texto
ocupa casi todo el ancho y todo el alto de la banda, y un degradé dejaría
palabras sobre las zonas claras de la foto.

Contraste medido sobre la imagen ya compuesta con el velo, en el peor píxel de
la zona de texto (AAA pide 7:1):

| | 1440 px | 1024 px | 375 px |
| --- | --- | --- | --- |
| Hero de inicio | 13,4:1 | 8,6:1 | 10,4:1 |
| Encabezado de `/ferias` | 9,1:1 | 8,8:1 | 10,5:1 |

#### El recorte de la nocturna

`public/hero-feria-nocturna.webp` está recortada del original, y **el recorte no
es estético: es necesario.** El cuadro completo tiene, en su tercio izquierdo, un
puesto de carteles de madera cuyo texto salió mal generado ("BRHUONDAR" donde
debería decir Bienvenidos, y varios que son garabatos imitando letras). A tamaño
hero se lee. La imagen del repositorio arranca pasada esa zona; si alguna vez se
reemplaza por el original completo, el problema vuelve.

La diurna no necesitó recorte por ese motivo: se revisó cuadro por cuadro y no
tiene texto mal generado. Sólo está acotada a una banda ancha para no cargar
píxeles que el encabezado nunca muestra.

El área pública es más cálida y visual (fotos, tarjetas, degradés); el panel
municipal es más denso y funcional (tablas, filtros, barra lateral).

---

## Despliegue a producción

Checklist mínimo:

1. **Proyecto de Supabase aparte** para producción. No compartas el de
   desarrollo: el seed borra datos.
2. **Contraseñas**: cambiar las del seed. Idealmente, no correr el seed y crear
   el usuario administrador a mano (desde *Authentication → Users*, agregándole
   `{"rol": "ADMIN"}` en *App Metadata*, y la fila correspondiente en
   `public.usuarios`).
3. **Variables de entorno** en el hosting: las cinco de Supabase más
   `NEXT_PUBLIC_APP_URL` con la URL real.
4. **Site URL** en *Authentication → URL Configuration*, para que los enlaces de
   los correos apunten al dominio correcto.
5. **Migraciones**: `npm run db:deploy`.
6. **Buckets**: si no corrés el seed, creá a mano `ferias`, `vendedores` y
   `productos` como públicos, y `comprobantes` como privado.
7. **Revisá el linter de Supabase** (*Advisors → Security*) después del primer
   deploy.

---

## Problemas frecuentes

**`Can't reach database server` o `password authentication failed`**
Revisá que hayas reemplazado `[YOUR-PASSWORD]` en las dos cadenas de conexión y
que el usuario sea el del pooler (`postgres.TU_REF`, con el ref del proyecto),
no `postgres` a secas.

**`prepared statement "s0" already exists`**
Le falta `?pgbouncer=true` a `DATABASE_URL`. El pooler de transacciones no
soporta *prepared statements*.

**`type "geometry" does not exist`**
La migración de PostGIS no llegó a correr. Verificá que `DIRECT_URL` apunte al
puerto 5432 y volvé a correr `npm run db:deploy`. Si falla por permisos,
habilitá la extensión desde *Database → Extensions* buscando `postgis` (Supabase
la instala en `extensions`, que es justo lo que el código espera).

**`Bucket not found` al subir una imagen**
Faltan los buckets. Corré `npm run db:seed`, o crealos a mano en *Storage*
según el punto 6 del checklist de despliegue.

**Las imágenes no se muestran (`hostname not configured`)**
`next.config.ts` deriva el host permitido de `NEXT_PUBLIC_SUPABASE_URL` en
tiempo de compilación. Si cambiaste esa variable, reiniciá el servidor de
desarrollo o rehacé el build.

**Un usuario queda "sin perfil" al ingresar**
Existe en `auth.users` pero no en `public.usuarios`. Suele pasar si se creó el
usuario a mano desde el panel de Supabase. Agregá la fila en `public.usuarios`
con el mismo UUID, o borrá el usuario y registralo desde `/registro`.

**`The configuration property package.json#prisma is deprecated`**
Prisma 6 avisa que en la versión 7 el seed se va a configurar en un
`prisma.config.ts`. Hoy funciona igual; es sólo un aviso.

---

© Municipalidad de San Miguel de Tucumán
