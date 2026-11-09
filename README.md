# Casi Casi

Semana piloto de un juego de estimaciones en español. Incluye siete días (del 9 al 15 de noviembre de 2026), con tres preguntas por día.

## Probar en local

```sh
node preview-server.mjs
```

Abre `http://127.0.0.1:4173`.

La interfaz usa HTML, CSS y JavaScript. El servidor Node, sin dependencias, sirve la web y reúne respuestas anónimas en `runtime/answers.json`, fuera del directorio público. No usa una base de datos. Las respuestas propias, notas e historial se guardan también en el navegador. Los resultados anteriores a la revisión del contenido se conservan bajo sus claves originales y no se mezclan con las nuevas preguntas.

El botón circular con icono de calculadora, situado a la izquierda de «Confirmar respuesta», abre el bloc. Durante la semana piloto se puede acceder a los siete días.

Cada pregunta tiene fuentes enlazadas, fecha de comprobación, operación y supuestos. La fotografía de Las Canteras es de Bengt Nyman, vía Wikimedia Commons, CC BY 2.0; se muestra completa, sin recorte. El análisis de las 100 preguntas de Fermi está en `research/analisis-100-preguntas.md`. Para repetir el scraping público: `node research/analyse.mjs`.

La distribución compara respuestas a la misma revisión de la pregunta y excluye al navegador actual. Usa un histograma logarítmico; la curva se suaviza a partir de cinco respuestas ajenas. Una muestra vacía se indica sin inventar datos. El identificador anónimo permite una respuesta por navegador; no autentica personas ni impide identidades falsas. La muestra se comparte únicamente entre clientes del mismo servidor. Un alojamiento exclusivamente estático no podrá recopilar respuestas: necesita ejecutar este servidor Node o un servicio compatible.

El servidor escucha por defecto en `127.0.0.1:4173`. `PORT`, `HOST` y `ANSWERS_FILE` son configurables para un alojamiento posterior. No se ha desplegado esta versión.

Prueba de integración (usa un archivo temporal aislado, no la muestra real):

```sh
node tests/community.test.mjs
```

## Documentación y colaboración

- [Arquitectura y stack](ARQUITECTURA.md): implementación actual y plan de migración a Supabase y Vercel.
- [Instrucciones para agentes](AGENTS.md): trabajo en ramas `feat/` o `fix/`, PR hacia `preprod` y promoción revisada a `main`.
- [Documentación del equipo](docs/README.md): decisiones, bitácora de servicios externos, ideas y mejoras pendientes.
