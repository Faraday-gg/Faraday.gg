# Casi Casi

Semana piloto de un juego de estimaciones en español. Incluye siete días (del 9 al 15 de noviembre de 2026), con tres preguntas por día.

## Probar en local

```sh
node preview-server.mjs
```

Abre `http://127.0.0.1:4173`.

La interfaz usa HTML, CSS y JavaScript. El servidor Node, sin dependencias, sirve la web y reúne respuestas anónimas en `runtime/answers.json`, fuera del directorio público, o en Supabase si se configuran sus variables (ver [Despliegue](#despliegue-vercel-y-supabase)). Las respuestas propias, notas e historial se guardan también en el navegador. Los resultados anteriores a la revisión del contenido se conservan bajo sus claves originales y no se mezclan con las nuevas preguntas.

El botón circular con icono de calculadora, situado a la izquierda de «Confirmar respuesta», abre el bloc. Durante la semana piloto se puede acceder a los siete días.

Cada pregunta tiene fuentes enlazadas, fecha de comprobación, operación y supuestos. La fotografía de Las Canteras es de Bengt Nyman, vía Wikimedia Commons, CC BY 2.0; se muestra completa, sin recorte. El análisis de las 100 preguntas de Fermi está en `research/analisis-100-preguntas.md`. Para repetir el scraping público: `node research/analyse.mjs`.

La distribución compara respuestas a la misma revisión de la pregunta y excluye al navegador actual. Usa un histograma logarítmico; la curva se suaviza a partir de cinco respuestas ajenas. Una muestra vacía se indica sin inventar datos. El identificador anónimo permite una respuesta por navegador; no autentica personas ni impide identidades falsas. La muestra se comparte entre los clientes que usan el mismo almacén: el mismo archivo local o la misma tabla de Supabase. Un alojamiento exclusivamente estático no podrá recopilar respuestas: necesita este servidor Node o la función de Vercel.

El servidor escucha por defecto en `127.0.0.1:4173`. `PORT`, `HOST` y `ANSWERS_FILE` son configurables.

Pruebas (usan archivos temporales y un Supabase simulado; no tocan datos reales):

```sh
node tests/community.test.mjs
node tests/editorial.test.mjs
node tests/vercel.test.mjs
```

## Despliegue: Vercel y Supabase

- Vercel sirve `dist/` como web estática y la API con una única función, `api/index.mjs`. `vercel.json` reescribe `/api/<ruta>` y `/daily-content.js` hacia ella y fija la región `fra1`, junto a la base de datos.
- Las respuestas se guardan en Supabase (proyecto *Faraday Game*, Frankfurt), mediante su API REST y sin SDK. El esquema está en `supabase/migrations/` y se explica en [docs/base-de-datos.md](docs/base-de-datos.md). Hay un solo entorno: local con variables, Preview y producción escriben en la misma base de datos.
- Variables en Vercel (Settings → Environment Variables): `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (clave `sb_secret_...`, solo servidor).
- Para probar en local contra Supabase: copia `.env.example` como `.env`, rellena la clave y arranca con `node --env-file=.env preview-server.mjs`.

## Documentación y colaboración

- [Arquitectura y stack](ARQUITECTURA.md): implementación actual, despliegue en Vercel y almacenamiento en Supabase.
- [Instrucciones para agentes](AGENTS.md): trabajo en ramas `feat/` o `fix/`, PR hacia `preprod` y promoción revisada a `main`.
- [Documentación del equipo](docs/README.md): decisiones, bitácora de servicios externos, ideas y mejoras pendientes.
