# Arquitectura y stack de Casi Casi

Este documento describe el código existente a 9 de noviembre de 2026 y la evolución prevista. La aplicación es un juego web de estimación en español: presenta tres preguntas por día, compara cada estimación con una referencia documentada y, cuando hay datos, muestra cómo respondieron otros jugadores.

## Estado actual

| Capa | Tecnología | Función |
| --- | --- | --- |
| Interfaz | HTML5, CSS y JavaScript del navegador, sin framework ni empaquetador | Presentación, navegación del juego, calculadora, notas y gráficos SVG. |
| API | Node.js con módulos ES y librerías estándar, sin dependencias de npm | `lib/api.mjs` genera el calendario y atiende respuestas y puntuaciones. La usan el servidor local (`preview-server.mjs`) y la función de Vercel (`api/index.mjs`). |
| Contenido | Supabase (`days`, `questions`, Storage `imagenes`); origen editorial en JSON y módulos JavaScript | La API sirve las jornadas, preguntas e imágenes desde Supabase. Se editan en el repositorio; Vercel los publica al desplegar producción (`scripts/publicar-contenido.mjs`). |
| Persistencia compartida | Supabase (Postgres) en Vercel; archivos JSON en `runtime/` en local | Respuestas anónimas por pregunta y jugador. `lib/stores.mjs` ofrece los dos almacenes con la misma interfaz. |
| Despliegue | Vercel: web estática de `dist/` y una función Node en `fra1` | Configurado en `vercel.json`. |
| Persistencia personal | `localStorage` del navegador | Estimaciones del jugador, identificador anónimo, notas e historial de cálculos, y el progreso: nivel, faradios, misiones y avatar. |
| Pruebas | `node:assert`, un proceso Node aislado y un Supabase simulado | Integración del servidor local, banco editorial y función de Vercel con Supabase. |

El esquema de Supabase está creado (ver [Entornos y servicios](#entornos-y-servicios) y [docs/base-de-datos.md](docs/base-de-datos.md)) y el código que lo usa desde el servidor local y desde Vercel está en el repositorio (ver [Despliegue](#despliegue-vercel-y-supabase)). El proyecto de Vercel `faraday-gg` está creado y producción sirve la versión actual desde el 9 de noviembre de 2026 (PR #13), con las dos variables de Supabase configuradas. No hay SDK de Supabase: se usa su API REST con `fetch`. El inicio de sesión opcional y el progreso de la cuenta se atienden desde el servidor; se describen más abajo.

## Entornos y servicios

Datos de referencia para todo el equipo (Luis y Álvaro). Aquí solo van identificadores públicos; **nunca** claves, tokens ni contraseñas. Las claves se consultan en el panel de Supabase y, cuando el código las necesite, irán en variables de entorno fuera de Git.

| Elemento | Valor |
| --- | --- |
| Nombre del juego | Casi Casi |
| Repositorio de GitHub | [`Faraday-gg/Faraday.gg`](https://github.com/Faraday-gg/Faraday.gg), **público**, en la organización gratuita `Faraday-gg` con Luis (`borgesinmas`) y Álvaro (`sistemavivacegroup`) como Owners. Rama por defecto: `preprod`. Antes estaba en `borgesinmas/Faraday.gg`, que GitHub redirige. Ver decisiones [0004](docs/decisiones/0004-repositorio-publico-en-organizacion.md) y [0006](docs/decisiones/0006-vercel-hobby-en-la-cuenta-de-alvaro.md). |
| Organización de Supabase | `Faraday.gg`, plan **FREE** |
| Proyecto de Supabase | `Faraday Game` |
| Referencia del proyecto (*project ref*) | `umiqvlccxxafvafroxii` |
| URL de la API | `https://umiqvlccxxafvafroxii.supabase.co` |
| Panel del proyecto | <https://supabase.com/dashboard/project/umiqvlccxxafvafroxii> |
| Rama de base de datos | `main` (*production*), la única que existe |
| Esquema `public` | Tablas `days`, `questions` y `answers` y función `daily_scores` (migración `20261109213854_esquema_inicial`). Contienen todo el contenido: 36 jornadas y 108 preguntas. Detalle en [docs/base-de-datos.md](docs/base-de-datos.md). |
| Storage | Almacén público `imagenes` con las 21 fotografías (migración `20261109222550_almacen_imagenes`). |
| Acceso | Solo desde el servidor con la clave secreta; la clave pública no da acceso a nada ([decisión 0002](docs/decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md)) |
| Conector MCP para agentes | `supabase-casi-casi` (apunta a este proyecto) |
| Proyecto de Vercel | `faraday-gg`, en la cuenta Hobby de Álvaro (`sistemavivacegroup`, ámbito `faraday-game`). Solo él accede al panel. Conectado a `Faraday-gg/Faraday.gg` con la app de Vercel instalada en la organización ([decisión 0006](docs/decisiones/0006-vercel-hobby-en-la-cuenta-de-alvaro.md)). |
| Producción (Vercel) | Rama `main` → <https://faraday-gg.vercel.app> |
| Preview de `preprod` | <https://faraday-gg-git-preprod-faraday-game.vercel.app>, que se actualiza con cada merge en `preprod`. Abierta sin iniciar sesión, como el resto de despliegues ([decisión 0007](docs/decisiones/0007-preview-de-vercel-sin-login.md)). |
| Funciones y variables | Región `fra1` (Frankfurt), según `vercel.json`. Variables en Production y Preview: `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (tipo *Secret*: su valor no se puede volver a leer en el panel). Ver [Despliegue](#despliegue-vercel-y-supabase). |
| Stripe (cobro de la suscripción) | **Sin cuenta todavía.** El código está en `lib/stripe.mjs` ([decisión 0077](docs/decisiones/0077-cobro-con-stripe.md)). Necesita, solo en Production, las variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_PRICE_ID`, y un destino de avisos en Stripe que apunte a `/api/stripe`. Sin ellas la suscripción no se puede contratar y todo lo demás funciona. No se ponen en Preview: comparte la base de datos con producción. |

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
  share-card.js          Tarjeta para stories: dibuja la imagen de 1080 × 1920 del resultado y la comparte o descarga (decisión 0032)
  share-card.css         Estilos de la vista previa de la tarjeta
  duel.js                Duelos 1 vs 1: marcador, vida, temporizador, avisos y sonidos (decisión 0023)
  reconectar.js, reconectar.css  «Reconectar a la partida»: aviso en la portada y el menú si tienes un duelo en marcha (decisión 0042)
  ligas.js, ligas.css    Ligas de amigos: tus ligas, clasificación semanal, invitación y resumen del lunes (decisión 0031)
  comunidad.js, comunidad.css  Preguntas de la comunidad: proponer y votar con faradios (decisión 0052)
  circuito.js, circuito.css  Circuito de amigos (referidos): enlace ?de=, invitación, premios, tablero de enchufes y corriente compartida (decisión 0038)
  avatar.js              Catálogo de piezas del avatar (hombre y mujer) y traducción de un look a lo que se dibuja (decisiones 0024, 0025 y 0028)
  avatar3d.js            Avatar en 3D: construye el personaje con Three.js, lo anima y lo pinta en todos los huecos de la página (decisiones 0025, 0028 y 0033)
  avatar-logos.js        Trazados de los logotipos de las marcas reales de la tienda, copiados de Simple Icons (decisión 0026)
  avatar.css             Estilos del avatar 3D, la tienda con rarezas y las animaciones nuevas del duelo
  armario.css            Armario y tienda del avatar: probador con el avatar siempre a la vista (fijo arriba en el móvil), pestañas con icono, filtro y cartas por rareza (decisión 0047)
  celebrations.js       Catálogo de 22 gestos, tramos de resultado, herencia y selección por modalidad (decisión 0096)
  celebrations.css      Selector de celebraciones y emotes dentro del armario
  progress.js            Nivel, faradios, racha, misiones, cofres, contador «Casi casi», cifras de las medallas y perfil con armario, tienda y vitrina (decisiones 0024, 0027, 0030 y 0035)
  medals.js              Medallas e insignias: catálogo, regla, dibujo, aviso y ceremonia (decisión 0035)
  medals.css             Estilos de las medallas (dibujo en CSS), la vitrina, la pestaña «Medallas», el aviso y la ceremonia
  pistas.js, pistas.css  Pistas: una por pregunta del reto, pagando faradios o viendo un anuncio; entre qué potencias de 10 está la respuesta y por dónde empezar (decisión 0039)
  ads.js                 Anuncios con recompensa: de momento un anuncio simulado con cuenta atrás; aquí se integrarán los reales (decisión 0039)
  chests.js              Cofres: los seis que hay, probabilidades y sorteo (decisiones 0027 y 0036)
  chest-open.js          Apertura de un cofre: animación, partículas, cartas y sonido
  chest.css              Estilos de los cofres y de su apertura
  sound.js               Sonido compartido (Web Audio, sin archivos): duelos, cofres (campanillas, reverberación y cama de fondo, decisión 0037), «¡Casi casi!» y reto diario
  casi.js                Momento «¡Casi casi!» (< 1,1×): regla, contador sin repeticiones, dato social y adorno de la tarjeta (decisión 0030)
  casi.css               Estilos del momento «¡Casi casi!» (sello, destello e indicador del duelo)
  reactions.js           Reto diario: el avatar junto a la tarjeta, sus gestos según el resultado, sonido y celebración al acertar (decisión 0033)
  continuations.js, continuations.css  Continuación común con anuncios de prueba y acceso directo Plus
  plus-offers.js, plus-offers.css  Oferta común de Plus por modalidad y registro para futuros juegos
  home.css               Portada con tarjetas de juego, escenario del avatar y panel social
  social.js              Invitaciones de amistad, presencia, actividad reciente y chat directo
  tendencias.js, tendencias.css  Traza la tendencia: dibujo de series históricas, comparación y avatar
  ascension.js, ascension.css  Respuestas raras: partida, reloj, resultados, clasificación y prácticas
  ascension-route.js, ascension-scene.js, ascension-scene.css  Agarres, montaña y avatar de Ascensión
  ascension-chart.js     Histograma, curva normal ajustada y marca del resultado propio
  archivo-vivo.js, archivo-vivo-rondas.js y archivo-vivo-visor.js  Fotografías históricas, puntuación local y visor 360° con el avatar en primera persona (decisiones 0108 y 0109)
  categories.js          Categorías de pregunta (deportes, comida…) con su icono
  questions.json         Preguntas piloto (origen editorial, se publica en Supabase)
  questions.js           Copia de respaldo de las preguntas piloto para el navegador
  assets/                Fotografías (origen; la web usa las de Supabase Storage) e icono
lib/ascension.mjs        Edición diaria, validación, reloj y clasificación de Ascensión
lib/ascension-store.mjs  Persistencia local y Supabase con versión optimista
content/ascension.json   Banco privado de 49 categorías y 3.410 respuestas, fuentes y rareza editorial
lib/continuaciones.mjs   Recibos, contadores por modalidad/día y retos extra de práctica (POST /api/continuacion)
lib/tendencias.mjs       Edición diaria y puntuación de Traza la tendencia
content/tendencias*.json Banco vigente de 108 gráficas y bancos anteriores para partidas iniciadas
lib/api.mjs              Lógica de la API (Request → Response), compartida
lib/stores.mjs           Almacenes de respuestas: archivo local y Supabase
lib/duelos.mjs           Duelos 1 vs 1: reglas, reloj y estado de cada duelo (POST /api/duelo)
lib/ligas.mjs            Ligas de amigos: miembros, clasificación semanal y resumen (POST /api/liga)
lib/comunidad.mjs        Preguntas de la comunidad y progreso en la cuenta (POST /api/comunidad y /api/progreso)
lib/referidos.mjs        Circuito de amigos: códigos, vínculos, conexiones y premios cobrados una vez (POST /api/referido)
lib/social.mjs           Panel de amigos, conexiones por enlace y chat privado (POST /api/social)
lib/social-store.mjs     Almacén local y Supabase, con control de versiones en el chat
api/index.mjs            Función de Vercel para toda la API
vercel.json              Directorio público, región, reescrituras y archivos de la función
preview-server.mjs       Servidor HTTP local: estáticos + lib/api.mjs
content/archivo/         Jornadas del archivo, una por archivo AAAA-MM-DD.json (9 ago – 8 nov 2026)
content/jornadas/        Jornadas escritas a mano tras el piloto, una por archivo AAAA-MM-DD.json (16 nov – 14 dic 2026, decisión 0046)
content/banco-base.json  Las 21 preguntas del piloto tal como se publicaron, base fija del banco editorial
content-engine.mjs       Calendario, archivo, piloto y banco editorial posterior al piloto
lib/publicar.mjs         Publicación incremental de jornadas, preguntas e imágenes en Supabase
lib/generar.mjs          Generación de la jornada de mañana con la API de OpenAI (decisión 0017)
lib/auth.mjs             Inicio de sesión con Supabase Auth desde el servidor (decisión 0022)
scripts/generar-jornada.mjs  La ejecuta a mano (--prueba para verla sin guardar)
scripts/publicar-contenido.mjs  La ejecuta (build de producción de Vercel o a mano)
research/                Fuentes, análisis y scripts de preparación editorial
tests/                   Integración del servidor local, contenido editorial, función de Vercel, publicación y generación
docs/                    Decisiones, bitácora, ideas, mejoras y base de datos (Markdown)
supabase/migrations/     Migraciones SQL de la base de datos, en orden de versión
runtime/                 Estado local generado; excluido de Git
```

`dist/` es el directorio público que sirve el servidor. El navegador carga `questions.js`, pide `daily-content.js` al servidor y después ejecuta `app.js` y `community.js`. `questions.json` también lo usa el servidor como fuente de las preguntas piloto. Por ello, cuando se edita el contenido piloto hay que mantener sincronizados los dos formatos o mejorar el proceso de generación.

## Recorrido de una partida

1. La API lee de Supabase las jornadas de los últimos 30 días con sus preguntas. Las más antiguas del archivo van en el calendario solo como resumen (`archive`: fecha, tema y categorías) y el navegador pide la jornada completa a `/api/day` al abrirla. El calendario también indica `first`, la fecha del reto Nº 1, con la que se numeran los retos. Si una fecha no está publicada allí o Supabase no responde, recurre a `content-engine.mjs`, que funciona así: calcula la fecha en la zona `Europe/Madrid`. Del 9 de agosto al 8 de noviembre de 2026 devuelve las jornadas de `content/archivo/`; para el piloto del 9 al 15 de noviembre, las de `dist/questions.json`; del 16 de noviembre al 14 de diciembre, las de `content/jornadas/`, escritas para jugadores de España y de Latinoamérica ([decisión 0046](docs/decisiones/0046-preguntas-de-latinoamerica.md)). Si falta alguna de esas fechas, utiliza un banco editorial finito para generar tres preguntas por día, con referentes distintos, hasta el 14 de diciembre de 2026. La generación es determinista: la misma fecha produce siempre la misma jornada. Cuando la generación diaria esté activada ([decisión 0017](docs/decisiones/0017-jornada-diaria-generada-con-openai.md), [pasos pendientes](docs/mejoras/activar-jornada-diaria.md)), cada fecha tendrá en Supabase una jornada `ia` escrita por OpenAI la noche anterior, que manda sobre el banco. En local, además, una jornada generada se conserva en `runtime/days/`; en Vercel no se escribe en disco.
2. `lib/api.mjs` expone `GET /api/calendar`, `GET /api/day?date=AAAA-MM-DD` y `GET /daily-content.js`. En local los sirve `preview-server.mjs` junto con `dist/`; en Vercel, la función `api/index.mjs`. El navegador refresca el calendario al volver a la pestaña y periódicamente mientras está abierta.
3. `app.js` muestra las preguntas, valida un número positivo y calcula la distancia multiplicativa a la respuesta de referencia: `max(estimación / referencia, referencia / estimación)`. `1×` es una respuesta exacta. La puntuación diaria es la media de las tres distancias.
4. El navegador guarda la progresión y el bloc en `localStorage`. `community.js` crea y conserva un UUID anónimo por navegador. Al cargar, llama a `POST /api/jugador`, que guarda ese UUID en la cookie propia `faraday_jugador` (`HttpOnly`, un año). Si `localStorage` se ha vaciado, la cookie devuelve el UUID y las respuestas guardadas de ese jugador, y el navegador rellena su progreso ([decisión 0009](docs/decisiones/0009-jugador-sin-registro-con-cookie.md)). Sin registro, sin IP y sin huella del dispositivo. Al mostrar resultados, envía el identificador y la estimación a `POST /api/answers`.
   Con sesión iniciada (opcional, [decisión 0022](docs/decisiones/0022-inicio-de-sesion-desde-el-servidor.md)), `POST /api/jugador` devuelve el jugador enlazado a la cuenta y su progreso. El inicio de sesión va por `/api/auth/` (`estado`, `codigo`, `verificar`, `salir`, `google` y `callback`), que `lib/auth.mjs` resuelve con la API REST de Supabase Auth; la sesión queda en las cookies `HttpOnly` `faraday_sesion` y `faraday_refresco`. El navegador no habla con Supabase.
5. El servidor valida pregunta, identificador y cifra; calcula un hash SHA-256 del identificador; guarda una respuesta por pregunta y navegador (en `runtime/answers.json` o en Supabase); y devuelve una distribución que excluye al propio jugador. `POST /api/daily-scores` compara la puntuación total de quienes completaron las tres preguntas. El histograma usa una escala logarítmica; la curva suavizada aparece a partir de cinco respuestas ajenas.

El identificador anónimo evita duplicados accidentales por navegador, pero no autentica a una persona ni impide que alguien genere otros identificadores. La muestra de respuestas se comparte entre quienes usan el mismo almacén: el mismo archivo local o la misma tabla de Supabase. Si la API no está disponible, la interfaz conserva las estimaciones locales y muestra que la comparación comunitaria no está disponible.

## Traza la tendencia

El jugador completa el tramo oculto de tres series y puede repasar los resultados del día. La edición cambia a medianoche de Madrid y el avatar utiliza los gestos de resultado del reto diario. El banco vigente reúne 108 gráficas de doce categorías. Se prepara con los scripts de `research/` y se carga en el servidor. En el navegador, el aviso de inicio señala el tramo pendiente. El trazo usa diez muestras por periodo y amortigua el temblor en píxeles de pantalla. Una tarjeta HTML dentro del marco SVG acompaña al punto con periodo, estimación y unidad; el periodo se subraya y se destaca su columna. La tarjeta respeta los bordes, se recoloca al cambiar el ancho y se retira al revelar ([decisión 0104](docs/decisiones/0104-trazo-suave-y-lectura-cercana.md)). Se puede ajustar con el puntero o por fecha antes de revelar.

`POST /api/tendencias` admite `estado`, `revelar`, `trazos`, `preparar-extra` y `activar-extra`. Usa la identidad de la sesión o la cookie del jugador. Guarda el primer trazo de cada ronda y calcula los puntos con el error absoluto medio dividido por la escala de la gráfica. Al revelar devuelve la serie real y su atribución. Después, `trazos` pagina las respuestas ajenas de la misma gráfica, fecha y entorno. Cuando todavía no hay respuestas ajenas, la primera página devuelve 200 ejemplos calculados a partir del historial visible.

En local se guarda en `runtime/tendencias.json`. Vercel usa `trend_answers`, `trend_traces` y `trend_replays` en Supabase, con ámbitos separados para Preview y producción. Las cuatro migraciones de Traza se aplicaron el 19 de noviembre de 2026 con autorización expresa de Álvaro; la API de preprod responde correctamente. Cada anuncio de prueba completado en el plan gratuito desbloquea otra partida de tres gráficas. Plus abre cada partida extra directamente. El servidor numera los desbloqueos por fecha y consulta la diaria y la última partida extra. Ver [decisión 0091](docs/decisiones/0091-reanudar-trazos-y-partidas-extra.md) y [decisión 0094](docs/decisiones/0094-revelacion-y-trazos-individuales.md).

El resumen recoge el premio diario con `POST /api/progreso`, acción `premio-traza`. `createTrendPrizes` recalcula los puntos desde las tres respuestas persistidas; `lib/comunidad.mjs` paga una vez en el libro contable y concede el cofre con control de versión de estadísticas. Los extras no dan premios. Plus mantiene los mismos premios y ofrece partidas sin anuncios, con precio y disponibilidad del cobro existente. Ver [decisión 0095](docs/decisiones/0095-plus-y-premios-de-traza.md).

## Continuación por modalidad

`lib/continuaciones.mjs` atiende `POST /api/continuacion` con identidad de cuenta o cookie del servidor. Mantiene recibos y estado por entorno, jugador, día de Madrid y modalidad: primer anuncio completado de 15 s y siguientes de 60 s en la simulación, sin máximo. `dist/continuations.js` coordina preparación, diálogo común de `ads.js`, confirmación y apertura; cancelar no incrementa el contador. Plus accede directamente. Las actualizaciones filtran la versión anterior y los recibos permiten reintentar sin otro anuncio.

Cada anuncio de una variante de duelo suma una partida al cupo compartido. Traza consume un recibo al desbloquear otras tres gráficas. El reto diario ofrece tres preguntas anteriores como práctica, conserva las respuestas en el servidor y reutiliza el juego y sus explicaciones; se excluye de respuestas oficiales, ranking y toda emisión de premios. Archivo y Ascensión conservan las prácticas libres. Los límites económicos y de nivel no cambian.

En local se usa `runtime/continuaciones.json`. En Vercel se usa `continuation_states`, tabla privada con RLS y permisos exclusivos de servidor, aplicada el 19 de noviembre de 2026 con autorización expresa de Álvaro en el único Supabase. Si falta, la cuota base de duelos sigue disponible y el componente informa que no puede cargar anuncios. El temporizador valida una simulación; un proveedor real debe confirmar la recompensa y fijar la duración de su creatividad. [Decisión 0099](docs/decisiones/0099-anuncios-para-continuar.md).

## Oferta de Plus por modalidad

`dist/plus-offers.js` reúne los contextos de reto diario, Traza y variantes de duelo y admite registros de nuevas modalidades. Renderiza tarjetas o contenedores declarativos, actualiza precio/disponibilidad desde `Progress.planOffer()` y abre el panel común mediante `Progress.openPlan()`. Los duelos consultan su cupo real con la acción `limite` de `/api/duelo`, tanto en portal como al finalizar; los rechazos estructurados actualizan el módulo sin insertarlo durante una ronda. El reto diario solo lo muestra en su resumen, conservando el archivo gratuito. El componente no cambia las reglas del servidor. [Guía de integración](docs/modalidades-y-plus.md) y [decisión 0097](docs/decisiones/0097-modulo-plus-por-modalidad.md).

## Duelos

Dos o tres jugadores responden a la vez la misma pregunta. Cada uno empieza con 6000 de vida y una respuesta vale de 0 a 5000 puntos según su proximidad a la cifra real. En el 1v1 normal, el 1v1 clasificatorio y el 1v1v1, quien puntúa por debajo del primero pierde la diferencia por el multiplicador del líder. Cada jugador empieza en ×1 y suma 0,5 al ganar una ronda en solitario, con efecto desde la siguiente pregunta. En un empate en cabeza se aplica el mayor multiplicador de los líderes al daño a terceros. La práctica con Faraday-bot usa un multiplicador común que sube al avanzar de ronda. Hay 3 minutos por pregunta, que bajan a 30 segundos al recibir la primera respuesta. [Decisión sobre los multiplicadores](docs/decisiones/0083-multiplicadores-personales-en-duelos.md).

- `lib/duelos.mjs` guarda el estado del duelo y lo pone al día con el reloj en cada petición. La única ruta es `POST /api/duelo`, con el campo `action`: `buscar` (partida rápida), `crear` y `unirse` (reto con código), `estado`, `activo` (¿tengo un duelo en marcha?, decisión 0042), `responder`, `bot`, `salir` y `revancha`.
- `dist/duel.js` pregunta el estado una vez por segundo y pinta el marcador, con la vida y el multiplicador de cada jugador, el temporizador, los avisos y los sonidos. No hay conexiones abiertas. La cifra real y la respuesta del rival llegan al navegador al terminar la ronda.
- El estado se guarda en memoria en local y en la tabla `duels` de Supabase en Vercel. La migración `20261112005952_duelos` se aplicó el 12 de noviembre de 2026; si la tabla fallara, la ruta responde 503 sin afectar al resto.
- El perfil (apodo y avatar), el nivel, la XP y la racha se guardan en `localStorage`.

## Ligas de amigos

Grupos de hasta 15 personas con una clasificación semanal (lunes a domingo, hora de Madrid) hecha con la distancia media del reto diario ([decisión 0031](docs/decisiones/0031-ligas-de-amigos.md)). Se crean con un nombre y se comparten con el enlace `?liga=CÓDIGO`.

- `lib/ligas.mjs` tiene las reglas y la ruta `POST /api/liga`, con el campo `action`: `mias`, `crear`, `unirse`, `ver`, `salir`, `perfil` y `resumen`.
- Las puntuaciones las pone el servidor: cuando alguien completa el reto **de hoy** (`POST /api/answers` en la última pregunta, o `POST /api/daily-scores`), `lib/api.mjs` calcula su distancia media con las respuestas guardadas y la apunta en «resultados diarios». El archivo no cuenta. Un día cerrado sin jugar cuenta como la peor distancia de la liga ese día, como poco 10×.
- `dist/ligas.js` pinta la lista, la clasificación, la invitación y, al abrir la app en una semana nueva, el resumen de la anterior. El apodo es el de los duelos y el avatar, el del armario.
- En local se guarda en `runtime/ligas.json`, junto a `answers.json`; en Vercel, en las tablas `leagues`, `league_members` y `daily_results`. La migración `20261112010003_ligas` se aplicó el 12 de noviembre de 2026; si Supabase fallara, la ruta responde 503 y la web dice «Las ligas no están disponibles ahora mismo».

## Preguntas de la comunidad

Los jugadores con cuenta proponen preguntas (50 ≈) y votan las de los demás (10 ≈ por voto). Las 3 más votadas de la semana salen el lunes en el reto, con el nombre y el avatar de su autor ([decisión 0052](docs/decisiones/0052-preguntas-de-la-comunidad.md)).

- `lib/comunidad.mjs` tiene las reglas (`RULES`), las rondas y las rutas `POST /api/comunidad` (`action`: `ronda`, `proponer`, `votar`) y `POST /api/progreso` (`leer`, `guardar`). Las dos necesitan sesión iniciada, salvo `ronda`.
- La ronda R es el lunes en que se publica y se vota del domingo R−8 al sábado R−2. El domingo a las 00:01, `generateDay` (`lib/generar.mjs`) llama a `communityDay`. Esta función resuelve las 6 más votadas con OpenAI y búsqueda web, toma las 3 primeras válidas (completa con el banco editorial si faltan) y premia al autor. Si no hay ninguna, se genera la jornada de siempre.
- Al proponer, `openaiModerator` (`gpt-5-mini`, sin búsqueda web) filtra la pregunta. Sin `OPENAI_API_KEY` solo hay comprobaciones básicas.
- **Progreso en la cuenta:** con sesión iniciada, `dist/progress.js` guarda el progreso también en el servidor (`player_progress`). El saldo de faradios lo lleva el servidor: el navegador manda cuánto cambió, con tope diario para lo que se gana.
- En local se guarda en `runtime/comunidad.json`; en Vercel, en las tablas `player_progress`, `community_proposals` y `community_votes` (migración `20261115162316_preguntas_comunidad`, aplicada el 15 de noviembre de 2026).
- El reto enseña el autor con `authorLine` (`dist/app.js`), encima de la pregunta y en el resultado.

## Circuito de amigos (referidos)

Quien invita y quien es invitado ganan los dos ([decisión 0038](docs/decisiones/0038-circuito-de-amigos.md)).

- **Enlaces.** Cada jugador tiene un código y todos los enlaces que se comparten llevan `?de=CÓDIGO`: resultado, tarjeta para stories, duelos y ligas. Los añade `Circuito.link(url)`.
- **Vínculo.** `lib/referidos.mjs` atiende `POST /api/referido` (acciones `codigo`, `abrir`, `estado` y `reclamar`). Solo vincula a jugadores nuevos, sin respuestas guardadas.
- **Conexión.** Un invitado es «conexión» cuando juega el reto del día en 3 días distintos de sus primeros 14. Se calcula con las mismas `daily_results` de las ligas.
- **Premios.** Los marca el servidor (una vez cada uno) y los entrega `progress.js`:
  - el invitado recibe un cofre Rayo y la gorra Enchufe, y 150 ≈ al conectarse;
  - quien invita recibe un cofre Rayo por conexión (50 ≈ desde la 11.ª) y piezas exclusivas o un cofre Tormenta en 1, 3, 5 y 10 conexiones.
- **Corriente compartida.** Durante 30 días, +15 de batería a los dos cada día que juegan ambos.
- **Dónde se guarda.** En local, en `runtime/referidos.json`. En Vercel, en las tablas `referral_codes` y `referrals`; la migración `20261112140721_referidos` se aplicó el 12 de noviembre de 2026; si Supabase fallara, la ruta responde 503 y la pantalla dice que el Circuito no está disponible.

## Avatar, faradios y misiones

Desde la [PR #142](https://github.com/Faraday-gg/Faraday.gg/pull/142), integrada en `preprod`, el armario permite elegir entre 22 gestos existentes para cada nivel de resultado. `dist/celebrations.js` centraliza el catálogo, los siete tramos de distancia del reto y los cinco niveles por puntos de Traza. Hay selección general y excepciones para reto diario, archivo, duelos de dos y tres, clasificatorias, Traza y Ascensión, además del saludo de portada y el premio de cofre. La vista previa utiliza el avatar vestido y respeta la preferencia de reducir movimiento. Detalle en la [decisión 0096](docs/decisiones/0096-celebraciones-por-resultado.md).

`Progress.reaction(mode, cue, options)` resuelve el gesto. Las preferencias viven en `state.celebrations`, dentro de `casi-casi:progreso`, y viajan con la sincronización existente de la cuenta. `Avatar.render` admite una reacción inicial y `Avatar3D.react` actualiza un avatar ya montado. Los duelos envían `gestures` para sus tres modalidades; `lib/duelos.mjs` limita los campos y el navegador receptor los contrasta con el catálogo. Los rivales reciben la selección al entrar en la partida. No hay migración ni ruta nueva.

Los gestos actuales siguen incluidos para todos. La selección cosmética no acredita la propiedad de futuros emotes de pago: la tienda, cofres y mercado de nuevos gestos requieren inventario comprobado en el servidor. Ascensión incorpora seis niveles de celebración y una secuencia propia de escalada y llegada, descrita en la [decisión 0098](docs/decisiones/0098-ascension-respuestas-raras.md).

Cada jugador tiene un avatar en 3D de estética de calle (`dist/avatar3d.js`, con Three.js cargado desde una CDN; catálogo en `dist/avatar.js`: ropa, pantalón, zapatillas, cabeza, peinado, gafas, cuello, extras, gesto y piel; [decisión 0025](docs/decisiones/0025-avatar-3d.md)). El avatar puede ser de hombre o de mujer, cada uno con su catálogo de piezas, y se anima con una postura base y un repertorio de gestos ([decisión 0028](docs/decisiones/0028-avatar-de-mujer-y-animaciones.md)). Parte de la ropa y las zapatillas son de marcas reales, con su logotipo (`dist/avatar-logos.js`), sin licencia de las marcas ([decisión 0026](docs/decisiones/0026-marcas-reales-en-la-tienda.md)). Cada jugador tiene también un progreso (`dist/progress.js`): nivel y experiencia, faradios (≈, la moneda del juego), racha diaria y misiones diarias y semanales ([decisión 0024](docs/decisiones/0024-avatar-faradios-y-misiones.md)). Los faradios se ganan jugando y se emplean en cosméticos y las funciones de la economía documentadas en `docs/decisiones/`.

- `app.js` y `duel.js` avisan con eventos del documento (`faraday:answer`, `faraday:day`, `faraday:duel`) y `progress.js` reparte la experiencia, los faradios y el avance de las misiones.
- Los seis cofres ([decisión 0027](docs/decisiones/0027-cofres.md), ampliada por la [0036](docs/decisiones/0036-seis-cofres.md)) se ganan jugando o se compran con faradios. `chests.js` tiene las reglas y el sorteo, `progress.js` los guarda y reparte los premios, y `chest-open.js` enseña la apertura. Con cuenta, el servidor cobra la compra, sortea y concede los premios; sin cuenta se resuelve en el navegador ([decisión 0063](docs/decisiones/0063-cofres-en-el-servidor.md)).
- Momento «¡Casi casi!» ([decisión 0030](docs/decisiones/0030-momento-casi-casi.md)): una respuesta a menos de 1,1× celebra en la tarjeta (`casi.js`, `casi.css`, `Sound.casi`) y dice qué porcentaje de los demás la clavó, con el campo `near` que devuelve `/api/answers` (nunca con la muestra simulada). `progress.js` lleva el contador, una vez por pregunta, y a los 10 desbloquea gratis la Sudadera «Casi casi» (pieza con `casi: 10`, como las de nivel). En los duelos solo hay un indicador, que no cuenta. `community.js` avisa de cada distribución cargada con el evento `faraday:distribucion`.
- Medallas e insignias ([decisión 0035](docs/decisiones/0035-medallas-e-insignias.md)): 59 logros (12 medallas con cuatro niveles y 11 insignias). `medals.js` tiene el catálogo, la regla y el dibujo; `progress.js` lleva las cifras, guarda lo conseguido y pinta la vitrina y la pestaña «Medallas» del perfil. `ligas.js` avisa con el evento `faraday:liga`. La medalla destacada viaja con el avatar (campo `badge`) y se ve junto al nombre en los duelos y en las ligas.
- Sin cuenta, el progreso se guarda en `localStorage` (clave `casi-casi:progreso`). Con cuenta se sincroniza con `player_progress`; saldo, premios e inventario tienen validaciones en el servidor (decisiones 0057–0065). La suscripción utiliza el flujo de la decisión 0077 cuando está configurado.
- En los duelos, el navegador envía los identificadores de las piezas del avatar; el servidor los limpia y se los pasa al rival, sin comprobar que se hayan comprado.

## Contenido y recursos

Cada pregunta incluye una categoría (`category`, ver `dist/categories.js` y [decisión 0008](docs/decisiones/0008-categorias-y-archivo.md)), una foto solo si ayuda a imaginar la escala (entre el 15 y el 20 % de las preguntas, [decisión 0013](docs/decisiones/0013-preguntas-de-cultura-general.md)), una cifra de referencia, unidad, explicación del cálculo, supuestos y enlaces a fuentes. La investigación editorial vive en `research/`; las preguntas se escriben en `dist/questions.json` y `content-engine.mjs` y se publican en Supabase, junto con las fotos de `dist/assets/` (a Storage), **automáticamente en cada despliegue de producción de Vercel**: `vercel.json` ejecuta `scripts/publicar-contenido.mjs --vercel` como `buildCommand`. Solo sube lo que ha cambiado y no actúa en las Preview, que comparten base de datos con producción. Los scripts de investigación preparan contenido e imágenes, pero pueden depender de servicios externos y no forman parte de la ejecución habitual de la app. Las imágenes publicadas en `dist/assets/` tienen créditos y enlaces de licencia visibles en la interfaz; cualquier sustitución debe conservar una licencia compatible y su atribución.

## Límites del almacenamiento local

`runtime/answers.json` y `runtime/days/` son archivos del servidor, no una base de datos. El servidor escribe respuestas mediante un archivo temporal y cambio de nombre, lo que sirve para desarrollo, pero supone una única instancia con disco persistente. En Vercel se usa Supabase.

## Despliegue: Vercel y Supabase

**Vercel** sirve `dist/` como web estática y toda la API con una única función, `api/index.mjs`, como recomienda Vercel para funciones sin framework. `vercel.json` define:

- `outputDirectory: dist`. Solo se publica la web: no se exponen `runtime/`, `research/`, `docs/` ni el código del servidor.
- Reescrituras de `/api/<ruta>`, `/api/auth/<acción>` y `/daily-content.js` hacia `/api?route=<ruta>`.
- Región `fra1` (Frankfurt), la misma que la base de datos. En el plan Hobby solo se admite una región.
- `includeFiles` para que la función lleve `dist/questions.json`.

**Supabase** guarda las respuestas con el esquema descrito en [docs/base-de-datos.md](docs/base-de-datos.md) (migración `20261109213854_esquema_inicial`):

- El calendario, las preguntas y las imágenes salen de Supabase (ver [docs/base-de-datos.md](docs/base-de-datos.md#uso-desde-la-app)). `answers` exige que la pregunta exista en `questions`; si una jornada aún no estuviera publicada, la API la publica al recibir su primera respuesta.
- La función accede con la clave secreta (`sb_secret_...`, rol `service_role`) por la API REST de Supabase, sin SDK ([decisión 0002](docs/decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md)). Pagina las lecturas porque PostgREST limita cada respuesta a 1000 filas.
- Una respuesta repetida se ignora en la base de datos (única por `question_id` y `player_hash`). Si la cifra cambia, la API responde 409, como en local.
- Preprod y producción comparten base de datos ([decisión 0001](docs/decisiones/0001-supabase-un-solo-entorno.md)). Las respuestas enviadas desde un despliegue Preview de Vercel se mezclan con las reales.

Variables de entorno de la función, iguales en Production y Preview (solo por nombre; los valores, en el panel de Vercel): `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Solo en Production, para la generación diaria: `OPENAI_API_KEY`, `CRON_SECRET` y, opcional, `OPENAI_MODEL`. La misma `OPENAI_API_KEY` filtra las preguntas de la comunidad; opcional, `OPENAI_MODERATION_MODEL` (por defecto `gpt-5-mini`).

**Generación diaria** ([decisión 0017](docs/decisiones/0017-jornada-diaria-generada-con-openai.md)): a las 00:01 de Madrid, `pg_cron` de Supabase (migración `20261110120000_jornadas_generadas`) llama con `pg_net` a `/api/generar-dia`, y el cron de Vercel (`vercel.json`, 23:30 UTC) hace de respaldo. La ruta exige `Authorization: Bearer CRON_SECRET` y crea la jornada de mañana con `lib/generar.mjs`: 3 preguntas escritas por OpenAI con búsqueda web (un día de cada dos, una de actualidad), validadas y guardadas en Supabase con `source = 'ia'`. Si la jornada ya existe, no hace nada. Solo sustituye jornadas del banco sin respuestas y `lib/publicar.mjs` no toca las generadas. `maxDuration` de la función: 300 s.

La rama de producción de Vercel es `main`, aunque la rama por defecto del repositorio sea `preprod`. Producción se actualiza cada vez que `preprod` pasa a `main`. Una variable de entorno nueva solo llega a los despliegues posteriores: tras añadirla hay que volver a desplegar. Las jornadas futuras del banco se calculan al vuelo, sin estado: un cambio en el banco editorial cambia también las fechas aún no jugadas.

El repositorio es público y está en la organización `Faraday-gg`. Por eso, en el plan Hobby se despliegan los commits de cualquiera de los dos, aunque el proyecto sea de Álvaro. Ver [decisión 0006](docs/decisiones/0006-vercel-hobby-en-la-cuenta-de-alvaro.md).

Pendiente: copias de seguridad y retención de datos, y observabilidad más allá de los registros de Vercel.

## Desarrollo y verificación

Se requiere Node.js con soporte para módulos ES, `fetch`, `crypto.randomUUID` y `AbortSignal.timeout`; Node.js 18 o posterior es una base razonable. No hay dependencias de npm ni paso de compilación.

```sh
node preview-server.mjs
# Abrir http://127.0.0.1:4173
node tests/community.test.mjs
node tests/editorial.test.mjs
node tests/vercel.test.mjs
node tests/publicar.test.mjs
node tests/generar.test.mjs
node tests/duelos.test.mjs
# Qué cambiaría en Supabase (no escribe nada; la publicación real la hace Vercel):
node --env-file=.env scripts/publicar-contenido.mjs --prueba
```

El servidor escucha en `127.0.0.1:4173` por defecto. `HOST`, `PORT` y `ANSWERS_FILE` permiten ajustar el entorno local. Con `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (por ejemplo, `node --env-file=.env preview-server.mjs`, a partir de `.env.example`) usa Supabase en lugar del archivo. Las pruebas usan archivos temporales y un Supabase simulado: no modifican `runtime/answers.json` ni la base de datos. El flujo de colaboración y las ramas están definidos en `AGENTS.md`.

## Ascensión

`POST /api/ascension` obtiene la identidad desde la cuenta o la cookie HttpOnly existente, calcula su hash y ejecuta `lib/ascension.mjs`. El servidor determina categorías, plazos y puntos; ignora identidad y puntuación enviadas por el navegador. Una edición combina cuatro categorías familiares, dos de descubrimiento y una difícil, con siete temas distintos. Se priorizan preguntas que no salieron recientemente y las prácticas evitan las de ese día cuando hay alternativas. La API acepta automáticamente una errata si hay una única respuesta más cercana y dentro de la tolerancia. Cada partida guarda una copia privada de sus categorías y una huella de edición: una actualización editorial conserva los intentos abiertos y separa su clasificación.

`lib/ascension-store.mjs` persiste en archivo local y en `public.ascension_runs` en Vercel. La clave `(scope, day, player_hash, game)` identifica la diaria (`game=0`) y prácticas sucesivas. Inserción única y actualización condicionada a `version` impiden que dos pestañas puntúen o avancen dos veces. Los plazos vencidos se resuelven en la siguiente petición, sin depender de memoria de una instancia. La fecha utiliza Madrid; una partida del día anterior da paso a la edición nueva. `scope=preview` separa los resultados de pruebas de `publico` dentro del único Supabase compartido.

El banco se incluye expresamente en la función de `vercel.json`, fuera de los archivos públicos. No hay consultas a fuentes externas ni generación de respuestas durante el juego. La API revela solo la categoría activa, resultados resueltos y hasta cinco ejemplos posteriores. La clasificación compara únicamente diarias completadas de la misma fecha, edición y entorno; muestra empates, percentil y distribución de otros jugadores. Sin otros resultados, lo dice expresamente.

La interfaz reutiliza avatar, ropa, sonido y selección de celebraciones del armario. `ascension-route.js` sitúa presas y repisas para Directa y Travesía. `ascension-scene.js` usa esas coordenadas para dibujar la pared y la cuerda, mover la cámara y orientar manos, codos, piernas y pies del avatar 3D. Cada tramo termina en la repisa, donde se ejecuta el emote elegido. Con movimiento reducido, se muestra la llegada inmediatamente. La vía, el salto de la animación y la repetición se resuelven localmente. [Decisión 0106](docs/decisiones/0106-escalada-con-agarres.md) · [investigación de escalada](research/ascension-escalada.md).

La migración `20261119055720_ascension` está aplicada con autorización expresa de Álvaro. La tabla usa RLS y acceso exclusivo del servidor. Las fuentes de las preguntas se documentan en [research/ascension-fuentes.md](research/ascension-fuentes.md).

Desde la [decisión 0100](docs/decisiones/0100-ascension-anuncios-y-curva.md), Ascensión registra su contexto en `dist/continuations.js` y usa el servicio común `lib/continuaciones.mjs`: primer anuncio completado de 15 segundos por día, siguientes de 60. `preparar-practica` prepara el recibo; `practica` lo consume para una única partida. Los recibos y contadores se guardan en `state.continuationAds`, dentro del JSON privado existente, mediante un adaptador con CAS; no depende de el almacén de anuncios de otros modos. `/api/continuacion` enruta este contexto al adaptador privado. La versión optimista protege preparaciones simultáneas, reinicios y reintentos. Una práctica abierta se recupera sin otro anuncio. La cuenta Plus se confirma en el servidor y evita este paso; el navegador no puede declarar la suscripción.

El resumen combina las barras de las puntuaciones ajenas con una curva normal aproximada, ajustada a su media y desviación típica exactas. La API añade esos dos estadísticos agregados desde dos resultados ajenos y con dispersión positiva ([decisión 0101](docs/decisiones/0101-curva-con-muestra-pequena.md)). `ascension-chart.js` comparte la escala vertical entre barras y curva, y marca la puntuación propia. No inventa jugadores ni presenta el ajuste como una prueba de normalidad.
