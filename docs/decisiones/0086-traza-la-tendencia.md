# 0086. Traza la tendencia

- **Estado:** implementado en la rama `feat/traza-la-tendencia`, pendiente de revisión.
- **Fecha:** 2026-11-17.
- **Quién:** Álvaro, con Codex.
- **Actualización:** [decisión 0087](0087-graficas-y-partida-extra.md) para el trazo, el avatar, el banco vigente y la partida extra.

## Contexto

Álvaro pidió ampliar las opciones para seguir jugando después del reto diario. La referencia para la jugabilidad fue Extraplot. Faraday ya tenía avatar, colores, botones y preguntas de estimación con fuentes que sirven como referencia editorial y visual.

## Decisión

- Una partida diaria de tres gráficas, idéntica para todos en cada entorno. El día cambia a medianoche de Madrid. Con cuenta se usa el jugador de la sesión, y sin cuenta se usa la cookie propia de Faraday.
- Cada ronda muestra una serie anual hasta un año de corte. Se completa el tramo por arrastre o editando valores año a año con el teclado. Al revelar se guarda el primer trazo aceptado y aparece la curva real, el error medio en la unidad original, la puntuación y una explicación con la fuente y los datos anuales.
- Cada gráfica vale hasta 1.000 puntos. Se calcula la media de las diferencias absolutas de los años ocultos y se divide por la altura de la escala. Error cero equivale a 1.000 puntos y un error medio de media escala o más equivale a cero.
- La comparación social traza la media anual de los intentos reales de otros jugadores de esa edición. Se muestra a partir de tres respuestas ajenas. La muestra de las Preview se guarda separada de la de producción.
- El avatar del jugador se mantiene en la cabecera fija de la modalidad. Se reutilizan los gestos del reto diario, de celebración a queja, según los puntos de la ronda.
- El banco inicial tiene 102 series de 34 indicadores en español. Se partió del estilo editorial de Casi Casi, con pregunta directa, unidades explícitas, referentes de España y Latinoamérica, y contexto y fuentes al revelar. Los valores vienen de la descarga WDI del Banco Mundial del 16 de noviembre de 2026 y mantienen la atribución de cada indicador. El preparador de `research/` conserva solo tramos anuales completos, convierte unidades documentadas y comprueba la licencia declarada en el catálogo.
- Las partidas extra quedan pendientes de decisión sobre anuncio recompensado o suscripción.

## Alternativas descartadas

- La mecánica de referencia se estudió jugando en la interfaz pública de [Extraplot](https://guessdash.com/extraplot). La interacción, el banco, la puntuación y las vistas se implementaron para Faraday.
- Una muestra simulada daría una referencia desde el primer intento, a costa de representar curvas inventadas como comparación de jugadores. Se eligió esperar a una muestra de tres.
- Calcular los resultados en el navegador exigiría enviarle la continuación antes de tiempo. El banco se carga en el servidor y la API revela el tramo oculto de cada ronda tras guardar la respuesta. El repositorio es público y permite consultar el banco fuera del juego.

## Consecuencias

- El banco vive en `content/tendencias.json` y los 34 tríos se repiten en orden. Al ampliar o actualizar el banco, debe mantenerse la selección y escala de las ediciones que se estén jugando.
- En local, el servidor guarda el progreso en `runtime/tendencias.json` junto al archivo de respuestas. En las Preview y en producción hace falta aplicar la migración `20261117120000_tendencias` autorizada por el responsable. La modalidad se puede probar en local con varios perfiles antes de aplicarla.
