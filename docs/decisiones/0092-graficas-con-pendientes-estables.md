# 0092. Gráficas con pendientes más estables

- **Estado** — Implementada.
- **Fecha** — 2026-11-18.
- **Quién** — Álvaro, con Codex.
- **Actualiza** — [Decisión 0090](0090-curva-editable-y-banco-de-historias.md).

## Criterio de selección

Se revisan las muestras consecutivas del tramo que se dibuja y se compara su pendiente con la del tramo visible que llega al corte. Cada diferencia vertical se divide entre la altura de la escala que ve el jugador.

- Un paso del tramo oculto recorre como máximo el 25 % de la altura.
- Cuando dos pasos consecutivos tienen signos contrarios, al menos uno recorre como máximo el 11,5 %. Así puede haber cimas y valles graduados.
- La diferencia media absoluta entre pendientes consecutivas queda por debajo del 8,5 % de la altura.

Se conservan 28 series originales con sus valores y escala. Otras 14 preguntas rescatan temas del banco anterior con una medida distinta y explícita, como podios promediados en cinco temporadas, actividad de huracanes en siete temporadas, goles en tres Mundiales o el total de exoplanetas desde el primer año de la gráfica. Cada punto usa observaciones publicadas y los periodos o reglas figuran en la pregunta.

| Medida del tramo dibujable | Rotación anterior | Rotación auditada |
|---|---:|---:|
| Gráficas que cumplen los tres límites | 28 de 102 | 108 de 108 |
| Mayor cambio vertical entre puntos | 84,47 % | 23,12 % |
| Mayor giro con dos pasos en sentidos opuestos, medido por el menor de los dos | 82,00 % | 10,72 % |
| Cambio medio de pendiente, promediado sobre todas las gráficas | 21,78 % | 4,59 % |

## Rotación y fuentes

La edición combina tres categorías distintas. Hay ciclos mensuales, series por años, por bienios y por ediciones deportivas. Entre los temas nuevos hay temperaturas del Retiro, horas de sol de Igeldo, palabras como «cassette» o «karaoke» en libros, teléfonos fijos, población urbana, visitas a parques nacionales y CO₂ de Mauna Loa. La API mantiene el banco anterior cuando existe una respuesta de la jornada y durante sus partidas extra. El primer envío desde una pestaña abierta el día del cambio conserva también la edición con la que se dibujó.

Para regenerar el resultado, coloca las descargas del 18 de noviembre de 2026 en una carpeta y ejecuta `python3 research/preparar-tendencias-estables.py CARPETA --auditar > content/tendencias-estables.json`. La auditoría se imprime por separado y el generador no consulta las fuentes durante el juego.

- `aemet-{estación}.html` es la página oficial de las normales mensuales 1981–2010. Descarga una por cada código distinto de `WEATHER`, usando el parámetro `l`. [Ejemplo Retiro](https://www.aemet.es/es/serviciosclimaticos/datosclimatologicos/valoresclimatologicos?l=3195).
- `ngram-{inventos,cultura,ambiente}.json` contiene el resultado de `/ngrams/json` para la lista `WORDS`. Se pueden repartir las palabras entre los tres archivos. Usa los años 1920–2019, `corpus=eng_2019` y `smoothing=0`. El generador toma la media de dos frecuencias anuales y la convierte a apariciones por millón. [Corpus y licencia](https://storage.googleapis.com/books/ngrams/books/datasetsv3.html).
- `wdi-{indicador}.zip` es el ZIP de `https://api.worldbank.org/v2/en/indicator/{indicador}?downloadformat=csv` para cada código de `WDI_SERIES`. [Ejemplo de telefonía fija](https://data.worldbank.org/indicator/IT.MLT.MAIN.P2).
- `nps-total.html` es la [tabla anual de visitas del National Park Service](https://www.nps.gov/aboutus/visitation-numbers.htm). `co2-annmean-mlo.csv` es la [media anual de Mauna Loa](https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv), de NOAA GML y Scripps.
