# Base de datos (Supabase)

- **Estado:** **todo el contenido está en Supabase** (36 jornadas, 108 preguntas y 21 imágenes) y la API lo lee de ahí, siempre en Vercel y en local si se configuran las variables de entorno (ver [Uso desde la app](#uso-desde-la-app))
- **Última actualización:** 2026-11-09, publicación automática en Vercel (rama `feat/publicacion-automatica`); última migración `20261109222550_almacen_imagenes`
- **Proyecto:** `Faraday Game` (`umiqvlccxxafvafroxii`), un solo entorno `main` (ver [decisión 0001](decisiones/0001-supabase-un-solo-entorno.md))

Este documento describe **cómo está la base de datos ahora mismo**. Se actualiza en la misma PR que cada migración nueva (la skill `/sincronizar` lo comprueba). Si algo de aquí no coincide con Supabase, manda Supabase y hay que corregir este archivo.

## Resumen

```text
days (1) ──< questions (3 por día) ──< answers (1 por pregunta y jugador anónimo)
```

| Tabla | Sustituye a | Para qué |
| --- | --- | --- |
| `public.days` | `runtime/days/*.json` y las jornadas de `dist/questions.json` | Jornadas publicadas, una por fecha. |
| `public.questions` | Las preguntas de `dist/questions.json` y de `content-engine.mjs` | Preguntas de cada jornada con su cifra de referencia. |
| `public.answers` | `runtime/answers.json` | Estimaciones anónimas de los jugadores. |
| `public.daily_scores(fecha)` | El cálculo de `POST /api/daily-scores` | Puntuación de cada jugador que completó la jornada. |
| Storage, almacén `imagenes` | `dist/assets/` | Fotografías de las preguntas, públicas por URL. |

### Qué está en Supabase y qué no

| Dato | Dónde vive | Por qué |
| --- | --- | --- |
| Jornadas y preguntas (texto, cifra, fuentes, supuestos, razonamiento, créditos) | **Supabase** (`days`, `questions.content`) | La API las lee de ahí. |
| Fotografías | **Supabase Storage** (`imagenes`) | `content.image.src` apunta a su URL pública. |
| Respuestas anónimas | **Supabase** (`answers`) | |
| Origen editorial del contenido | Repositorio: `dist/questions.json`, `content-engine.mjs`, `research/` | Se revisa por PR y Vercel lo publica al desplegar producción. |
| Copia de respaldo de la web | Repositorio: `dist/questions.js` y `dist/assets/` | La web la usa solo si la API no responde. |
| Progreso, notas e historial de cada jugador | Navegador (`localStorage`) | No hay cuentas: sin autenticación no se puede asociar a nadie en el servidor. |
| HTML, CSS y JavaScript de la web | Repositorio y Vercel | Es código, no datos. |

## Tablas

### `public.days`

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `date` | clave primaria | Fecha de la jornada en `Europe/Madrid`. Equivale a `day.id` de la app. |
| `name` | `text` | obligatorio | Día de la semana mostrado («Lunes»). |
| `theme` | `text` | por defecto `''` | Lema del día. |
| `source` | `text` | `piloto` o `banco-editorial` | Origen: `dist/questions.json` o `content-engine.mjs`. |
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
- **`POST /api/daily-scores`**: lee de `answers` las tres preguntas del día, paginando de 1000 en 1000, y calcula la puntuación igual que en local.
- **Probado contra el Supabase real** el 9 de noviembre de 2026 (Luis, con `.env` local): respuestas y distribución, respuesta repetida `200`, otra cifra `409`, puntuación diaria correcta y `409` para un día incompleto. Después de publicar el contenido, la web en local mostró el calendario con `source: supabase` y la foto cargada desde Storage, sin errores en la consola.
- **Publicación del contenido** (`lib/publicar.mjs`). **Es automático**: Vercel la ejecuta en cada despliegue de producción (al fusionar en `main`): `vercel.json` tiene `"buildCommand": "node scripts/publicar-contenido.mjs --vercel"`. Funciona así:
  - Compara el repositorio con Supabase y **solo sube lo que ha cambiado**: imágenes cuyo MD5 no coincide con el de Storage, y jornadas o preguntas nuevas o con algún campo distinto (el `content` se compara sin tener en cuenta el orden de las claves, que jsonb no conserva). Si no hay cambios, solo lee.
  - En los despliegues **Preview** (`preprod` y demás ramas) no hace nada, porque comparten base de datos con producción.
  - Si en producción faltan las variables de Supabase, avisa y deja seguir el despliegue (la web usa el contenido del repositorio como respaldo). Si Supabase falla, **el despliegue falla**, para no publicar una web con contenido a medias.
  - Si una fecha y posición ya tenía otra pregunta (otro `id`), la retira **solo si no tiene respuestas**. Si las tiene, la base de datos lo impide y la publicación falla explicando qué pregunta es. Nunca borra jornadas ni respuestas.
  - A mano: `node --env-file=.env scripts/publicar-contenido.mjs --prueba` dice qué cambiaría sin escribir nada; sin `--prueba`, publica.

## Seguridad y acceso

- **Imágenes**: el almacén `imagenes` es público solo para lectura por URL, porque las fotos ya se muestran en la web. Para subir o cambiar archivos hace falta la clave secreta.
- **Solo el servidor accede a la base de datos**, con la clave secreta del proyecto (variable de entorno, nunca en Git ni en el navegador). Ver [decisión 0002](decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md).
- RLS está activado en las tres tablas **sin políticas**, y se han quitado todos los permisos a los roles `anon` y `authenticated`, también para ejecutar `daily_scores`. Con la clave pública no se puede leer ni escribir nada.
- El aviso de Supabase «RLS Enabled No Policy» (nivel INFO) es **intencionado** por lo anterior.
- El aviso «Public Can Execute SECURITY DEFINER Function» se refiere a `public.rls_auto_enable()`, una función que crea Supabase para activar RLS automáticamente en tablas nuevas (disparador de eventos `ensure_rls`). No la hemos creado nosotros y, al ser de tipo `event_trigger`, no se puede ejecutar como RPC. La dejamos como está.

## Variables de entorno

Las usa `lib/stores.mjs`. Se configuran en el proyecto `faraday-gg` de Vercel, en la cuenta de Álvaro: `SUPABASE_URL` ya está y `SUPABASE_SECRET_KEY` la añade Álvaro. Para probar en local contra esta base de datos, van en un `.env` no versionado a partir de `.env.example` (`node --env-file=.env preview-server.mjs`). Atención: hay un solo entorno, así que lo que se responda en local con estas variables queda en producción. Solo nombres, nunca valores:

| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | `https://umiqvlccxxafvafroxii.supabase.co` |
| `SUPABASE_SECRET_KEY` | Clave secreta del servidor (panel → Project Settings → API Keys). Solo en el servidor. |

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

## Pendiente

- **Más contenido**: el banco editorial termina el 14 de diciembre de 2026. Las jornadas nuevas se añaden en el repositorio y se publican con el script.
- **Datos de prueba sin borrar**: la jornada `2000-01-01` (preguntas `prueba-t1` y `prueba-t2`, 3 respuestas) es de la prueba de `daily_scores`, y las respuestas de la jornada `2026-12-14` (6 jugadores falsos) son de las pruebas contra el Supabase real. **La jornada `2026-12-14` y sus preguntas son contenido real: no se borran.** El borrado desde el agente se bloquea por permisos. Para quitar solo lo de prueba, ejecutar en el SQL Editor del panel:

  ```sql
  delete from public.answers where question_id in (select id from public.questions where day_id in ('2000-01-01', '2026-12-14'));
  delete from public.questions where day_id = '2000-01-01';
  delete from public.days where id = '2000-01-01';
  ```

  Cuando se borren, quitar este punto.
- No se migran las respuestas de `runtime/answers.json`: son pruebas locales.
