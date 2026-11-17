# Auditoría editorial del banco de preguntas

- **Estado:** Inventario y aritmética revisados en el repositorio y en Supabase. En curso la revisión individual de las fuentes.
- **Fecha de la primera pasada:** 17 de noviembre de 2026.

## Alcance y resultados

| Conjunto | Qué se pudo revisar | Resultado inicial |
| --- | --- | --- |
| Banco editorial de `preprod` | 384 preguntas, 128 jornadas (276 de archivo, 21 de piloto y 87 escritas tras el piloto). | Las 384 fórmulas coinciden con su respuesta con tolerancia del 0,05 %. En el archivo faltaban 276 cuentas por pasos y 238 preguntas citaban al menos una página de Wikipedia. |
| Enlaces del repositorio | 539 URL de texto distintas, sin contar créditos de fotos. | 512 dieron 200, una 203, seis 404 y 20 quedaron sin confirmar por restricciones, error de servidor o espera agotada. Un 200 no confirma que la página respalde la cifra. |
| API pública de Vercel | 128 fechas entre el 09/08 y el 14/12. Devolvió 185 preguntas: 60 fechas completas, tres parciales y 65 vacías en la captura. | 96 preguntas compartían id con `preprod`; en 11 de ellas la respuesta y el enunciado eran distintos. De las 185, 15 fórmulas de plantillas, con datos redondeados, no reproducían la respuesta publicada. |

La API puede servir tanto Supabase como el respaldo del despliegue. Las 185 preguntas son lo que devolvió **la API**, no un recuento de filas en Supabase. No se consultaron tablas privadas ni respuestas de jugadores. Quedan fuera del inventario las preguntas de Supabase que la API no devolvió y las propuestas aún no publicadas.

## Cotejo directo con Supabase

El 17 de noviembre se consultaron todas las filas de `days` y `questions` en modo lectura. El resultado confirma 185 preguntas en 128 jornadas. Hay 60 jornadas completas, tres parciales y 65 vacías. No hay jornadas de origen IA en esa captura. Los 185 ids, fórmulas y referencias coinciden con la captura de la API pública, con tolerancia de 1e-12 para diferencias de representación de los decimales.

| Hallazgo | Resultado |
| --- | ---: |
| Mismo id con enunciado y cifra distintos en el repositorio | 11, de las cuales 8 ya tenían respuestas |
| La posición tiene otro id en el repositorio | 90, de las cuales 9 ya tenían respuestas |
| Plantillas con error de más del 0,05 % entre fórmula y cifra en los datos guardados | 15, de las cuales 3 ya tenían respuestas |
| Referencias que conserva la simulación del publicador actualizado | 20 (11 ids reutilizados y 9 sustituciones con respuestas) |

La segunda tanda revisa las 87 plantillas a partir de sus 11 magnitudes de origen. En las 15 que redondeaban antes de dividir, la fórmula nueva reproduce la cifra de puntuación. Se desglosan las conversiones y se marcan los supuestos. En Las Canteras, los 3.100 m proceden del Ayuntamiento y los 50 m de anchura son una aproximación del modelo. El resultado de 155.000 m² depende de representar la playa como una franja rectangular. [Ayuntamiento de Las Palmas de Gran Canaria](https://lpamar.laspalmasgc.es/las-playas/las-canteras)

También se reescriben 10 preguntas guardadas en Supabase con fuentes primarias y pasos que permiten repetir la cuenta. En Plutón se especifica que la distancia medida parte del Sol. En los 747 se explica que Boeing cuenta también los aviones de carga y que 400 plazas es un supuesto. En el dato de Ecovidrio se convierten kilos de envases de varios tipos a botellas equivalentes de 400 g. [NASA](https://science.nasa.gov/dwarf-planets/pluto/facts/), [Boeing](https://investors.boeing.com/investors/news/press-release-details/2022/Final-Boeing-747-Airplane-Leaves-Everett-Factory/default.aspx), [Ecovidrio](https://ecovidrio.es/resultados-reciclaje-envases-vidrio-espana-2024)

Se verificaron las diferencias y el plan de publicación sobre una copia de los datos. La consulta de las respuestas se limitó a comprobar si existía alguna por pregunta. Las mejoras de esta tanda se explican en la [decisión 0088](../decisiones/0088-conservar-referencias-publicadas.md).

## Qué corrigió la primera tanda

Se revisaron manualmente 24 preguntas: 13 del archivo, seis del piloto y cinco de las jornadas escritas. Se preservan sus ids, revisiones, respuestas y fotos. Algunos títulos delimitan mejor el modelo que ya usa la cifra, como la masa de una piedra de Stonehenge repartida entre jugadores de fútbol; ese cociente no explica cómo se arrastró la piedra. Otros ejemplos:

- **Cartagena:** [Colombia Travel](https://colombia.travel/es/cartagena/las-murallas-de-cartagena) documenta 11 km conservados. Los 1,70 m entre las manos son una elección del juego. Si el tramo por persona baja a 1,50 m, la cuenta sube de unas 6.470 a unas 7.330 personas.
- **Elefante:** los 150 kg son el extremo superior de un intervalo del [zoológico de San Diego](https://animals.sandiegozoo.org/animals/elephant), no un máximo biológico. Para las manzanas se reemplaza la URL que devolvía 404 por el [informe del USDA](https://ers.usda.gov/sites/default/files/_laserfiche/publications/47570/8043_tb1927.pdf) con 182 g por porción.
- **Carolina Reaper:** [la escala Scoville mide concentración](https://ucanr.edu/sites/default/files/2026-04/Peppers%202026.04.pdf). El cociente estima cantidades totales de capsaicinoides solo en el modelo de frutos de igual masa; no predice la sensación en la boca.
- **Velas de cumpleaños:** el peso de envío incluye embalaje; 5,1 kg es un techo aproximado, no una masa de cera medida.
- **A380:** el [certificado EASA](https://www.easa.europa.eu/en/downloads/7309/en) detalla 324.339 L utilizables con los sistemas incluidos. Los 320.000 L del juego son una aproximación; no se presentan como cifra exacta.
- **ELT:** los 39 m son el diámetro exterior que publica el [ESO](https://elt.eso.org/mirror/M1/). Un disco ideal de ese diámetro y el área colectora del espejo real son dos cosas distintas.

De los seis enlaces con 404 en la captura, cinco se han sustituido: plátano del USDA, rendimiento de la naranja, porción de manzana, LEGO y Airbus. Queda por encontrar la ficha primaria de la empanada de carne (`archivo-2026-09-24-2`) que respalde ambos datos: 333 kcal por 100 g y 130 g por pieza. Las respuestas HTTP 403 y 429 se revisan en navegador antes de dar el enlace por roto.

## Diferencias relevantes antes de publicar

La tabla compara los once ids reutilizados. El publicador actualizado los conserva con su cifra original. El cotejo también confirmó que los cambios de id en tres posiciones del piloto y en las seis primeras posiciones del banco editorial ya tienen respuestas.

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

Las 15 fórmulas publicadas con error afectan a las plantillas de superficie de **Las Canteras, el Guernica y el Bernabéu**, cruzadas con cinco objetos: hoja A4, tarjeta bancaria, servilleta, ficha de dominó y carátula de vinilo. Por ejemplo, 155.000 ÷ 0,001 da 155 millones de fichas, pero el resultado publicado ronda los 124 millones, coherente con el área sin redondear de 0,00125 m². El servidor aplica la explicación corregida al leer una plantilla compatible en Supabase. La cifra de puntuación ya se calculaba con la medida sin redondear.

Otro ejemplo que requiere decidir cómo versionar la puntuación: el maratón de Nueva York (`archivo-2026-08-11-3`) usa 59.135 llegadas en 2025, frente a las 59.219 del [listado de resultados del organizador](https://results.nyrr.org/event/M2025/overview); su [comunicado del día siguiente](https://prod.nyrr.org/media-center/news/2025/11/03/new-york-road-runners-breaks-record-again-as-2025-tcs-new-york-city-marathon-becomes) da 59.226. Usar el registro oficial de resultados y fechar el corte antes de cambiar la referencia.

## Cómo continuar

1. Revisar en tandas las fuentes pendientes. De las 98 preguntas no generadas por plantilla en la captura de Supabase, 17 coinciden por id con las reescrituras de las dos primeras tandas y 81 quedan pendientes de revisión individual. Priorizar los enlaces rotos, los datos que carecen de respaldo y las discrepancias de alcance.
2. Ejecutar `node research/auditar-preguntas.mjs --json` para obtener un inventario del repositorio con valor calculado, respuesta, fuentes y alertas. `--snapshot archivo.json` analiza una captura de las jornadas de la API con el mismo criterio. La comprobación aritmética se hace sin red.
3. Usar ids nuevos para las preguntas que cambien de objetivo y colocar esas versiones en jornadas donde puedan publicarse preservando el historial.
