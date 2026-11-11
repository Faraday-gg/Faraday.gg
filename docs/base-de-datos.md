# Base de datos (Supabase)

- **Estado:** **todo el contenido está en Supabase** (36 jornadas, 108 preguntas y 21 imágenes) y la API lo lee de ahí, siempre en Vercel y en local si se configuran las variables de entorno (ver [Uso desde la app](#uso-desde-la-app))
- **Última actualización:** 2026-11-11, duelos 1 vs 1 (rama `feat/duelos-1vs1`): migración `20261111120000_duelos` escrita y **sin aplicar**. Antes: 2026-11-10, generación diaria con OpenAI (PR #27, rama `feat/jornada-diaria-ia`): migración `20261110120000_jornadas_generadas` escrita y **sin aplicar** (ver [pasos para activarla](mejoras/activar-jornada-diaria.md)); última migración aplicada `20261109222550_almacen_imagenes`
- **Proyecto:** `Faraday Game` (`umiqvlccxxafvafroxii`), un solo entorno `main` (ver [decisión 0001](decisiones/0001-supabase-un-solo-entorno.md))

Este documento describe **cómo está la base de datos ahora mismo**. Se actualiza en la misma PR que cada migración nueva (la skill `/sincronizar` lo comprueba). Si algo de aquí no coincide con Supabase, manda Supabase y hay que corregir este archivo.

## Resumen

```text
days (1) ──< questions (3 por día) ──< answers (1 por pregunta y jugador anónimo)
```

| Tabla | Sustituye a | Para qué |
| --- | --- | --- |
| `public.days` | `runtime/days/*.json`, las jornadas de `content/archivo/` y las de `dist/questions.json` | Jornadas publicadas, una por fecha. |
| `public.questions` | Las preguntas de `content/archivo/`, `dist/questions.json` y `content-engine.mjs` | Preguntas de cada jornada con su cifra de referencia. |
| `public.answers` | `runtime/answers.json` | Estimaciones anónimas de los jugadores. |
| `public.daily_scores(fecha)` | El cálculo de `POST /api/daily-scores` | Puntuación de cada jugador que completó la jornada. |
| Storage, almacén `imagenes` | `dist/assets/` | Fotografías de las preguntas, públicas por URL. |
| `public.duels` (**pendiente de aplicar**) | La memoria del servidor local | Duelos 1 vs 1: una fila por duelo con su estado completo. |
| `public.usernames` | `runtime/names.json` en el servidor local | Nombres de usuario reservados: una fila por jugador. |

### Qué está en Supabase y qué no

| Dato | Dónde vive | Por qué |
| --- | --- | --- |
| Jornadas y preguntas (texto, cifra, fuentes, supuestos, razonamiento, créditos) | **Supabase** (`days`, `questions.content`) | La API las lee de ahí. |
| Fotografías | **Supabase Storage** (`imagenes`) | `content.image.src` apunta a su URL pública. |
| Respuestas anónimas | **Supabase** (`answers`) | |
| Origen editorial del contenido | Repositorio: `dist/questions.json`, `content-engine.mjs`, `research/` | Se revisa por PR y Vercel lo publica al desplegar producción. |
| Copia de respaldo de la web | Repositorio: `dist/questions.js` y `dist/assets/` | La web la usa solo si la API no responde. |
| Progreso, notas e historial de cada jugador | Navegador (`localStorage`) | El progreso se recupera desde `answers` (cookie del jugador o cuenta); las notas y el historial solo están en el navegador. |
| Cuentas (inicio de sesión opcional) | **Supabase Auth** (`auth.users`) | Correo y, con Google, nombre. `app_metadata.jugador` guarda el UUID del jugador enlazado a la cuenta ([decisión 0022](decisiones/0022-inicio-de-sesion-desde-el-servidor.md)). Sin tablas ni migraciones propias. |
| HTML, CSS y JavaScript de la web | Repositorio y Vercel | Es código, no datos. |

## Tablas

### `public.days`

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `date` | clave primaria | Fecha de la jornada en `Europe/Madrid`. Equivale a `day.id` de la app. |
| `name` | `text` | obligatorio | Día de la semana mostrado («Lunes»). |
| `theme` | `text` | por defecto `''` | Lema del día. |
| `source` | `text` | `piloto`, `banco-editorial` o `ia` (`ia`, desde la migración `20261110120000`, aún sin aplicar) | Origen: `piloto` para las jornadas escritas a mano (`content/archivo/` y `dist/questions.json`), `banco-editorial` para las de `content-engine.mjs` e `ia` para las generadas cada noche con OpenAI (`lib/generar.mjs`, [decisión 0017](decisiones/0017-jornada-diaria-generada-con-openai.md)). El archivo usa `piloto` para no cambiar la restricción de la tabla. |
| `created_at` | `timestamptz` | por defecto `now()` | |

### `public.questions`

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `text` | clave primaria | Mismo id que en la app (`piloto-v2-1`, `daily-v1-0-0-xxxxxxxx`). Una pregunta revisada lleva id nuevo, para no mezclar respuestas de versiones distintas. |
| `day_id` | `date` | → `days.id`, no se puede borrar un día con preguntas | |
| `position` | `smallint` | 1 a 3; única por día | Orden dentro de la jornada. |
| `revision` | `integer` | por defecto 1 | |
| `title` | `text` | obligatorio | |
| `unit` | `text` | obligatorio | |
| `answer` | `double precision` | > 0 | Cifra de referencia para puntuar. |
| `content` | `jsonb` | obligatorio | Objeto completo que usa la interfaz: fuentes, imagen y licencia, supuestos, razonamiento. |
| `created_at` | `timestamptz` | por defecto `now()` | |

### `public.answers`

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `bigint` | identidad | |
| `question_id` | `text` | → `questions.id` | |
| `player_hash` | `text` | 64 caracteres hexadecimales | SHA-256 del UUID anónimo del navegador, igual que hoy en el servidor. **Nunca se guarda el UUID.** |
| `guess` | `double precision` | > 0 y ≤ 1e30 | Misma validación que `POST /api/answers`. |
| `created_at` | `timestamptz` | por defecto `now()` | |

Única por `(question_id, player_hash)`: un jugador anónimo responde una sola vez a cada pregunta. Si vuelve a enviar la misma cifra, el servidor debe tratarlo como éxito; si envía otra distinta, como el actual `409 Ya has respondido esta pregunta`.

### `public.duels` (migración `20261111120000_duelos`, **sin aplicar**)

Una fila por duelo 1 vs 1 ([decisión 0023](decisiones/0023-duelos-1vs1.md)). No tiene relación con las demás tablas: las preguntas se guardan por su id dentro de `state`.

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` | clave primaria | Lo genera el servidor. |
| `code` | `text` | único, 6 caracteres `A-Z2-9` | Código para invitar a un amigo. |
| `status` | `text` | `waiting`, `playing` o `finished` | Copia de `state.status`, para buscar. |
| `public` | `boolean` | por defecto `false` | `true` = partida rápida: cualquiera puede emparejarse mientras espera. |
| `state` | `jsonb` | obligatorio | El duelo completo tal y como lo usa `lib/duelos.mjs`: jugadores (SHA-256 del UUID anónimo, apodo, avatar, nivel y vida), ids de las preguntas y rondas con las respuestas, puntos y horas límite. |
| `version` | `integer` | por defecto 1 | Control de concurrencia: el servidor solo actualiza la fila si la versión es la que leyó (`PATCH ...?id=eq.X&version=eq.N`). |
| `created_at`, `updated_at` | `timestamptz` | por defecto `now()` | `updated_at` lo pone el servidor en cada escritura; en un duelo en espera indica que su creador sigue conectado. |

Índice parcial `duels_waiting_idx` sobre `created_at` para los duelos públicos en espera. RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto. Las filas no se borran (ver [mejoras](mejoras/README.md)). Contiene apodos escritos por los jugadores, pero ningún dato que los identifique.

### `public.usernames`

Nombres de usuario únicos ([decisión 0025](decisiones/0025-avatar-3d.md), `lib/nombres.mjs`). Una fila por jugador que ha reservado nombre.

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `player_hash` | `text` | clave primaria; 64 caracteres hexadecimales | SHA-256 del identificador del jugador, igual que en `answers`. Una cuenta enlaza ese mismo identificador, así que el nombre viaja con ella. |
| `name` | `text` | de 3 a 16 caracteres | El nombre tal y como lo escribió el jugador. |
| `name_key` | `text` | **único**; de 3 a 16 caracteres, sin espacios | El nombre sin mayúsculas, acentos, espacios ni signos: «José Luis» y «jose_luis» son el mismo. Lo calcula el servidor. |
| `created_at`, `updated_at` | `timestamptz` | por defecto `now()` | |

RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto. No guarda correo ni ningún otro dato personal: solo el nombre elegido y el identificador ya anónimo.

## Funciones

### `public.daily_scores(p_day date)`

Devuelve `(player_hash, score)` para cada jugador que ha respondido **todas** las preguntas de la jornada. `score` es la media de las distancias multiplicativas `max(estimación / referencia, referencia / estimación)`; `1` es perfecto. La API todavía no la usa: calcula la puntuación en el servidor a partir de `answers` (ver [mejoras](mejoras/README.md)).

Comprobada el 9 de noviembre de 2026 con datos de prueba: un jugador con 200 frente a 100 y 10 frente a 10 obtiene 1,5, y quien no completó el día no aparece.

## Uso desde la app

`lib/stores.mjs` accede por la API REST de Supabase (PostgREST), sin SDK, con la clave secreta en la cabecera `apikey`.

- **Contenido (`/api/calendar`, `/api/day`, `/daily-content.js`)**: **manda Supabase.** La API lee las jornadas de `days` con sus preguntas (`questions.content`, en orden de `position`). Si una fecha no está publicada en Supabase, o Supabase no responde, usa `content-engine.mjs` como respaldo para no dejar la web sin preguntas, y lo anota en el registro. `/api/calendar` indica `"source": "supabase"` cuando ha leído de la base de datos.
- **Respuestas a preguntas que solo existen en Supabase**: la API busca la pregunta en `questions` y usa su cifra de referencia para puntuar.

- **`POST /api/answers`**:
  - La primera vez que una instancia recibe una respuesta de una jornada, inserta la jornada en `days` (`source` = `piloto` o `banco-editorial`) y sus tres preguntas en `questions` (`position` 1 a 3, `revision`, y en `content` el objeto completo). Ignora las filas que ya existan.
  - Después inserta la respuesta en `answers`, ignorando duplicados por `(question_id, player_hash)`, y lee las respuestas de esa pregunta para devolver la distribución.
  - Si la cifra guardada no coincide con la enviada, responde `409`. La API de Supabase devuelve los `double precision` redondeados a 15 cifras significativas, así que la comparación usa una tolerancia relativa de 1e-12; si no, reenviar la misma respuesta con muchos decimales daba `409`.
- **`POST /api/jugador`**: si el UUID llega desde la cookie `faraday_jugador` (el navegador perdió su `localStorage`), lee de `answers` todas las filas con ese `player_hash` para devolver el progreso. No hay índice propio por `player_hash` ([decisión 0009](decisiones/0009-jugador-sin-registro-con-cookie.md)).
- **`POST /api/daily-scores`**: lee de `answers` las tres preguntas del día, paginando de 1000 en 1000, y calcula la puntuación igual que en local.
- **Probado contra el Supabase real** el 9 de noviembre de 2026 (Luis, con `.env` local): respuestas y distribución, respuesta repetida `200`, otra cifra `409`, puntuación diaria correcta y `409` para un día incompleto. Después de publicar el contenido, la web en local mostró el calendario con `source: supabase` y la foto cargada desde Storage, sin errores en la consola. El mismo día se jugó una jornada completa en la Preview de `preprod` en Vercel: respuestas y puntuación diaria `200`, una fila por pregunta sin duplicados al reenviar. Esas respuestas y las de pruebas anteriores se borraron después: la tabla `answers` quedó vacía.
- **Publicación del contenido** (`lib/publicar.mjs`). **Es automático**: Vercel la ejecuta en cada despliegue de producción (al fusionar en `main`): `vercel.json` tiene `"buildCommand": "node scripts/publicar-contenido.mjs --vercel"`. Funciona así:
  - Compara el repositorio con Supabase y **solo sube lo que ha cambiado**: imágenes cuyo MD5 no coincide con el de Storage, y jornadas o preguntas nuevas o con algún campo distinto (el `content` se compara sin tener en cuenta el orden de las claves, que jsonb no conserva). Si no hay cambios, solo lee.
  - En los despliegues **Preview** (`preprod` y demás ramas) no hace nada, porque comparten base de datos con producción.
  - Si en producción faltan las variables de Supabase, avisa y deja seguir el despliegue (la web usa el contenido del repositorio como respaldo). Si Supabase falla, **el despliegue falla**, para no publicar una web con contenido a medias.
  - Si una fecha y posición ya tenía otra pregunta (otro `id`), la retira **solo si no tiene respuestas**. Si las tiene, la base de datos lo impide y la publicación falla explicando qué pregunta es. Nunca borra jornadas ni respuestas.
  - A mano: `node --env-file=.env scripts/publicar-contenido.mjs --prueba` dice qué cambiaría sin escribir nada; sin `--prueba`, publica.

- **`POST /api/duelo`** (`lib/duelos.mjs`): lee el duelo por `id` o por `code`, lo pone al día con el reloj y, si ha cambiado, lo guarda exigiendo la versión leída; si otra petición se adelantó, repite. La consulta de cada segundo (`estado`) solo lee, salvo cuando el reloj cambia algo. Si la tabla no existe o Supabase falla, responde 503 sin afectar al resto de la API.
- **`POST /api/nombre`** (`lib/nombres.mjs`): sin `name` lee el nombre reservado del jugador; con `name` lo valida y hace un `upsert` por `player_hash`. Si `name_key` ya es de otro jugador, la base de datos responde 409 y la API contesta «Ese nombre ya lo tiene otro jugador». `POST /api/jugador` devuelve además el nombre reservado, y `POST /api/duelo` usa siempre el nombre reservado del jugador. Si Supabase no responde, la API contesta 503 y el nombre se queda solo en el navegador.
- **Generación diaria** (`lib/generar.mjs`, [decisión 0017](decisiones/0017-jornada-diaria-generada-con-openai.md)): `/api/generar-dia` crea la jornada de mañana con OpenAI. Consulta la fecha (`days` con sus preguntas y si alguna tiene respuestas); si es del banco y nadie la ha jugado, inserta o actualiza `days` con `source = 'ia'`, borra las preguntas antiguas de esa fecha y sube las nuevas (`ia-<fecha>-<posición>`). Si la fecha ya es `ia` o `piloto`, o tiene respuestas, no hace nada. La publicación de cada despliegue no toca las jornadas `ia`.
- **Tarea programada** (migración `20261110120000_jornadas_generadas`, **sin aplicar**): `pg_cron` ejecuta la tarea `generar-jornada` a las 22:01 y 23:01 UTC (las 00:01 de Madrid en verano y en invierno; la otra llamada no hace nada) y llama con `pg_net` a `https://faraday-gg.vercel.app/api/generar-dia` con el secreto `cron_secret` de Vault. El secreto se crea a mano en el editor SQL del panel, con el mismo valor que `CRON_SECRET` de Vercel, y nunca va al repositorio: `select vault.create_secret('<valor>', 'cron_secret');`. Para ver las ejecuciones: `select * from cron.job_run_details order by start_time desc limit 10;` y `select * from net._http_response order by created desc limit 10;`.

## Seguridad y acceso

- **Imágenes**: el almacén `imagenes` es público solo para lectura por URL, porque las fotos ya se muestran en la web. Para subir o cambiar archivos hace falta la clave secreta.
- **Solo el servidor accede a la base de datos**, con la clave secreta del proyecto (variable de entorno, nunca en Git ni en el navegador). Ver [decisión 0002](decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md).
- RLS está activado en las tres tablas **sin políticas**, y se han quitado todos los permisos a los roles `anon` y `authenticated`, también para ejecutar `daily_scores`. Con la clave pública no se puede leer ni escribir nada.
- El aviso de Supabase «RLS Enabled No Policy» (nivel INFO) es **intencionado** por lo anterior.
- El aviso «Public Can Execute SECURITY DEFINER Function» se refiere a `public.rls_auto_enable()`, una función que crea Supabase para activar RLS automáticamente en tablas nuevas (disparador de eventos `ensure_rls`). No la hemos creado nosotros y, al ser de tipo `event_trigger`, no se puede ejecutar como RPC. La dejamos como está.

## Variables de entorno

Las usa `lib/stores.mjs`. Se configuran en el proyecto `faraday-gg` de Vercel, en la cuenta de Álvaro, en Production y Preview: `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (la clave rotada el 9 de noviembre, como *Secret*). Para probar en local contra esta base de datos, van en un `.env` no versionado a partir de `.env.example` (`node --env-file=.env preview-server.mjs`). Atención: hay un solo entorno, así que lo que se responda en local con estas variables queda en producción. Solo nombres, nunca valores:

| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | `https://umiqvlccxxafvafroxii.supabase.co` |
| `SUPABASE_SECRET_KEY` | Clave secreta del servidor (panel → Project Settings → API Keys). Solo en el servidor. |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `CRON_SECRET` | Generación diaria con OpenAI, solo en Production (ver arriba). |

## Cómo se cambia el esquema

1. Rama `feat/...` desde `origin/preprod`.
2. Nueva migración en `supabase/migrations/AAAAMMDDHHMMSS_nombre.sql`. Nunca se edita una migración ya aplicada: se añade otra.
3. Se actualiza este documento y se añade la entrada en la [bitácora](bitacora/).
4. Se aplica en Supabase **solo con confirmación explícita del responsable** (hay un único entorno, ver [decisión 0001](decisiones/0001-supabase-un-solo-entorno.md)). El nombre del archivo debe coincidir con la versión que registra Supabase (`list_migrations` o la tabla `supabase_migrations.schema_migrations`).
5. PR hacia `preprod`.

## Historial de migraciones

| Versión | Archivo | Qué hace | Aplicada |
| --- | --- | --- | --- |
| `20261109213854` | [esquema_inicial](../supabase/migrations/20261109213854_esquema_inicial.sql) | Crea `days`, `questions`, `answers`, `daily_scores`, RLS y permisos. | 2026-11-09, por Luis con Claude Code |
| `20261109222550` | [almacen_imagenes](../supabase/migrations/20261109222550_almacen_imagenes.sql) | Crea el almacén público `imagenes` de Storage (máx. 5 MB por archivo; JPEG, PNG, WebP y SVG). | 2026-11-09, por Luis con Claude Code |
| `20261110120000` | [jornadas_generadas](../supabase/migrations/20261110120000_jornadas_generadas.sql) | `days.source` admite `ia`; activa `pg_cron` y `pg_net` y programa la tarea `generar-jornada` (00:01 de Madrid). | **Pendiente**: aplicar tras crear el secreto `cron_secret` en Vault |
| `20261111120000` | [duelos](../supabase/migrations/20261111120000_duelos.sql) | Crea la tabla `duels` (duelos 1 vs 1) con RLS y sin permisos públicos. | **Pendiente**: sin ella los duelos responden 503 en Vercel |
| `20261111125432` | [nombres_de_usuario](../supabase/migrations/20261111125432_nombres_de_usuario.sql) | Crea la tabla `usernames` (nombres de usuario únicos) con RLS y sin permisos públicos. | Aplicada el 11 de noviembre de 2026, antes de fusionar la PR, a petición expresa de Luis. |

## Pendiente

- **Más contenido**: el banco editorial termina el 14 de diciembre de 2026. Con la generación diaria (decisión 0017) cada fecha tendrá su jornada `ia` desde la noche anterior; falta configurarla (migración, Vault y variables de Vercel).
- No se migran las respuestas de `runtime/answers.json`: son pruebas locales.
