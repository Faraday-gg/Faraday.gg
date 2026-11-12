# 0039 — Preguntas para jugadores de España y de Latinoamérica

- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Modifica:** la [decisión 0013](0013-preguntas-de-cultura-general.md) (reparto de referentes y banco congelado) y la [decisión 0017](0017-jornada-diaria-generada-con-openai.md) (prompt del generador)

## Contexto
Muchos de los jugadores van a ser hispanohablantes de Latinoamérica. Hasta ahora las preguntas estaban escritas en español de España («caña», «folio», «móvil»), lo hispano era casi siempre español y el banco de plantillas del 16 de noviembre al 14 de diciembre repetía referentes de España («¿Cuántos folios A4 sumarían la superficie de arena de Las Canteras?»). El generador diario con OpenAI pedía «español (de España)».

## Decisión
- **Ámbito de cada pregunta:** cada pregunta lleva un campo `ambito`: `mundial`, `espana` o `latam`. Se sortea por pregunta, de forma estable para cada fecha (`ambitos(fecha)` en `lib/generar.mjs`), con pesos de 60 % mundial, 18 % España y 22 % Latinoamérica. No hay fórmula fija: hay días con tres mundiales, días con dos latinoamericanas o dos de España, y días con una de cada. A la larga salen más mundiales que de España y Latinoamérica juntas.
- **Latinoamérica variada:** el prompt pide variar el país (México, Argentina, Colombia, Chile, Perú, Cuba, Venezuela, Uruguay, Centroamérica, el Caribe…) y no repetir el de las preguntas recientes. Lo de España y Latinoamérica tiene que conocerlo cualquier hispanohablante, a ambos lados del Atlántico.
- **Español neutro:** que se entienda igual en Madrid, en Ciudad de México y en Buenos Aires. Sin palabras de un solo país (caña, folio, móvil, coche, ordenador; celular, carro, computadora), sin «vosotros», sistema métrico y dinero en dólares.
- **Generador diario:** el prompt pide el ámbito de cada posición y la validación rechaza la jornada si no coincide. La pregunta de actualidad puede ser del mundo, de España o de Latinoamérica.
- **Jornadas escritas a mano del 16 de noviembre al 14 de diciembre:** las 87 preguntas del banco de plantillas se sustituyen por preguntas escritas a mano en `content/jornadas/AAAA-MM-DD.json`, con el mismo sorteo de ámbito (54 mundiales, 13 de España y 20 de Latinoamérica) y foto en 16 de ellas. El plan está en `research/jornadas-plan.json` (lo genera `research/jornadas-plan.mjs`), las reglas en `research/jornadas-instrucciones.md` y se comprueban con `node research/validar-jornadas.mjs`. Se publican como jornadas escritas a mano (`source = 'piloto'`), así que el generador diario no las sustituye y empieza a escribir a partir del 15 de diciembre.

## Alternativas descartadas
- **Una pregunta de España, una de Latinoamérica y una mundial cada día:** Luis no quiere una fórmula fija; prefiere que vaya cambiando y que predominen las mundiales.
- **Solo orientar el prompt, sin sorteo:** el modelo tiende a repetir el mismo patrón; con el sorteo en el código el reparto es real y se puede comprobar.
- **Mantener el español de España:** los jugadores de Latinoamérica tropezarían con palabras como «folio» o «caña».

## Consecuencias
- Las jornadas del 16 de noviembre en adelante tienen que llegar a producción **antes de que se jueguen**. Si al publicar alguna pregunta del banco que se sustituye ya tiene respuestas, la publicación se detiene con un mensaje claro ([lib/publicar.mjs](../../lib/publicar.mjs)); en ese caso hay que quitar de `content/jornadas/` las fechas ya jugadas.
- El banco de plantillas de `content-engine.mjs` queda como respaldo de las fechas que no tengan archivo en `content/jornadas/`.
- `tests/editorial.test.mjs` comprueba el ámbito de cada pregunta escrita a mano, que haya más mundiales que del resto y que no aparezcan palabras de un solo país en título, detalle o unidad. `tests/generar.test.mjs` comprueba el sorteo y la validación del ámbito.
- Las preguntas del archivo y del piloto (9 de agosto – 15 de noviembre) no se tocan: ya están publicadas y siguen en español de España. Se pueden revisar más adelante.
