# Base de datos (Supabase)

- **Estado:** esquema creado; la app **todavía no lo usa** (sigue escribiendo en `runtime/`)
- **Última actualización:** 2026-11-09, migración `20261109213854_esquema_inicial`
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

Devuelve `(player_hash, score)` para cada jugador que ha respondido **todas** las preguntas de la jornada. `score` es la media de las distancias multiplicativas `max(estimación / referencia, referencia / estimación)`; `1` es perfecto. El servidor la usará para sustituir el cálculo de `POST /api/daily-scores` y construir el histograma.

Comprobada el 9 de noviembre de 2026 con datos de prueba: un jugador con 200 frente a 100 y 10 frente a 10 obtiene 1,5, y quien no completó el día no aparece.

## Seguridad y acceso

- **Solo el servidor accede a la base de datos**, con la clave secreta del proyecto (variable de entorno, nunca en Git ni en el navegador). Ver [decisión 0002](decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md).
- RLS está activado en las tres tablas **sin políticas**, y se han quitado todos los permisos a los roles `anon` y `authenticated`, también para ejecutar `daily_scores`. Con la clave pública no se puede leer ni escribir nada.
- El aviso de Supabase «RLS Enabled No Policy» (nivel INFO) es **intencionado** por lo anterior.
- El aviso «Public Can Execute SECURITY DEFINER Function» se refiere a `public.rls_auto_enable()`, una función que crea Supabase para activar RLS automáticamente en tablas nuevas (disparador de eventos `ensure_rls`). No la hemos creado nosotros y, al ser de tipo `event_trigger`, no se puede ejecutar como RPC. La dejamos como está.

## Variables de entorno previstas

Se configurarán en Vercel (Álvaro está empezando a montarlo) y en local en un `.env` no versionado. Solo nombres, nunca valores:

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

## Pendiente

- **Conectar la app**: `preview-server.mjs` y las futuras funciones de Vercel siguen usando `runtime/`. Hay que pasar `/api/answers`, `/api/daily-scores`, `/api/day` y `/api/calendar` a Supabase.
- **Cargar el contenido**: `days` y `questions` están vacías. Hay que cargar la semana piloto y las jornadas del banco editorial (con un script que lea `dist/questions.json` y `content-engine.mjs`).
- **Datos de prueba sin borrar**: las pruebas del 9 de noviembre dejaron la jornada `2000-01-01` (`prueba-agente`), las preguntas `prueba-t1` y `prueba-t2` y 3 respuestas falsas, porque el borrado desde el agente fue bloqueado. Para quitarlas, ejecutar en el SQL Editor del panel:

  ```sql
  delete from public.answers where question_id in ('prueba-t1', 'prueba-t2');
  delete from public.questions where id in ('prueba-t1', 'prueba-t2');
  delete from public.days where id = '2000-01-01';
  ```

  Cuando se borren, quitar este punto.
- No se migran las respuestas de `runtime/answers.json`: son pruebas locales.
