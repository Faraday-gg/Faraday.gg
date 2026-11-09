# Arquitectura y stack de Casi Casi

Este documento describe el código existente a 9 de noviembre de 2026 y la evolución prevista. La aplicación es un juego web de estimación en español: presenta tres preguntas por día, compara cada estimación con una referencia documentada y, cuando hay datos, muestra cómo respondieron otros jugadores.

## Estado actual

| Capa | Tecnología | Función |
| --- | --- | --- |
| Interfaz | HTML5, CSS y JavaScript del navegador, sin framework ni empaquetador | Presentación, navegación del juego, calculadora, notas y gráficos SVG. |
| API | Node.js con módulos ES y librerías estándar, sin dependencias de npm | `lib/api.mjs` genera el calendario y atiende respuestas y puntuaciones. La usan el servidor local (`preview-server.mjs`) y la función de Vercel (`api/index.mjs`). |
| Contenido | JSON y módulos JavaScript | Preguntas piloto, respuestas de referencia, fuentes, supuestos, imágenes y banco editorial diario. |
| Persistencia compartida | Supabase (Postgres) en Vercel; archivos JSON en `runtime/` en local | Respuestas anónimas por pregunta y jugador. `lib/stores.mjs` ofrece los dos almacenes con la misma interfaz. |
| Despliegue | Vercel: web estática de `dist/` y una función Node en `fra1` | Configurado en `vercel.json`. |
| Persistencia personal | `localStorage` del navegador | Estimaciones del jugador, identificador anónimo, notas e historial de cálculos. |
| Pruebas | `node:assert`, un proceso Node aislado y un Supabase simulado | Integración del servidor local, banco editorial y función de Vercel con Supabase. |

El esquema de Supabase está creado (ver [Entornos y servicios](#entornos-y-servicios) y [docs/base-de-datos.md](docs/base-de-datos.md)) y el código que lo usa desde el servidor local y desde Vercel está en el repositorio (ver [Despliegue](#despliegue-vercel-y-supabase)). Falta crear el proyecto de Vercel con sus variables de entorno. No hay SDK de Supabase: se usa su API REST con `fetch`. Tampoco hay autenticación de usuarios ni cuentas personales.

## Entornos y servicios

Datos de referencia para todo el equipo (Luis y Álvaro). Aquí solo van identificadores públicos; **nunca** claves, tokens ni contraseñas. Las claves se consultan en el panel de Supabase y, cuando el código las necesite, irán en variables de entorno fuera de Git.

| Elemento | Valor |
| --- | --- |
| Nombre del juego | Casi Casi |
| Repositorio de GitHub | [`Faraday-gg/Faraday.gg`](https://github.com/Faraday-gg/Faraday.gg), **público**, en la organización `Faraday-gg` (plan Free; Luis y Álvaro son Owners). Rama por defecto: `preprod`. Antes estaba en `borgesinmas/Faraday.gg`, que GitHub redirige ([decisión 0004](docs/decisiones/0004-vercel-hobby-y-repositorio-publico.md)). |
| Organización de Supabase | `Faraday.gg`, plan **FREE** |
| Proyecto de Supabase | `Faraday Game` |
| Referencia del proyecto (*project ref*) | `umiqvlccxxafvafroxii` |
| URL de la API | `https://umiqvlccxxafvafroxii.supabase.co` |
| Panel del proyecto | <https://supabase.com/dashboard/project/umiqvlccxxafvafroxii> |
| Rama de base de datos | `main` (*production*), la única que existe |
| Esquema `public` | Tablas `days`, `questions` y `answers` y función `daily_scores`, creadas el 9 de noviembre de 2026 (migración `20261109213854_esquema_inicial`). Detalle en [docs/base-de-datos.md](docs/base-de-datos.md). |
| Acceso | Solo desde el servidor con la clave secreta; la clave pública no da acceso a nada ([decisión 0002](docs/decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md)) |
| Conector MCP para agentes | `supabase-casi-casi` (apunta a este proyecto) |
| Proyecto de Vercel | `faraday-gg`, en la cuenta Hobby de Álvaro (`sistemavivacegroup`, ámbito `faraday-game`). Solo él accede al panel. Conectado a `Faraday-gg/Faraday.gg` con la app de Vercel instalada en la organización ([decisión 0004](docs/decisiones/0004-vercel-hobby-y-repositorio-publico.md)). |
| Producción (Vercel) | Rama `main` → <https://faraday-gg.vercel.app> |
| Preview de `preprod` | <https://faraday-gg-git-preprod-faraday-game.vercel.app>, que se actualiza con cada merge en `preprod`. Protegida con Vercel Authentication: solo la abre quien tiene sesión en la cuenta de Vercel. |
| Funciones y variables | Región `fra1` (Frankfurt), según `vercel.json`. Variables en Production y Preview: `SUPABASE_URL` (configurada) y `SUPABASE_SECRET_KEY` (pendiente). Ver [Despliegue](#despliegue-vercel-y-supabase). |

### Un solo entorno de Supabase

Supabase **no tiene entorno de preprod**: todo trabaja contra la base de datos `main` del proyecto `Faraday Game`. El 9 de noviembre de 2026 se intentó crear una rama de Supabase llamada `preprod` y no fue posible porque las ramas de base de datos (*branching*) solo están disponibles en el plan Pro y la organización está en el plan gratuito. Las alternativas (pasar a Pro o crear un segundo proyecto gratuito) se descartaron por ahora. El detalle y sus consecuencias están en [docs/decisiones/0001-supabase-un-solo-entorno.md](docs/decisiones/0001-supabase-un-solo-entorno.md).

En la práctica:

- La rama `preprod` de Git sigue existiendo y sigue siendo obligatoria para el código (ver [AGENTS.md](AGENTS.md)), pero **apunta a la misma base de datos que producción**.
- Todo cambio de esquema se escribe como migración SQL versionada en `supabase/migrations/`, se documenta en [docs/base-de-datos.md](docs/base-de-datos.md) y se revisa en su PR. Lo normal es aplicarla en Supabase después de aceptar la PR; si el responsable pide aplicarla antes, se anota en la bitácora. Ningún agente aplica migraciones, borra datos ni cambia políticas en Supabase sin confirmación explícita del responsable.
- Las pruebas automáticas no escriben en Supabase: siguen usando archivos temporales o datos de prueba locales.
- Cada cambio aplicado a Supabase se anota en [docs/bitacora/](docs/bitacora/) para que los dos sepamos qué hay en la base de datos.

## Mapa del repositorio

```text
dist/                    Web pública: HTML, CSS, JavaScript, JSON e imágenes
  index.html             Documento y carga de scripts
  styles.css             Diseño adaptable
  app.js                 Estado del juego, puntuación, bloc y eventos de la interfaz
  community.js           Cliente de la API, gráficos y contenido de resultados
  questions.json         Preguntas piloto y respuestas de referencia
  questions.js           Copia de las preguntas piloto para el navegador
  assets/                Fotografías e icono
lib/api.mjs              Lógica de la API (Request → Response), compartida
lib/stores.mjs           Almacenes de respuestas: archivo local y Supabase
api/index.mjs            Función de Vercel para toda la API
vercel.json              Directorio público, región, reescrituras y archivos de la función
preview-server.mjs       Servidor HTTP local: estáticos + lib/api.mjs
content-engine.mjs       Calendario y banco editorial posterior al piloto
research/                Fuentes, análisis y scripts de preparación editorial
tests/                   Integración del servidor local, contenido editorial y función de Vercel
docs/                    Decisiones, bitácora, ideas, mejoras y base de datos (Markdown)
supabase/migrations/     Migraciones SQL de la base de datos, en orden de versión
runtime/                 Estado local generado; excluido de Git
```

`dist/` es el directorio público que sirve el servidor. El navegador carga `questions.js`, pide `daily-content.js` al servidor y después ejecuta `app.js` y `community.js`. `questions.json` también lo usa el servidor como fuente de las preguntas piloto. Por ello, cuando se edita el contenido piloto hay que mantener sincronizados los dos formatos o mejorar el proceso de generación.

## Recorrido de una partida

1. `content-engine.mjs` calcula la fecha en la zona `Europe/Madrid`. Para el piloto del 9 al 15 de noviembre de 2026 devuelve las jornadas de `dist/questions.json`. Después utiliza un banco editorial finito para generar tres preguntas por día, con referentes distintos, hasta el 14 de diciembre de 2026. La generación es determinista: la misma fecha produce siempre la misma jornada. En local, además, una jornada generada se conserva en `runtime/days/`; en Vercel no se escribe en disco.
2. `lib/api.mjs` expone `GET /api/calendar`, `GET /api/day?date=AAAA-MM-DD` y `GET /daily-content.js`. En local los sirve `preview-server.mjs` junto con `dist/`; en Vercel, la función `api/index.mjs`. El navegador refresca el calendario al volver a la pestaña y periódicamente mientras está abierta.
3. `app.js` muestra las preguntas, valida un número positivo y calcula la distancia multiplicativa a la respuesta de referencia: `max(estimación / referencia, referencia / estimación)`. `1×` es una respuesta exacta. La puntuación diaria es la media de las tres distancias.
4. El navegador guarda la progresión y el bloc en `localStorage`. `community.js` crea y conserva un UUID anónimo por navegador. Al mostrar resultados, envía ese identificador y la estimación a `POST /api/answers`.
5. El servidor valida pregunta, identificador y cifra; calcula un hash SHA-256 del identificador; guarda una respuesta por pregunta y navegador (en `runtime/answers.json` o en Supabase); y devuelve una distribución que excluye al propio jugador. `POST /api/daily-scores` compara la puntuación total de quienes completaron las tres preguntas. El histograma usa una escala logarítmica; la curva suavizada aparece a partir de cinco respuestas ajenas.

El identificador anónimo evita duplicados accidentales por navegador, pero no autentica a una persona ni impide que alguien genere otros identificadores. La muestra de respuestas se comparte entre quienes usan el mismo almacén: el mismo archivo local o la misma tabla de Supabase. Si la API no está disponible, la interfaz conserva las estimaciones locales y muestra que la comparación comunitaria no está disponible.

## Contenido y recursos

Cada pregunta incluye una cifra de referencia, unidad, explicación del cálculo, supuestos y enlaces a fuentes. La investigación editorial vive en `research/`; las preguntas listas para jugar viven en `dist/questions.json`. Los scripts de investigación preparan contenido e imágenes, pero pueden depender de servicios externos y no forman parte de la ejecución habitual de la app. Las imágenes publicadas en `dist/assets/` tienen créditos y enlaces de licencia visibles en la interfaz; cualquier sustitución debe conservar una licencia compatible y su atribución.

## Límites del almacenamiento local

`runtime/answers.json` y `runtime/days/` son archivos del servidor, no una base de datos. El servidor escribe respuestas mediante un archivo temporal y cambio de nombre, lo que sirve para desarrollo, pero supone una única instancia con disco persistente. En Vercel se usa Supabase.

## Despliegue: Vercel y Supabase

**Vercel** sirve `dist/` como web estática y toda la API con una única función, `api/index.mjs`, como recomienda Vercel para funciones sin framework. `vercel.json` define:

- `outputDirectory: dist`. Solo se publica la web: no se exponen `runtime/`, `research/`, `docs/` ni el código del servidor.
- Reescrituras de `/api/<ruta>` y `/daily-content.js` hacia `/api?route=<ruta>`.
- Región `fra1` (Frankfurt), la misma que la base de datos. En el plan Hobby solo se admite una región.
- `includeFiles` para que la función lleve `dist/questions.json`.

**Supabase** guarda las respuestas con el esquema descrito en [docs/base-de-datos.md](docs/base-de-datos.md) (migración `20261109213854_esquema_inicial`):

- `answers` exige que la pregunta exista en `questions`. Al recibir la primera respuesta de una jornada, la API publica la jornada en `days` y sus tres preguntas en `questions`, en inserciones que ignoran duplicados, y después guarda la respuesta. El calendario y las preguntas que ve el navegador siguen saliendo de `content-engine.mjs`.
- La función accede con la clave secreta (`sb_secret_...`, rol `service_role`) por la API REST de Supabase, sin SDK ([decisión 0002](docs/decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md)). Pagina las lecturas porque PostgREST limita cada respuesta a 1000 filas.
- Una respuesta repetida se ignora en la base de datos (única por `question_id` y `player_hash`). Si la cifra cambia, la API responde 409, como en local.
- Preprod y producción comparten base de datos ([decisión 0001](docs/decisiones/0001-supabase-un-solo-entorno.md)). Las respuestas enviadas desde un despliegue Preview de Vercel se mezclan con las reales.

Variables de entorno de la función, iguales en Production y Preview (solo por nombre; los valores, en el panel de Vercel): `SUPABASE_URL` y `SUPABASE_SECRET_KEY`.

La rama de producción de Vercel es `main`, aunque la rama por defecto del repositorio sea `preprod`. Producción solo tendrá la versión actual cuando `preprod` pase a `main`. Hasta entonces, `faraday-gg.vercel.app` sirve el `main` antiguo, sin `vercel.json`. Las jornadas futuras del banco se calculan al vuelo, sin estado: un cambio en el banco editorial cambia también las fechas aún no jugadas.

El repositorio es público y está en la organización `Faraday-gg`. Por eso, en el plan Hobby se despliegan los commits de cualquiera de los dos, aunque el proyecto sea de Álvaro. Ver [decisión 0004](docs/decisiones/0004-vercel-hobby-y-repositorio-publico.md).

Pendiente: añadir `SUPABASE_SECRET_KEY` en Vercel, pasar `preprod` a `main`, decidir si las Preview se abren sin sesión de Vercel, copias de seguridad y retención de datos, y observabilidad más allá de los registros de Vercel.

## Desarrollo y verificación

Se requiere Node.js con soporte para módulos ES, `fetch`, `crypto.randomUUID` y `AbortSignal.timeout`; Node.js 18 o posterior es una base razonable. No hay dependencias de npm ni paso de compilación.

```sh
node preview-server.mjs
# Abrir http://127.0.0.1:4173
node tests/community.test.mjs
node tests/editorial.test.mjs
node tests/vercel.test.mjs
```

El servidor escucha en `127.0.0.1:4173` por defecto. `HOST`, `PORT` y `ANSWERS_FILE` permiten ajustar el entorno local. Con `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (por ejemplo, `node --env-file=.env preview-server.mjs`, a partir de `.env.example`) usa Supabase en lugar del archivo. Las pruebas usan archivos temporales y un Supabase simulado: no modifican `runtime/answers.json` ni la base de datos. El flujo de colaboración y las ramas están definidos en `AGENTS.md`.
