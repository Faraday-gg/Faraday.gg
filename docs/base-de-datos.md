# Base de datos (Supabase)

- **Estado:** **todo el contenido está en Supabase** (36 jornadas, 108 preguntas y 21 imágenes) y la API lo lee de ahí, siempre en Vercel y en local si se configuran las variables de entorno (ver [Uso desde la app](#uso-desde-la-app))
- **Última actualización:** 2026-11-15, Luis pidió aplicar las cuatro migraciones de la economía en el servidor: **aplicadas** como `20261115162316_preguntas_comunidad`, `20261115162701_libro_contable`, `20261115162719_experiencia_y_misiones` y `20261115162737_inventario` (los archivos se llamaban `20261115162316`, `20261115162701`, `20261115162719` y `20261115162737`, y se renombraron con la versión que registró Supabase). Antes: 2026-11-12, Luis pidió aplicar la migración del Circuito de amigos: **aplicada** como `20261112140721_referidos` (el archivo se llamaba `20261112180000_referidos` y se renombró con la versión que registró Supabase). Antes: 2026-11-12, Luis pidió aplicar las migraciones de los duelos (`20261112005952_duelos`) y de las ligas de amigos (`20261112010003_ligas`, rama `feat/ligas-amigos`): **aplicadas**. Sus archivos se renombraron con la versión que registró Supabase (antes `20261111120000_duelos` y `20261112120000_ligas`). Antes: 2026-11-11, duelos 1 vs 1 (rama `feat/duelos-1vs1`). Antes: 2026-11-10, generación diaria con OpenAI (PR #27, rama `feat/jornada-diaria-ia`): migración `20261110120000_jornadas_generadas` escrita y **sin aplicar** (ver [pasos para activarla](mejoras/activar-jornada-diaria.md)). Supabase tiene además aplicada `20261111125432_nombres_de_usuario` (tabla `usernames`), cuyo archivo no está en esta rama: viene de otra rama aún sin fusionar
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
| `public.duels` | La memoria del servidor local | Duelos 1 vs 1: una fila por duelo con su estado completo. |
| `public.leagues`, `public.league_members`, `public.daily_results` | `runtime/ligas.json` del servidor local | Ligas de amigos: las ligas, sus miembros (máximo 15) y la distancia media del reto diario jugado el mismo día. |
| `public.referral_codes`, `public.referrals` | `runtime/referidos.json` del servidor local | Circuito de amigos (referidos): el código de cada jugador y quién invitó a quién, con los premios ya cobrados. |
| `public.ranks` (**sin aplicar**) | `runtime/rangos.json` del servidor local | Clasificatorias de los duelos: valoración, partidas y colchón de cada jugador. |

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

### `public.duels` (migración `20261112005952_duelos`, aplicada el 2026-11-12)

Una fila por duelo 1 vs 1 ([decisión 0023](decisiones/0023-duelos-1vs1.md)). No tiene relación con las demás tablas: las preguntas se guardan por su id dentro de `state`.

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` | clave primaria | Lo genera el servidor. |
| `code` | `text` | único, 6 caracteres `A-Z2-9` | Código para invitar a un amigo. |
| `status` | `text` | `waiting`, `playing` o `finished` | Copia de `state.status`, para buscar. |
| `public` | `boolean` | por defecto `false` | `true` = partida rápida: cualquiera puede emparejarse mientras espera. |
| `state` | `jsonb` | obligatorio | El duelo completo tal y como lo usa `lib/duelos.mjs`: jugadores (SHA-256 del UUID anónimo, apodo, avatar, nivel, vida y nivel de apuesta `bet`, [decisión 0044](decisiones/0044-apuestas-en-duelos.md), sin migración), ids de las preguntas y rondas con las respuestas, puntos y horas límite. Desde la [decisión 0040](decisiones/0040-chat-en-los-duelos.md), también `chat` (los 40 últimos mensajes: quién, tipo, clave o texto y hora) y `chatSeq`. |
| `version` | `integer` | por defecto 1 | Control de concurrencia: el servidor solo actualiza la fila si la versión es la que leyó (`PATCH ...?id=eq.X&version=eq.N`). |
| `created_at`, `updated_at` | `timestamptz` | por defecto `now()` | `updated_at` lo pone el servidor en cada escritura; en un duelo en espera indica que su creador sigue conectado. |

Índice parcial `duels_waiting_idx` sobre `created_at` para los duelos públicos en espera. RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto. Las filas no se borran (ver [mejoras](mejoras/README.md)). Contiene apodos escritos por los jugadores, pero ningún dato que los identifique.

### Ligas de amigos (migración `20261112010003_ligas`, aplicada el 2026-11-12)

[Decisión 0031](decisiones/0031-ligas-de-amigos.md), `lib/ligas.mjs`.

```text
leagues (1) ──< league_members (máx. 15)        daily_results (1 por jugador y día)
```

**`public.leagues`**

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` | clave primaria | Lo genera el servidor. |
| `code` | `text` | único, 6 caracteres `A-Z2-9` | Código para invitar (`?liga=CÓDIGO`). |
| `name` | `text` | 1 a 24 caracteres | Lo escribe quien crea la liga; el servidor lo limpia de HTML. |
| `created_at` | `timestamptz` | por defecto `now()` | Una liga creada esta semana no tiene resumen de la anterior. |

**`public.league_members`**

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `league_id` | `uuid` | → `leagues.id`, se borra en cascada | |
| `player_hash` | `text` | 64 caracteres hexadecimales | SHA-256 del UUID anónimo (o del jugador enlazado a la cuenta). |
| `name` | `text` | 1 a 16 caracteres | Apodo, limpio de HTML. |
| `avatar` | `jsonb` | por defecto `{}` | Solo los identificadores de las piezas del avatar, como en los duelos, y el de la medalla destacada (`badge`, decisión 0035). |
| `joined_at` | `timestamptz` | por defecto `now()` | Quien entra después de una semana no cuenta en ella. |

Clave primaria `(league_id, player_hash)` e índice `league_members_player_idx` por `player_hash` («Tus ligas»). El disparador `league_members_limit` impide pasar de 15 miembros: bloquea la fila de la liga y, si ya hay 15, falla con `liga_llena`. El servidor lo comprueba antes, así que el disparador solo actúa si dos personas entran a la vez. Cuando sale el último miembro, el servidor borra la liga.

**`public.daily_results`**

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `player_hash` | `text` | 64 caracteres hexadecimales | |
| `day` | `date` | | Fecha de la jornada en `Europe/Madrid`. |
| `score` | `double precision` | ≥ 1 | Distancia media del día (1 = exacto), calculada por el servidor a partir de `answers`. |
| `created_at` | `timestamptz` | por defecto `now()` | |

Clave primaria `(player_hash, day)`: vale la primera. El servidor solo inserta cuando el jugador completa las tres preguntas **el mismo día de la jornada** en hora de Madrid; lo jugado desde el archivo no se apunta. Se guarda para todos los jugadores, estén o no en una liga, para que quien se une a mitad de semana no pierda los días que ya jugó.

Las tres tablas tienen RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto. Contienen apodos escritos por los jugadores, pero ningún dato que los identifique.

### Circuito de amigos (migración `20261112140721_referidos`)

[Decisión 0038](decisiones/0038-circuito-de-amigos.md), `lib/referidos.mjs`.

**`public.referral_codes`**

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `player_hash` | `text` | clave primaria, 64 caracteres hexadecimales | SHA-256 del UUID anónimo. |
| `code` | `text` | único, `^[A-Z2-9]{6}$` | Va en los enlaces como `?de=CÓDIGO`. |
| `name` | `text` | 1 a 16 caracteres | Apodo que ven sus amigos. |
| `avatar` | `jsonb` | por defecto `{}` | Piezas del avatar. |
| `created_at` | `timestamptz` | por defecto `now()` | |

**`public.referrals`**

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `invitee_hash` | `text` | clave primaria | Un invitado tiene un único padrino. |
| `inviter_hash` | `text` | distinto de `invitee_hash` | Índice `referrals_inviter_idx`. |
| `linked_at` | `timestamptz` | por defecto `now()` | Cuándo abrió el enlace. |
| `connected_at` | `timestamptz` | nulo hasta conectarse | Cuándo cumplió 3 retos del día en sus primeros 14 días (`daily_results`). |
| `welcome_claimed`, `invitee_claimed`, `inviter_claimed` | `boolean` | por defecto `false` | Premios ya cobrados: bienvenida del invitado, faradios del invitado al conectarse y premio de quien invita. |

Cobrar es un `PATCH` con `*_claimed = eq.false` que devuelve la fila: si no la devuelve, ya estaba cobrado. Así un premio solo se entrega una vez aunque lleguen dos peticiones a la vez.

RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto.

### Clasificatorias (migración `20261112200000_rangos`, **sin aplicar**)

[Decisión 0043](decisiones/0043-clasificatorias-y-rangos.md), `lib/rangos.mjs`. Hasta que se aplique, la opción «Clasificatoria» responde 503 («Las clasificatorias no están disponibles ahora mismo») y los duelos normales siguen funcionando.

**`public.ranks`**

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `player_hash` | `text` | clave primaria, 64 caracteres hexadecimales | SHA-256 del UUID anónimo. |
| `rating` | `integer` | ≥ 0, por defecto 300 | 100 por división desde Bronce III (0). Desde 2100, Científico. |
| `games`, `wins`, `losses`, `draws` | `integer` | ≥ 0 | Las 5 primeras partidas son de posicionamiento. |
| `shield` | `integer` | 0 a 10 | Partidas de colchón que quedan tras subir de división. |
| `peak` | `integer` | ≥ 0 | La valoración más alta alcanzada. |
| `seen` | `jsonb` | por defecto `{}` | Últimos 30 duelos apuntados (id → resultado): un duelo no cuenta dos veces. |
| `name`, `avatar` | `text`, `jsonb` | apodo de hasta 16 | Para la clasificación de la cumbre (Científico). |
| `version` | `integer` | por defecto 1 | Concurrencia optimista, como en `duels`. |
| `updated_at` | `timestamptz` | por defecto `now()` | |

Índice parcial `ranks_rating_idx` (`rating desc`, solo `rating >= 2100`) para la cumbre. RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto. Los duelos clasificatorios no necesitan columnas nuevas en `duels`: el modo, la valoración de cada jugador al empezar y el resultado van en `state` (`mode`, `players[].rank`, `rankResult`, `rankSettled`).

### Preguntas de la comunidad y progreso en la cuenta (migración `20261115162316_preguntas_comunidad`, aplicada el 2026-11-15)

[Decisión 0052](decisiones/0052-preguntas-de-la-comunidad.md), `lib/comunidad.mjs`. 

**`public.player_progress`**: el progreso de los jugadores con cuenta.

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `player_hash` | `text` | clave primaria, 64 caracteres hexadecimales | SHA-256 del jugador de la cuenta. |
| `state` | `jsonb` | por defecto `{}` | El progreso de `dist/progress.js` (nivel, avatar, misiones, cofres, medallas…) sin los faradios. |
| `coins` | `integer` | ≥ 0 | Saldo de faradios. Manda el servidor. |
| `gain_day`, `gained` | `date`, `integer` | | Faradios ganados en el navegador y aceptados ese día (tope diario). Desde la [decisión 0065](decisiones/0065-cierre-de-la-economia-en-el-servidor.md) el tope es 0: el navegador ya no suma ganancias. |
| `updated_at` | `timestamptz` | por defecto `now()` | |

**`public.community_proposals`**: preguntas propuestas.

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` | clave primaria | |
| `round` | `date` | | Lunes en que se publican las ganadoras de la ronda. |
| `player_hash` | `text` | 64 caracteres hexadecimales | Autor. No se enseña nunca. |
| `name`, `avatar` | `text`, `jsonb` | apodo de 1 a 16 | Con lo que sale la pregunta. |
| `title`, `unit`, `note` | `text` | 10–160, 1–24 y ≤ 280 caracteres | La pregunta, su unidad y una aclaración opcional. |
| `votes` | `integer` | ≥ 0 | |
| `status` | `text` | `abierta`, `publicada` o `descartada` | Para retirar una a mano antes del domingo: `descartada`. |
| `question_id` | `text` | | Id de la pregunta publicada (`comunidad-AAAA-MM-DD-n`). |
| `created_at` | `timestamptz` | por defecto `now()` | |

**`public.community_votes`**: un voto por jugador y propuesta (clave primaria `proposal_id, player_hash`; se borra en cascada con la propuesta).

Funciones (sin permisos para `anon` ni `authenticated`; se llaman por `/rest/v1/rpc/` con la clave secreta):

- `progress_save(p_player, p_state, p_delta, p_day, p_daily_cap, p_first_cap)`: guarda el progreso y suma `p_delta` al saldo, con tope diario para lo que se gana. Devuelve el saldo. Sigue en la base de datos sin uso: el servidor llama a la de siete parámetros (`p_moves`) de la migración del libro contable.
- `progress_credit(p_player, p_amount)`: suma faradios (premio al autor). Devuelve el saldo. Sigue en la base de datos sin uso: la sustituye `wallet_move`.
- `community_propose(...)` y `community_vote(...)`: comprueban las reglas, cobran del saldo e insertan, todo en la misma transacción. Devuelven `{coins}` o `{error}`.

RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto.

### Libro contable de faradios (migración `20261115162701_libro_contable`, aplicada el 2026-11-15)

[Decisión 0057](decisiones/0057-libro-contable-de-faradios.md), `lib/comunidad.mjs`. Va después de `20261115162316_preguntas_comunidad`, porque usa `player_progress`. **Se aplicó sin borrar nada**: las funciones antiguas `progress_credit(text, integer)` y `progress_save` de seis parámetros siguen en la base de datos, sin uso y sin permisos; la `progress_save` nueva tiene siete parámetros, con `p_moves` obligatorio.

**`public.ledger`**: un apunte por cada cambio de saldo. No se modifica ni se borra; el saldo (`player_progress.coins`) es la suma de los apuntes del jugador.

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `id` | `bigint` | identidad | Orden de los apuntes. |
| `player_hash` | `text` | 64 caracteres hexadecimales | |
| `amount` | `integer` | distinto de 0 | Positivo: faradios emitidos. Negativo: gastados. |
| `reason` | `text` | `^[a-z0-9-]{1,32}$` | Motivo. Del navegador: `bienvenida`, `reto`, `archivo`, `duelos`, `nivel`, `misiones`, `cofres`, `cofres-compra`, `tienda`, `pistas`, `apuestas`, `referidos`, `otros`, `sin-desglose`, `tope` y `saldo-inicial`. Del servidor: `comunidad-proponer`, `comunidad-votar` y `comunidad-autor`. |
| `source` | `text` | `servidor` o `navegador` | Quién calculó el movimiento. Lo del navegador es una declaración, no una prueba. |
| `ref` | `text` | opcional | Lo que originó el apunte (id de la propuesta). Índice único `ledger_once` por `(player_hash, reason, ref)` cuando hay referencia: no se apunta dos veces. |
| `balance` | `integer` | | Saldo tras el apunte. |
| `day` | `date` | por defecto, hoy en `Europe/Madrid` | |
| `created_at` | `timestamptz` | por defecto `now()` | |

Índices `ledger_player` (`player_hash, id desc`) y `ledger_day` (`day, reason`).

**`public.ledger_daily`** (vista): por día, motivo y origen, los faradios emitidos (`emitted`), los gastados (`spent`), cuántos jugadores (`players`) y cuántos apuntes (`moves`). Para medir la economía: `select * from ledger_daily where day >= current_date - 7 order by day, emitted desc;`.

Funciones (sin permisos para `anon` ni `authenticated`):

- Desde la [decisión 0058](decisiones/0058-premios-del-reto-en-el-servidor.md), el servidor apunta también los motivos `reto` y `archivo` (con la fecha de la jornada en `ref`), que el navegador ya no puede declarar. No cambia el esquema. Desde la [decisión 0059](decisiones/0059-premios-de-los-duelos-en-el-servidor.md), también `duelos` y `duelos-bot` (con el id del duelo en `ref`); el tope diario de duelos se cuenta con esos apuntes. Desde la [decisión 0060](decisiones/0060-apuestas-en-bote.md), también `apuesta` (negativo, al empezar el duelo), `apuesta-premio` y `apuesta-devuelta`, con el id del duelo en `ref`.
- `wallet_move(p_player, p_amount, p_reason, p_ref)`: mueve faradios desde el servidor y lo apunta. Devuelve `{coins}`; `{coins, repeated}` si ese motivo y referencia ya estaban apuntados, sin volver a mover nada; o `{error: 'saldo', coins}` si no llega para cobrar. Sustituye a `progress_credit`, que no se ha borrado.
- `progress_save(..., p_moves)`: como antes, y además apunta el desglose `{"motivo": cantidad}`. La primera subida se apunta como `saldo-inicial`; lo que el tope o el saldo mínimo recortan, como `tope`.
- `community_propose(...)` y `community_vote(...)`: como antes, y apuntan lo cobrado con la propuesta como referencia.

RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto.

### Experiencia y misiones (migración `20261115162719_experiencia_y_misiones`, aplicada el 2026-11-15)

[Decisión 0061](decisiones/0061-experiencia-y-misiones-en-el-servidor.md), `lib/misiones.mjs`. Va después de `20261115162701_libro_contable`. Añade tres columnas a `public.player_progress`:

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `xp` | `integer` | ≥ 0, por defecto 0 | Experiencia que lleva el servidor. De ella salen el nivel y su premio (apunte `nivel`, referencia `nivel-N`). La de `state` es la que pinta el navegador. |
| `stats` | `jsonb` | por defecto `{}` | Desde la [decisión 0063](decisiones/0063-cofres-en-el-servidor.md), también los cofres sin abrir (`chests`), la batería (`charge`), la racha (`streak`), la cuenta de mala suerte (`pity`), los cofres abiertos (`opened`) y, desde la [decisión 0064](decisiones/0064-premios-del-circuito-en-el-servidor.md), si ya se dio el cofre Tormenta del Circuito (`storm`) y los días de corriente compartida ya cargados (`current`). Contadores de las misiones del día y de la semana (`day`, `week`: clave, contadores y misiones recogidas), racha y duelos del día (`duel`) y las últimas preguntas y duelos ya contados (`seen`). Vacío hasta la primera vez; entonces `xp` parte de la experiencia declarada en `state`, con tope. |
| `stats_version` | `integer` | por defecto 0 | Concurrencia optimista, como en `duels`: el servidor guarda con `PATCH …?stats_version=eq.<leída>`. |

Desde esta decisión el servidor apunta también en `ledger` los motivos `misiones` (referencia `<día o lunes>:<misión>`) y `nivel`, que el navegador ya no puede declarar. `POST /api/answers` lee esta fila en cada respuesta para saber si el jugador tiene cuenta.

### Inventario (migración `20261115162737_inventario`, aplicada el 2026-11-15)

[Decisión 0062](decisiones/0062-tienda-y-pistas-en-el-servidor.md), `lib/catalogo.mjs`.

**`public.items`**: las piezas del catálogo que tiene cada jugador con cuenta. De momento solo las compradas en la tienda con cuenta.

| Columna | Tipo | Reglas | Notas |
| --- | --- | --- | --- |
| `player_hash` | `text` | 64 caracteres hexadecimales | |
| `item` | `text` | `hueco:id` | La clave de la pieza en `dist/avatar.js` (`top:cam-crema-logo`). |
| `source` | `text` | | De dónde salió: `tienda`, `cofre` o `inicial` (las que el jugador ya tenía al empezar el servidor a llevar sus cofres, decisión 0063). |
| `created_at` | `timestamptz` | por defecto `now()` | |

Clave primaria `(player_hash, item)`. La compra cobra con `wallet_move` (motivo `tienda`, referencia = la pieza) y después inserta aquí; las pistas se cobran con motivo `pistas` y la pregunta como referencia. RLS activado sin políticas y sin permisos para `anon` ni `authenticated`, como el resto.

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
- **Clasificatorias** (`lib/rangos.mjs`, acción `buscar` con `mode: 'ranked'` y acción `rango` de `/api/duelo`): al buscar, lee la fila de `ranks` del jugador; al terminar el duelo, por cada jugador lee su fila, calcula los PR y la guarda con `PATCH … version=eq.<leída>` (o la inserta si no existía), apuntando el duelo en `seen`. Si la fila ya tiene ese duelo en `seen`, devuelve el mismo resultado sin tocarla. Si la tabla no existe, `buscar` en clasificatoria y `rango` responden 503 y los PR de un duelo se reintentan en la siguiente consulta.
- **`POST /api/liga`** (`lib/ligas.mjs`): crea ligas e inserta miembros, y para la clasificación lee `daily_results` de los miembros entre el lunes y el domingo. `POST /api/answers` (al responder la última pregunta del reto de hoy) y `POST /api/daily-scores` insertan en `daily_results`, ignorando duplicados; si falla, la respuesta se guarda igual. Si las tablas no existen o Supabase falla, `/api/liga` responde 503 sin afectar al resto de la API.
- **`POST /api/referido`** (`lib/referidos.mjs`): `codigo` crea o actualiza tu fila de `referral_codes`. `abrir` inserta en `referrals` (ignorando duplicados) si el jugador no tiene respuestas en `answers`. `estado` y `reclamar` leen `daily_results` de los invitados para marcar `connected_at` y cobran los premios con el `PATCH` condicionado. Si las tablas no existen o Supabase falla, responde 503 sin afectar al resto de la API.
- **Generación diaria** (`lib/generar.mjs`, [decisión 0017](decisiones/0017-jornada-diaria-generada-con-openai.md)): `/api/generar-dia` crea la jornada de mañana con OpenAI. Consulta la fecha (`days` con sus preguntas y si alguna tiene respuestas); si es del banco y nadie la ha jugado, inserta o actualiza `days` con `source = 'ia'`, borra las preguntas antiguas de esa fecha y sube las nuevas (`ia-<fecha>-<posición>`). Si la fecha ya es `ia` o `piloto`, o tiene respuestas, no hace nada. La publicación de cada despliegue no toca las jornadas `ia`.
- **Tarea programada** (migración `20261110120000_jornadas_generadas`, **sin aplicar**): `pg_cron` ejecuta la tarea `generar-jornada` a las 22:01 y 23:01 UTC (las 00:01 de Madrid en verano y en invierno; la otra llamada no hace nada) y llama con `pg_net` a `https://faraday-gg.vercel.app/api/generar-dia` con el secreto `cron_secret` de Vault. El secreto se crea a mano en el editor SQL del panel, con el mismo valor que `CRON_SECRET` de Vercel, y nunca va al repositorio: `select vault.create_secret('<valor>', 'cron_secret');`. Para ver las ejecuciones: `select * from cron.job_run_details order by start_time desc limit 10;` y `select * from net._http_response order by created desc limit 10;`.

## Seguridad y acceso

- **Imágenes**: el almacén `imagenes` es público solo para lectura por URL, porque las fotos ya se muestran en la web. Para subir o cambiar archivos hace falta la clave secreta.
- **Solo el servidor accede a la base de datos**, con la clave secreta del proyecto (variable de entorno, nunca en Git ni en el navegador). Ver [decisión 0002](decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md).
- RLS está activado en todas las tablas **sin políticas**, y se han quitado todos los permisos a los roles `anon` y `authenticated`, también para ejecutar `daily_scores`. Con la clave pública no se puede leer ni escribir nada.
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
| `20261111125432` | nombres_de_usuario (archivo en otra rama) | Crea `usernames`. | Aplicada en Supabase; el archivo no está en esta rama |
| `20261112005952` | [duelos](../supabase/migrations/20261112005952_duelos.sql) | Crea la tabla `duels` (duelos 1 vs 1) con RLS y sin permisos públicos. | 2026-11-12, por Luis con Claude Code |
| `20261112010003` | [ligas](../supabase/migrations/20261112010003_ligas.sql) | Crea `leagues`, `league_members` (con el disparador del límite de 15) y `daily_results`, con RLS y sin permisos públicos. | 2026-11-12, por Luis con Claude Code |
| `20261112140721` | [referidos](../supabase/migrations/20261112140721_referidos.sql) | Crea `referral_codes` y `referrals` (Circuito de amigos), con RLS y sin permisos públicos. | 2026-11-12, por Luis con Claude Code |
| `20261115162316` | [preguntas_comunidad](../supabase/migrations/20261115162316_preguntas_comunidad.sql) | Crea `player_progress`, `community_proposals`, `community_votes` y sus funciones, con RLS y sin permisos públicos. | 2026-11-15, por Luis con Claude Code |
| `20261115162701` | [libro_contable](../supabase/migrations/20261115162701_libro_contable.sql) | Crea `ledger`, la vista `ledger_daily`, `wallet_move` y una `progress_save` de siete parámetros, y vuelve a crear `community_propose` y `community_vote` para que apunten cada movimiento. No borra las funciones antiguas. | 2026-11-15, por Luis con Claude Code |
| `20261115162719` | [experiencia_y_misiones](../supabase/migrations/20261115162719_experiencia_y_misiones.sql) | Añade `xp`, `stats` y `stats_version` a `player_progress`. | 2026-11-15, por Luis con Claude Code |
| `20261115162737` | [inventario](../supabase/migrations/20261115162737_inventario.sql) | Crea `items` (piezas de cada jugador con cuenta), con RLS y sin permisos públicos. | 2026-11-15, por Luis con Claude Code |
| `20261112200000` | [rangos](../supabase/migrations/20261112200000_rangos.sql) | Crea `ranks` (clasificatorias de los duelos), con RLS y sin permisos públicos. | **Pendiente**: rama `feat/clasificatorias-rangos`, sin aplicar |

## Pendiente

- **Más contenido**: el banco editorial termina el 14 de diciembre de 2026. Con la generación diaria (decisión 0017) cada fecha tendrá su jornada `ia` desde la noche anterior; falta configurarla (migración, Vault y variables de Vercel).
- No se migran las respuestas de `runtime/answers.json`: son pruebas locales.
