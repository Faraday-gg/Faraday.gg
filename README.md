# Casi Casi

Juego diario de estimaciones en español (Faraday.gg): tres preguntas al día, cada una con su categoría e icono. El archivo empieza el 9 de agosto de 2026 (reto Nº 1) y se puede jugar cualquier día anterior.

## Probar en local

```sh
node preview-server.mjs
```

Abre `http://127.0.0.1:4173`.

La interfaz usa HTML, CSS y JavaScript. El servidor Node, sin dependencias, sirve la web y reúne respuestas anónimas en `runtime/answers.json`, fuera del directorio público, o en Supabase si se configuran sus variables (ver [Despliegue](#despliegue-vercel-y-supabase)). Las respuestas propias, notas e historial se guardan también en el navegador. Los resultados anteriores a la revisión del contenido se conservan bajo sus claves originales y no se mezclan con las nuevas preguntas.

El botón circular con icono de calculadora, situado a la izquierda de «Confirmar», abre el bloc. El juego va dentro de una tarjeta con el color de cada paso: primero solo la pregunta y, al responder, el multiplicador, tu cifra frente a la real y la distribución; «Cómo se calcula» abre la explicación, la foto y las fuentes. Los pasos de arriba (1, 2, 3, Total) permiten volver a cualquier pregunta respondida. En «El archivo» se puede jugar cualquier día ya publicado; los días futuros no aparecen.

Cada pregunta tiene fuentes enlazadas, fecha de comprobación, operación y supuestos. La fotografía de Las Canteras es de Bengt Nyman, vía Wikimedia Commons, CC BY 2.0; se muestra completa, sin recorte. El análisis de las 100 preguntas de Fermi está en `research/analisis-100-preguntas.md`. Para repetir el scraping público: `node research/analyse.mjs`.

Mientras una pregunta tiene menos de 30 respuestas reales, el gráfico muestra una muestra simulada en el navegador, marcada como «simulación»; nunca se guarda ([decisión 0014](docs/decisiones/0014-distribucion-simulada-y-cifras.md)). La distribución real compara respuestas a la misma revisión de la pregunta y excluye al navegador actual. Usa un histograma logarítmico; la curva se suaviza a partir de cinco respuestas ajenas. Una muestra vacía se indica sin inventar datos. El identificador anónimo permite una respuesta por navegador; no autentica personas ni impide identidades falsas. La muestra se comparte entre los clientes que usan el mismo almacén: el mismo archivo local o la misma tabla de Supabase. Un alojamiento exclusivamente estático no podrá recopilar respuestas: necesita este servidor Node o la función de Vercel.

El servidor escucha por defecto en `127.0.0.1:4173`. `PORT`, `HOST` y `ANSWERS_FILE` son configurables.

Pruebas (usan archivos temporales y un Supabase simulado; no tocan datos reales):

```sh
node tests/community.test.mjs
node tests/editorial.test.mjs
node tests/vercel.test.mjs
node tests/publicar.test.mjs
node tests/generar.test.mjs
```

## Despliegue: Vercel y Supabase

- Vercel sirve `dist/` como web estática y la API con una única función, `api/index.mjs`. `vercel.json` reescribe `/api/<ruta>` y `/daily-content.js` hacia ella y fija la región `fra1`, junto a la base de datos.
- Las respuestas se guardan en Supabase (proyecto *Faraday Game*, Frankfurt), mediante su API REST y sin SDK. El esquema está en `supabase/migrations/` y se explica en [docs/base-de-datos.md](docs/base-de-datos.md). Hay un solo entorno: local con variables, Preview y producción escriben en la misma base de datos.
- Variables en Vercel (Settings → Environment Variables): `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (clave `sb_secret_...`, solo servidor).
- Para probar en local contra Supabase: copia `.env.example` como `.env`, rellena la clave y arranca con `node --env-file=.env preview-server.mjs`.

## Contenido en Supabase

Las jornadas, preguntas e imágenes se sirven desde Supabase. Se editan en `content/archivo/` (una jornada por archivo, del 9 de agosto al 8 de noviembre de 2026), `dist/questions.json` (piloto), `content-engine.mjs` y `dist/assets/`. Para añadir o revisar jornadas del archivo: `node research/foto-commons.mjs` busca y descarga fotos de Commons solo con licencia libre y `node research/validar-archivo.mjs DESDE HASTA` comprueba cada jornada. **No hay que publicarlas a mano**: al fusionar en `main`, el despliegue de producción de Vercel sube a Supabase solo lo que ha cambiado (`buildCommand` de `vercel.json`). Para revisar qué cambiaría o publicar sin esperar a Vercel:

```sh
node --env-file=.env scripts/publicar-contenido.mjs --prueba
```

Detalle en [docs/base-de-datos.md](docs/base-de-datos.md).

## Documentación y colaboración

- [Arquitectura y stack](ARQUITECTURA.md): implementación actual, despliegue en Vercel y almacenamiento en Supabase.
- [Instrucciones para agentes](AGENTS.md): trabajo en ramas `feat/` o `fix/`, PR hacia `preprod` y promoción revisada a `main`.
- [Documentación del equipo](docs/README.md): decisiones, bitácora de servicios externos, ideas y mejoras pendientes.
