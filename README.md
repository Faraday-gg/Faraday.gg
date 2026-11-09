# Casi Casi

Juego diario de estimaciones en español. Incluye las 21 preguntas de la semana inicial y un banco adicional de 87 comparaciones con fuentes, sin repetir enunciados, para 36 ediciones diarias del 9 de noviembre al 14 de diciembre de 2026.

## Probar en local

```sh
node preview-server.mjs
```

Abre `http://127.0.0.1:4173`.

La interfaz usa HTML, CSS y JavaScript. El servidor Node, sin dependencias, sirve la web y reúne respuestas anónimas en `runtime/answers.json`, fuera del directorio público. No usa una base de datos. Las respuestas propias, notas e historial se guardan también en el navegador. Los resultados anteriores a la revisión del contenido se conservan bajo sus claves originales y no se mezclan con las nuevas preguntas.

El botón circular con icono de calculadora, situado a la izquierda de «Confirmar respuesta», abre el bloc. Durante la semana piloto se puede acceder a los siete días.

Cada pregunta tiene fuentes enlazadas, fecha de comprobación, operación y supuestos. La fotografía de Las Canteras es de Bengt Nyman, vía Wikimedia Commons, CC BY 2.0; se muestra completa, sin recorte. El análisis de las 100 preguntas de Fermi está en `research/analisis-100-preguntas.md`. Para repetir el scraping público: `node research/analyse.mjs`.

Las 21 preguntas iniciales tienen fotografías reales. Sus créditos y licencias están en `research/photo-manifest.json` y junto a cada imagen. Antes de responder solo se muestran el enunciado y la imagen; los tamaños, los datos y las condiciones del modelo se explican después. El razonamiento distingue una aproximación mental, una cuenta y la comprobación con las fuentes; el cálculo numérico de referencia se puede desplegar.

El campo de estimación inserta puntos de miles al escribir, mantiene el cursor al editar y acepta coma decimal. Los puntos se eliminan al interpretar el valor: `1.000.000,25` equivale a 1000000.25.

`content-engine.mjs` sirve una edición por fecha de Madrid. Después de la semana inicial, publica tres comparaciones nuevas por día desde el banco editorial; cada edición se guarda en `runtime/days` para mantenerla estable. La página comprueba el cambio de fecha cada minuto y al volver a la pestaña, conservando una partida ya abierta. El contenido es derivado de fuentes verificadas existentes, no de investigación web automática. El banco actual llega al 14/12/2026: hay que ampliarlo editorialmente para seguir a partir de ahí. Al agotarse se muestra «Retos en preparación»; no se repiten preguntas antiguas ni se inventan fuentes.

La puntuación diaria incluye un gráfico de fondo con el marcador del participante. `/api/daily-scores` calcula en el servidor la media de los tres factores y solo incluye en la comparación a otros identificadores que hayan respondido las mismas tres preguntas. Nunca acepta una puntuación total calculada por el cliente.

La distribución compara respuestas a la misma revisión de la pregunta y excluye al navegador actual. Usa un histograma logarítmico; la curva se suaviza a partir de cinco respuestas ajenas. Una muestra vacía se indica sin inventar datos. El identificador anónimo permite una respuesta por navegador; no autentica personas ni impide identidades falsas. La muestra se comparte únicamente entre clientes del mismo servidor. Un alojamiento exclusivamente estático no podrá recopilar respuestas: necesita ejecutar este servidor Node o un servicio compatible.

El servidor escucha por defecto en `127.0.0.1:4173`. `PORT`, `HOST` y `ANSWERS_FILE` son configurables para un alojamiento posterior. No se ha desplegado esta versión.

Prueba de integración (usa un archivo temporal aislado, no la muestra real):

```sh
node tests/community.test.mjs
node tests/editorial.test.mjs
```

## Documentación y colaboración

- [Arquitectura y stack](ARQUITECTURA.md): implementación actual y plan de migración a Supabase y Vercel.
- [Instrucciones para agentes](AGENTS.md): trabajo en ramas `feat/` o `fix/`, PR hacia `preprod` y promoción revisada a `main`.
