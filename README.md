# Casi Casi

«¿A cuánto te acercas?» es el lema de Faraday.gg, un juego de preguntas y estimaciones en español. Juega tres preguntas nuevas cada día, compite en Duelos, dibuja en Traza la tendencia o busca respuestas poco comunes en Ascensión. El archivo empieza el 9 de agosto de 2026 (reto Nº 1).

## Probar en local

```sh
node preview-server.mjs
```

Abre `http://127.0.0.1:4173`.

La interfaz usa HTML, CSS y JavaScript. El servidor Node, sin dependencias, sirve la web y reúne respuestas anónimas en `runtime/answers.json`, fuera del directorio público, o en Supabase si se configuran sus variables (ver [Despliegue](#despliegue-vercel-y-supabase)). Las respuestas propias, notas e historial se guardan también en el navegador. Los resultados anteriores a la revisión del contenido se conservan bajo sus claves originales y no se mezclan con las nuevas preguntas.

El botón circular con icono de calculadora, situado a la izquierda de «Confirmar», abre el bloc. El juego va dentro de una tarjeta con el color de cada paso: primero solo la pregunta y, al responder, el multiplicador, tu cifra frente a la real y la distribución; «Cómo se calcula» abre la explicación, la foto y las fuentes. Los pasos de arriba (1, 2, 3, Total) permiten volver a cualquier pregunta respondida. En «El archivo» se puede jugar cualquier día ya publicado; los días futuros no aparecen.

Cada pregunta tiene fuentes enlazadas, fecha de comprobación, operación y supuestos. La fotografía de Las Canteras es de Bengt Nyman, vía Wikimedia Commons, CC BY 2.0; se muestra completa, sin recorte. El análisis de las 100 preguntas de Fermi está en `research/analisis-100-preguntas.md`. Para repetir el scraping público: `node research/analyse.mjs`.

Mientras una pregunta tiene menos de 30 respuestas reales, el gráfico muestra una muestra simulada en el navegador, marcada como «simulación»; nunca se guarda ([decisión 0014](docs/decisiones/0014-distribucion-simulada-y-cifras.md)). La distribución real compara respuestas a la misma revisión de la pregunta y excluye al navegador actual. Usa un histograma logarítmico; la curva se suaviza a partir de cinco respuestas ajenas. Una muestra vacía se indica sin inventar datos. El identificador anónimo permite una respuesta por navegador; no autentica personas ni impide identidades falsas. Se guarda también en una cookie propia (`faraday_jugador`) para recuperar el progreso si el navegador vacía `localStorage`; no se usan la IP ni la huella del dispositivo. La muestra se comparte entre los clientes que usan el mismo almacén: el mismo archivo local o la misma tabla de Supabase. Un alojamiento exclusivamente estático no podrá recopilar respuestas: necesita este servidor Node o la función de Vercel.

El servidor escucha por defecto en `127.0.0.1:4173`. `PORT`, `HOST` y `ANSWERS_FILE` son configurables.

Pruebas (usan archivos temporales y un Supabase simulado; no tocan datos reales):

```sh
node tests/community.test.mjs
node tests/editorial.test.mjs
node tests/vercel.test.mjs
node tests/publicar.test.mjs
node tests/generar.test.mjs
node tests/duelos.test.mjs
node tests/cofres.test.mjs
node tests/casi.test.mjs
node tests/auth.test.mjs
node tests/ligas.test.mjs
node tests/comunidad.test.mjs
node tests/medallas.test.mjs
node tests/pistas.test.mjs
node tests/celebraciones.test.mjs
node tests/ascension.test.mjs
node tests/ascension-api.test.mjs
node tests/ascension-banco.test.mjs
node tests/ascension-anuncios.test.mjs
node tests/ascension-chart.test.mjs
```

## Amigos y ligas

Abre el icono de personas en la cabecera. Desde el panel puedes entrar en tus ligas y al Circuito de amigos. Con tu cuenta puedes activar un apodo social, copiar tu enlace de amistad y aceptar invitaciones. Tus amigos pueden ver tu presencia y la fecha en que jugaste recientemente si compartes actividad. El chat directo funciona entre amistades activas y conserva hasta 60 mensajes por conversación. El modo local con sesión simulada se prueba con `node tests/social.test.mjs`. Consulta la [decisión 0102](docs/decisiones/0102-portada-avatar-y-amigos.md).

## Probar las celebraciones del avatar

Abre el perfil → Armario → «Celebraciones y emotes». Elige un gesto para cada resultado en «Todos los modos» y usa «Ver» para probarlo con tu avatar. El selector de modalidad permite excepciones para reto diario, archivo, duelos de dos y tres, clasificatorias, Traza y Ascensión. Cada hueco puede heredar la elección general, recuperar el original o quedarse sin gesto. Se guarda automáticamente; al recargar conserva la configuración y, con cuenta, utiliza la sincronización del perfil.

Para comprobar la herencia, elige Robot en «Todos los modos / ¡Casi casi!» y Dab en «Archivo / ¡Casi casi!»: el reto diario usa Robot y el archivo usa Dab. Los rivales de los duelos reciben la configuración al entrar en la partida. `node tests/celebraciones.test.mjs` comprueba los umbrales, la herencia, los datos inválidos y el catálogo. La venta de nuevos emotes sigue pendiente; consulta la [decisión 0096](docs/decisiones/0096-celebraciones-por-resultado.md). Ascensión utiliza esta misma selección con seis niveles propios.

## Probar Ascensión

Con `node preview-server.mjs`, abre «Ascensión» en la portada o en «Juega» del menú. Son siete categorías y 25 segundos por respuesta. La rareza editorial suma 10, 30, 60, 85 o 100 puntos y el avatar escala diez metros por punto, hasta 7.000 m. Un nombre desconocido permite reintentar sin reiniciar el reloj; una errata inequívoca propone una corrección que debes confirmar. Después de cada respuesta puedes descubrir ejemplos de otros niveles y consultar las fuentes.

La edición diaria cambia a medianoche de Madrid: termina antes. La clasificación usa solo primeras partidas diarias terminadas de la misma edición y entorno; las prácticas quedan fuera y se desbloquean al terminar: una por anuncio de prueba (primero de 15 segundos, siguientes de 60), sin límite diario, o sin anuncios con Plus. Retomar una práctica abierta no exige otro anuncio. El gráfico incluye barras reales, curva normal ajustada desde dos resultados ajenos distintos y marca de tu puntuación. Cerrar o recargar conserva el progreso en el servidor y el tiempo sigue corriendo. «Personalizar» abre el armario en Ascensión para elegir un gesto por nivel de puntuación. La ropa y los emotes no cambian los puntos.

El banco propio contiene 2.637 respuestas en 28 categorías. Se distribuye únicamente en la función del servidor, fuera de `dist/`. Fuentes, licencias y reproducción editorial en [research/ascension-fuentes.md](research/ascension-fuentes.md). Las pruebas `ascension`, `ascension-api`, `ascension-banco`, `ascension-anuncios` y `ascension-chart` cubren reglas, reloj, concurrencia, HTTP, persistencia, catálogo, desbloqueo con anuncios y curva. En local se guarda en `ascension.json` junto a `ANSWERS_FILE`; Vercel usa la tabla privada `ascension_runs`, cuya [migración](docs/base-de-datos.md#ascension) ya está aplicada con autorización de Álvaro. No requiere nuevas variables ni dependencias.

## Probar las ofertas de Plus

El portal y el resumen de los duelos muestran el módulo común con el cupo real compartido entre 1v1, tres jugadores, clasificatorias y bot. Al agotarse, la oferta se destaca y permite abrir el plan desde el perfil. Traza reutiliza la tarjeta conservando el anuncio gratuito; el resumen del reto diario invita a explorar Plus y ofrece retos extra de práctica. El archivo sigue accesible gratis. No se cambian precios ni límites económicos; cada anuncio completado añade una partida al cupo de duelos.

`node tests/plus-offers.test.mjs` comprueba el componente. Para cualquier nueva modalidad, tenga o no un límite, sigue [Modalidades y Plus](docs/modalidades-y-plus.md).

## Probar anuncios para continuar

Al agotar el cupo de duelos o terminar la diaria de Traza o del reto de estimación aparece «También puedes seguir gratis», junto a Plus. El primer anuncio de prueba de cada modalidad y día de Madrid dura 15 s; los siguientes, 60 s, sin límite de repeticiones. Cierra uno a medias: no desbloquea una partida ni incrementa el contador. Complétalo y continúa. Recarga una práctica pendiente: debe ofrecer retomarla sin otro anuncio. Plus permite acceder directamente. Las variantes de duelo comparten cupo y créditos, pero tienen contadores de duración independientes.

El reto extra conserva el avatar, preguntas y explicaciones; no modifica el resultado oficial, faradios, experiencia, racha o misiones. Archivo y prácticas de Ascensión siguen gratuitos sin anuncios. Ejecuta `node tests/anuncios.test.mjs` y `node tests/continuaciones.test.mjs`. La [migración de continuación](supabase/migrations/20261119111409_anuncios_continuacion.sql) ya está aplicada en el Supabase compartido con autorización de Álvaro; las API de preprod están verificadas. Los anuncios son simulados: el proveedor real aún no está integrado.

## Probar Traza la tendencia

Con el mismo servidor local, abre «Traza la tendencia» en la portada o en «Juega» del menú lateral. El aviso «Dibuja el resto» marca el tramo pendiente. Arrastra el punto amarillo para empezar o reanudar el dibujo. Las guías muestran el periodo y la estimación en los ejes. Agarra la línea para ajustarla o usa el editor por fecha. Al revelar se dibuja primero el dato real y luego todos los trazos de los demás a la vez. Si todavía no hay otras respuestas se muestran 200 ejemplos marcados como simulados. Al terminar la diaria o cualquier partida extra, «Ver anuncio de prueba y jugar» desbloquea otras tres gráficas. La oferta de Faraday Plus destaca las partidas sin anuncios y mantiene visible la alternativa gratuita. Con cuenta, el resumen recoge entre 10 y 35 faradios por la diaria y, desde 2.700 puntos, un cofre Chispa como máximo por semana.

Ejecuta `node tests/premios-traza.test.mjs` para comprobar los premios y sus reintentos. `node scripts/simular-traza.mjs` compara su efecto en la economía con escenarios sintéticos. Ejecuta `node tests/tendencias.test.mjs` para verificar las 108 gráficas de la rotación, los límites de pendiente, las partidas extra y las comparaciones. Las cuatro migraciones de [Traza la tendencia](docs/base-de-datos.md#traza-la-tendencia) están aplicadas y su API de Vercel responde correctamente.

## Despliegue: Vercel y Supabase

- Vercel sirve `dist/` como web estática y la API con una única función, `api/index.mjs`. `vercel.json` reescribe `/api/<ruta>` y `/daily-content.js` hacia ella y fija la región `fra1`, junto a la base de datos.
- Las respuestas se guardan en Supabase (proyecto *Faraday Game*, Frankfurt), mediante su API REST y sin SDK. El esquema está en `supabase/migrations/` y se explica en [docs/base-de-datos.md](docs/base-de-datos.md). Hay un solo entorno: local con variables, Preview y producción escriben en la misma base de datos.
- Variables en Vercel (Settings → Environment Variables): `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (clave `sb_secret_...`, solo servidor).
- Para probar en local contra Supabase: copia `.env.example` como `.env`, rellena la clave y arranca con `node --env-file=.env preview-server.mjs`.
- Para ver la jornada que generaría OpenAI para mañana, sin guardar nada: añade `OPENAI_API_KEY` al `.env` y ejecuta `node --env-file=.env scripts/generar-jornada.mjs --prueba` ([decisión 0017](docs/decisiones/0017-jornada-diaria-generada-con-openai.md)).

## Contenido en Supabase

Las jornadas, preguntas e imágenes se sirven desde Supabase. Se editan en `content/archivo/` (una jornada por archivo, del 9 de agosto al 8 de noviembre de 2026), `dist/questions.json` (piloto), `content/jornadas/` (una jornada por archivo, del 16 de noviembre al 14 de diciembre; se validan con `node research/validar-jornadas.mjs DESDE HASTA`), `content-engine.mjs` y `dist/assets/`. Para añadir o revisar jornadas del archivo: `node research/foto-commons.mjs` busca y descarga fotos de Commons solo con licencia libre y `node research/validar-archivo.mjs DESDE HASTA` comprueba cada jornada. **No hay que publicarlas a mano**: al fusionar en `main`, el despliegue de producción de Vercel sube a Supabase solo lo que ha cambiado (`buildCommand` de `vercel.json`). Para revisar qué cambiaría o publicar sin esperar a Vercel:

```sh
node --env-file=.env scripts/publicar-contenido.mjs --prueba
```

Para comprobar las operaciones de referencia del banco en local, ejecuta `node research/auditar-preguntas.mjs`. Los resultados del cotejo y el criterio para contrastar las fuentes están en la [auditoría editorial](docs/mejoras/auditoria-preguntas.md).

Detalle en [docs/base-de-datos.md](docs/base-de-datos.md).

## Documentación y colaboración

- [Arquitectura y stack](ARQUITECTURA.md): implementación actual, despliegue en Vercel y almacenamiento en Supabase.
- [Instrucciones para agentes](AGENTS.md): trabajo en ramas `feat/` o `fix/`, PR hacia `preprod` y promoción revisada a `main`.
- [Documentación del equipo](docs/README.md): decisiones, bitácora de servicios externos, ideas y mejoras pendientes.
