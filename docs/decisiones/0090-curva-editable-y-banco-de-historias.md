# 0090. Curva editable y preguntas con historia

- **Estado** — Implementada.
- **Fecha** — 2026-11-18.
- **Autores** — Álvaro, con Codex.
- **Actualiza** — [Decisión 0087](0087-graficas-y-partida-extra.md).

## Referencia editorial

Se revisaron los resultados de la edición anterior y se jugaron las cinco rondas de la edición del 18 de noviembre de [Extraplot](https://guessdash.com/extraplot). Sus temas mezclaban menciones de una palabra en libros, población de una ciudad, búsquedas de una bebida, lanzamientos de videojuegos musicales y una medida por grupo de edad.

Antes de jugar se muestra el objeto medido, una unidad concreta y un tramo visible con el que formar una hipótesis. Al revelar se comparan las curvas y se explica qué cambió con fechas, magnitudes y una fuente. Se adopta el formato con series y textos propios de Faraday.

## Decisión

- Se conserva el dibujo libre. Agarrar la línea existente entra en modo de ajuste y permite desplazar un punto en los dos ejes. El cambio se suaviza en las muestras vecinas, respeta el primer dato real y actualiza los valores que puntúa la API. El editor por fecha sigue disponible.
- Las 102 rondas nuevas cambian las visitas a artículos por hechos que el jugador puede imaginar y estimar. Hay seis grupos de 17: alimentos, Fórmula 1, nombres, exoplanetas, Mundiales y huracanes. La pregunta define antes de jugar qué se mide, con unidad y fechas. Tras revelar se muestran la historia, las magnitudes y la atribución del dato. Se alternan grupos para mezclar temas dentro de cada partida.
- Los Mundiales usan etiquetas con el año real de la edición. Cada separación representa el paso de una edición a la siguiente.
- Las partidas con una ronda guardada conservan la selección del banco original con el que empezaron, también en la partida extra. El banco activo se incluye en el despliegue junto con los anteriores. La consulta al proveedor se hace al preparar el contenido, fuera del juego.

## Fuentes y reproducción

`research/preparar-tendencias-historias.py` combina las descargas de [USDA ERS](https://www.ers.usda.gov/data-products/food-availability-per-capita-data-system), [F1DB](https://github.com/f1db/f1db), [SSA](https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data), [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/docs/API_PSCompParsColumns.html), [OpenFootball](https://github.com/openfootball/worldcup.json) y [NOAA](https://www.nhc.noaa.gov/data/). La descarga directa de SSA respondió 403 y se usó la copia del archivo nacional en [hackerb9/ssa-baby-names](https://github.com/hackerb9/ssa-baby-names), que cubre hasta 2020. Los registros de nombres se agregan por año y la ventana de cada gráfica excluye años sin dato publicado.
