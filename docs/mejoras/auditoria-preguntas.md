# Auditoría editorial del banco de preguntas

- **Estado:** cribado completo del repositorio; primera tanda de correcciones; pendiente contrastar el banco completo de Supabase y terminar la revisión de fuentes.
- **Fecha de la primera pasada:** 17 de noviembre de 2026.

## Alcance y resultados

| Conjunto | Qué se pudo revisar | Resultado inicial |
| --- | --- | --- |
| Banco editorial de `preprod` | 384 preguntas, 128 jornadas (276 de archivo, 21 de piloto y 87 escritas tras el piloto). | Las 384 fórmulas coinciden con su respuesta con tolerancia del 0,05 %. En el archivo faltaban 276 cuentas por pasos y 238 preguntas citaban al menos una página de Wikipedia. |
| Enlaces del repositorio | 539 URL de texto distintas, sin contar créditos de fotos. | 512 dieron 200, una 203, seis 404 y 20 quedaron sin confirmar por restricciones, error de servidor o espera agotada. Un 200 no confirma que la página respalde la cifra. |
| API pública de Vercel | 128 fechas entre el 09/08 y el 14/12. Devolvió 185 preguntas: 60 fechas completas, tres parciales y 65 vacías en la captura. | 96 preguntas compartían id con `preprod`; en 11 de ellas la respuesta y el enunciado eran distintos. De las 185, 15 fórmulas de plantillas, con datos redondeados, no reproducían la respuesta publicada. |

La API puede servir tanto Supabase como el respaldo del despliegue. Las 185 preguntas son lo que devolvió **la API**, no un recuento de filas en Supabase. No se consultaron tablas privadas ni respuestas de jugadores. Quedan fuera del inventario las preguntas de Supabase que la API no devolvió y las propuestas aún no publicadas.

## Qué se corrige en esta tanda

Se revisan manualmente 24 preguntas: 13 del archivo, seis del piloto y cinco de las jornadas escritas. Se preservan sus ids, revisiones, respuestas y fotos. Algunos títulos delimitan mejor el modelo que ya usa la cifra, como la masa de una piedra de Stonehenge repartida entre jugadores de fútbol; ese cociente no explica cómo se arrastró la piedra. Otros ejemplos:

- **Cartagena:** [Colombia Travel](https://colombia.travel/es/cartagena/las-murallas-de-cartagena) documenta 11 km conservados. Los 1,70 m entre las manos son una elección del juego. Si el tramo por persona baja a 1,50 m, la cuenta sube de unas 6.470 a unas 7.330 personas.
- **Elefante:** los 150 kg son el extremo superior de un intervalo del [zoológico de San Diego](https://animals.sandiegozoo.org/animals/elephant), no un máximo biológico. Para las manzanas se reemplaza la URL que devolvía 404 por el [informe del USDA](https://ers.usda.gov/sites/default/files/_laserfiche/publications/47570/8043_tb1927.pdf) con 182 g por porción.
- **Carolina Reaper:** [la escala Scoville mide concentración](https://ucanr.edu/sites/default/files/2026-04/Peppers%202026.04.pdf). El cociente estima cantidades totales de capsaicinoides solo en el modelo de frutos de igual masa; no predice la sensación en la boca.
- **Velas de cumpleaños:** el peso de envío incluye embalaje; 5,1 kg es un techo aproximado, no una masa de cera medida.
- **A380:** el [certificado EASA](https://www.easa.europa.eu/en/downloads/7309/en) detalla 324.339 L utilizables con los sistemas incluidos. Los 320.000 L del juego son una aproximación; no se presentan como cifra exacta.
- **ELT:** los 39 m son el diámetro exterior que publica el [ESO](https://elt.eso.org/mirror/M1/). Un disco ideal de ese diámetro y el área colectora del espejo real son dos cosas distintas.

De los seis enlaces con 404 en la captura, cinco se han sustituido: plátano del USDA, rendimiento de la naranja, porción de manzana, LEGO y Airbus. Queda por encontrar la ficha primaria de la empanada de carne (`archivo-2026-09-24-2`) que respalde ambos datos: 333 kcal por 100 g y 130 g por pieza. Las respuestas HTTP 403 y 429 se revisan en navegador antes de dar el enlace por roto.

## Diferencias relevantes antes de publicar

La publicación compara preguntas por id. Antes de publicar a producción hay que reconciliar estos ids con un inventario autorizado de Supabase. No se puede deducir de la API pública si cada pregunta tiene respuestas asociadas. La tabla de abajo compara el contenido que vio la API con el repositorio; no autoriza a sustituir registros.

| Id | En la API pública | En `preprod` |
| --- | --- | --- |
| `archivo-2026-10-06-1` | Promociones de Salamanca | Promociones de Oxford |
| `archivo-2026-10-06-2` | Campos de fútbol en Doñana | Erupciones de Old Faithful |
| `archivo-2026-10-06-3` | Metros de escalera al año | Ascensos equivalentes al Everest |
| `archivo-2026-10-07-3` | Longitud del ADN frente a la distancia al Sol | Longitud del ADN frente a la distancia a Plutón |
| `archivo-2026-10-09-1` | Horas por las pistas de Sierra Nevada | Horas para marcar los goles de los Mundiales |
| `archivo-2026-10-09-2` | Pisos por segundo del teleférico de Fuente Dé | Pisos por segundo de un ascensor |
| `archivo-2026-10-11-1` | Concorde de Madrid a Gran Canaria | Concorde de Madrid a Buenos Aires |
| `archivo-2026-10-11-2` | Flamencos en Fuente de Piedra | Viajes a la Luna equivalentes al vuelo vital de un charrán |
| `archivo-2026-10-11-3` | Litros de sangre que pasan por el hígado | Bañeras de sangre que pasan por el hígado |
| `archivo-2026-11-06-1` | Minutos de telégrafo óptico | Correos enviados por segundo |
| `archivo-2026-11-06-2` | Días de marcha por la Vía de la Plata | Días de marcha por la Vía Apia |

Las 15 fórmulas publicadas con error afectan a las plantillas de superficie de **Las Canteras, el Guernica y el Bernabéu**, cruzadas con cinco objetos: hoja A4, tarjeta bancaria, servilleta, ficha de dominó y carátula de vinilo. Por ejemplo, 155.000 ÷ 0,001 da 155 millones de fichas, pero el resultado publicado ronda los 124 millones, coherente con el área sin redondear de 0,00125 m². Si las plantillas siguen en Supabase, se corrige su explicación con la cifra sin redondear; el objetivo del juego ya se calculó con ella.

Otro ejemplo que requiere decidir cómo versionar la puntuación: el maratón de Nueva York (`archivo-2026-08-11-3`) usa 59.135 llegadas en 2025, frente a las 59.219 del [listado de resultados del organizador](https://results.nyrr.org/event/M2025/overview); su [comunicado del día siguiente](https://prod.nyrr.org/media-center/news/2025/11/03/new-york-road-runners-breaks-record-again-as-2025-tcs-new-york-city-marathon-becomes) da 59.226. Usar el registro oficial de resultados y fechar el corte antes de cambiar la referencia.

## Cómo continuar

1. Extraer en modo lectura las fechas y el contenido editorial de `days` y `questions`, omitiendo autores, respuestas y demás datos de jugadores, y reconciliar fecha, posición, id, revisión, respuesta y estado de publicación. Antes de cambiar una cifra de puntuación, comprobar si tiene historial y acordar cómo separar las versiones.
2. Ejecutar `node research/auditar-preguntas.mjs --json` para obtener el inventario local por pregunta con valor de la operación, respuesta, fuentes y alertas. `--snapshot archivo.json` permite analizar una colección de jornadas de la API con el mismo criterio. Ejecución local, sin red.
3. Revisar en tandas las 360 preguntas sin reescritura en esta entrega. Verificar que la fuente dé la cifra, unidad, fecha y alcance exactos. Priorizar primero fuentes rotas, preguntas que ya se sirven y modelos con datos sin respaldo. El cálculo debe mostrar las conversiones y el razonamiento ha de enseñar una comprobación mental o cuánto cambia la estimación si cambia un supuesto.
