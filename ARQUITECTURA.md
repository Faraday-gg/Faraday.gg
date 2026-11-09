# Arquitectura y stack de Casi Casi

Este documento describe el código existente a 9 de noviembre de 2026 y la evolución prevista. La aplicación es un juego web de estimación en español: presenta tres preguntas por día, compara cada estimación con una referencia documentada y, cuando hay datos, muestra cómo respondieron otros jugadores.

## Estado actual

| Capa | Tecnología | Función |
| --- | --- | --- |
| Interfaz | HTML5, CSS y JavaScript del navegador, sin framework ni empaquetador | Presentación, navegación del juego, calculadora, notas y gráficos SVG. |
| Servidor | Node.js con módulos ES y librerías estándar (`http`, `fs`, `path`, `crypto`) | Sirve `dist/`, genera el calendario y expone las rutas de respuestas y puntuaciones. |
| Contenido | JSON y módulos JavaScript | Preguntas piloto, respuestas de referencia, fuentes, supuestos, imágenes y banco editorial diario. |
| Persistencia compartida actual | Archivos JSON en `runtime/` | Respuestas anónimas y jornadas generadas para una sola instancia del servidor. |
| Persistencia personal | `localStorage` del navegador | Estimaciones del jugador, identificador anónimo, notas e historial de cálculos. |
| Pruebas | `node:assert` y un proceso Node aislado | Prueba de integración de la API de respuestas y su persistencia. |

El proyecto de Supabase ya existe y tiene su esquema creado (ver [Entornos y servicios](#entornos-y-servicios) y [docs/base-de-datos.md](docs/base-de-datos.md)), pero el código todavía no lo usa: no hay SDK de Supabase, integración con Vercel ni despliegue de producción configurados en este repositorio. Tampoco hay autenticación de usuarios ni cuentas personales.

## Entornos y servicios

Datos de referencia para todo el equipo (Luis y Álvaro). Aquí solo van identificadores públicos; **nunca** claves, tokens ni contraseñas. Las claves se consultan en el panel de Supabase y, cuando el código las necesite, irán en variables de entorno fuera de Git.

| Elemento | Valor |
| --- | --- |
| Nombre del juego | Casi Casi |
| Repositorio de GitHub | [`borgesinmas/Faraday.gg`](https://github.com/borgesinmas/Faraday.gg) (rama por defecto: `preprod`) |
| Organización de Supabase | `Faraday.gg`, plan **FREE** |
| Proyecto de Supabase | `Faraday Game` |
| Referencia del proyecto (*project ref*) | `umiqvlccxxafvafroxii` |
| URL de la API | `https://umiqvlccxxafvafroxii.supabase.co` |
| Panel del proyecto | <https://supabase.com/dashboard/project/umiqvlccxxafvafroxii> |
| Rama de base de datos | `main` (*production*), la única que existe |
| Esquema `public` | Tablas `days`, `questions` y `answers` y función `daily_scores`, creadas el 9 de noviembre de 2026 (migración `20261109213854_esquema_inicial`). Sin contenido cargado. Detalle en [docs/base-de-datos.md](docs/base-de-datos.md). |
| Acceso | Solo desde el servidor con la clave secreta; la clave pública no da acceso a nada ([decisión 0002](docs/decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md)) |
| Conector MCP para agentes | `supabase-casi-casi` (apunta a este proyecto) |
| Vercel | Álvaro está empezando a configurarlo; todavía sin proyecto documentado aquí. Variables previstas: `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. |

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
preview-server.mjs       Servidor HTTP y API local
content-engine.mjs       Calendario y banco editorial posterior al piloto
research/                Fuentes, análisis y scripts de preparación editorial
tests/                   Pruebas de integración del servidor y del contenido editorial
docs/                    Decisiones, bitácora, ideas, mejoras y base de datos (Markdown)
supabase/migrations/     Migraciones SQL de la base de datos, en orden de versión
runtime/                 Estado local generado; excluido de Git
```

`dist/` es el directorio público que sirve el servidor. El navegador carga `questions.js`, pide `daily-content.js` al servidor y después ejecuta `app.js` y `community.js`. `questions.json` también lo usa el servidor como fuente de las preguntas piloto. Por ello, cuando se edita el contenido piloto hay que mantener sincronizados los dos formatos o mejorar el proceso de generación.

## Recorrido de una partida

1. `content-engine.mjs` calcula la fecha en la zona `Europe/Madrid`. Para el piloto del 9 al 15 de noviembre de 2026 devuelve las jornadas de `dist/questions.json`. Después utiliza un banco editorial finito para generar tres preguntas por día, con referentes distintos, hasta el 14 de diciembre de 2026. Una jornada generada se conserva en `runtime/days/` para mantener estable su contenido en esa instancia.
2. `preview-server.mjs` sirve los archivos de `dist/` y expone `GET /api/calendar`, `GET /api/day?date=AAAA-MM-DD` y `GET /daily-content.js`. El navegador refresca el calendario al volver a la pestaña y periódicamente mientras está abierta.
3. `app.js` muestra las preguntas, valida un número positivo y calcula la distancia multiplicativa a la respuesta de referencia: `max(estimación / referencia, referencia / estimación)`. `1×` es una respuesta exacta. La puntuación diaria es la media de las tres distancias.
4. El navegador guarda la progresión y el bloc en `localStorage`. `community.js` crea y conserva un UUID anónimo por navegador. Al mostrar resultados, envía ese identificador y la estimación a `POST /api/answers`.
5. El servidor valida pregunta, identificador y cifra; calcula un hash SHA-256 del identificador; guarda una respuesta por pregunta y navegador en `runtime/answers.json`; y devuelve una distribución que excluye al propio jugador. `POST /api/daily-scores` compara la puntuación total de quienes completaron las tres preguntas. El histograma usa una escala logarítmica; la curva suavizada aparece a partir de cinco respuestas ajenas.

El identificador anónimo evita duplicados accidentales por navegador, pero no autentica a una persona ni impide que alguien genere otros identificadores. La muestra de respuestas solo se comparte entre usuarios del mismo proceso y del mismo archivo de datos. Si la API no está disponible, la interfaz conserva las estimaciones locales y muestra que la comparación comunitaria no está disponible.

## Contenido y recursos

Cada pregunta incluye una cifra de referencia, unidad, explicación del cálculo, supuestos y enlaces a fuentes. La investigación editorial vive en `research/`; las preguntas listas para jugar viven en `dist/questions.json`. Los scripts de investigación preparan contenido e imágenes, pero pueden depender de servicios externos y no forman parte de la ejecución habitual de la app. Las imágenes publicadas en `dist/assets/` tienen créditos y enlaces de licencia visibles en la interfaz; cualquier sustitución debe conservar una licencia compatible y su atribución.

## Límites de la implementación local

`runtime/answers.json` y `runtime/days/` son archivos del servidor, no una base de datos. El servidor escribe respuestas mediante un archivo temporal y cambio de nombre, lo que facilita la persistencia local, pero el diseño supone una única instancia con almacenamiento persistente. Una web puramente estática no puede atender `/api/answers` ni compartir respuestas. El sistema actual tampoco define migraciones, copias de seguridad, control de acceso de administración ni observabilidad de producción.

## Arquitectura prevista: Supabase y Vercel

La intención es desplegar la web en **Vercel** y utilizar **Supabase** como base de datos compartida. Esta migración está pendiente; no se deben describir estos servicios como activos hasta que haya código, configuración y pruebas que lo demuestren.

Propuesta de trabajo, sujeta a diseño y revisión antes de implementarla:

1. Mantener la web de `dist/` como frontend desplegado en Vercel. Convertir las rutas HTTP actuales en funciones o rutas de servidor compatibles con Vercel; `preview-server.mjs` puede seguir sirviendo de entorno local si comparte la lógica de negocio.
2. ~~Crear en Supabase un esquema para jornadas, preguntas y respuestas.~~ **Hecho el 9 de noviembre de 2026**: ver [docs/base-de-datos.md](docs/base-de-datos.md). La lógica de cálculo y validación se ejecuta en el servidor, sin exponer credenciales privilegiadas al navegador.
3. Sustituir las lecturas y escrituras de `runtime/` por consultas persistentes. Evitar depender del sistema de archivos de las funciones de Vercel para estado compartido. Planificar la migración de cualquier dato local que se decida conservar, con una revisión de privacidad previa.
4. Configurar variables de entorno, pruebas de integración con el nuevo almacenamiento y despliegues de prueba desde `preprod` (teniendo en cuenta que, mientras sigamos en el plan gratuito, preprod y producción comparten base de datos). Promover a producción desde `main` solo después de revisar y aceptar la PR correspondiente.

El proyecto de Supabase ya está creado (un único entorno, ver arriba) y tiene el esquema inicial, aún sin contenido ni conexión con la app; Vercel lo está empezando a configurar Álvaro, y no hay variables de entorno ni canalización de despliegue definidas aquí. Las decisiones concretas de tablas, políticas, región y despliegue deben documentarse cuando se implementen.

## Desarrollo y verificación

Se requiere Node.js con soporte para módulos ES, `fetch`, `crypto.randomUUID` y `AbortSignal.timeout`; Node.js 18 o posterior es una base razonable. No hay dependencias de npm ni paso de compilación.

```sh
node preview-server.mjs
# Abrir http://127.0.0.1:4173
node tests/community.test.mjs
```

El servidor escucha en `127.0.0.1:4173` por defecto. `HOST`, `PORT` y `ANSWERS_FILE` permiten ajustar el entorno local. La prueba usa un archivo temporal aislado y no modifica `runtime/answers.json`. El flujo de colaboración y las ramas están definidos en `AGENTS.md`.
