# 0029. «Cómo se calcula» como una cuenta por pasos

- **Estado:** propuesta (código en la rama `feat/calculo-por-pasos`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

## Contexto

Tras responder, el panel «Cómo se calcula» mostraba tres párrafos largos y la cuenta de referencia en una línea (`384400 × 1000 ÷ 0,12`). Costaba seguir el cálculo. Luis pidió que se pareciera a otros juegos de estimación: una frase corta, la cuenta en filas escalonadas separadas por una línea apenas visible y la cifra final en otro color.

## Decisión

- El panel muestra, por este orden: una frase de introducción, una tabla con el concepto a la izquierda y la cifra a la derecha (cada operación empieza por `×`, `÷` o `=`), y una última fila con el resultado en el color de acento (amarillo sobre el azul del resultado). Las filas se separan con una línea discontinua muy tenue.
- Los tres pasos del razonamiento siguen ahí, plegados en «Razonamiento completo». Supuestos, foto y fuentes no cambian.
- Las filas salen de un campo nuevo de cada pregunta, `calc`:

  ```json
  "calc": {
    "intro": "Una croqueta mide 12 cm; la Luna está a 384.400 km.",
    "rows": [
      {"label": "Distancia a la Luna", "value": "384.400 km"},
      {"label": "Metros en un kilómetro", "value": "× 1.000"},
      {"label": "Una croqueta", "value": "÷ 0,12 m"}
    ],
    "result": "Croquetas"
  }
  ```

  La cifra final no se escribe: el juego la pone a partir de `answer` y `unit` (3 cifras significativas, como en «Real»).
- Las 21 preguntas del piloto (`dist/questions.json` y `dist/questions.js`) llevan `calc` escrito a mano. El banco de plantillas (`content-engine.mjs`) lo construye solo: la gran magnitud entre lo que mide el objeto. La generación con OpenAI (`lib/generar.mjs`) lo pide en el esquema y lo valida (frase, resultado y de 2 a 6 filas).
- Si una pregunta no trae `calc` (las 276 del archivo y las jornadas ya guardadas), las filas se deducen de `referenceExpression`: «Partimos de», «Multiplicado por», «Dividido entre»… Si la cuenta tiene paréntesis o potencias, se enseña entera en una fila «La cuenta». La introducción es entonces el `heading` del razonamiento.

## Alternativas descartadas

- **Deducir siempre las filas de la cuenta.** No hace falta tocar el contenido, pero las filas no dicen qué es cada número («Dividido entre ÷ 7» frente a «Un jamón entero ÷ 7 kg»). Se queda solo como respaldo.
- **Quitar los tres pasos del razonamiento.** Son el texto que enseña a estimar; plegados no estorban.

## Consecuencias

- El archivo se ve con el respaldo automático, menos claro que el piloto. Escribir su `calc` queda en [mejoras](../mejoras/README.md).
- `calc` viaja con la pregunta a Supabase al publicar el contenido; no hay cambio de esquema.
