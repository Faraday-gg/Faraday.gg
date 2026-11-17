# 0086. Conservar la referencia con la que se juega una pregunta

- **Estado:** propuesta
- **Fecha:** 2026-11-17
- **Quién:** Álvaro, con Codex

## Contexto

Al cotejar Supabase con el repositorio aparecieron once preguntas con el mismo id y una cifra distinta. Ocho ya se habían jugado. En otras nueve posiciones, el repositorio traía un id nuevo para una pregunta que ya tenía respuestas. Además, 15 fórmulas de las plantillas publicadas se habían redondeado antes de imprimirlas.

## Decisión

- Una publicación conserva una pregunta si el repositorio reutiliza su id con otra referencia, unidad, revisión o posición. Si la sustituiría por otro id, conserva la que ya se jugó. El modo de prueba y el registro de publicación enumeran las referencias conservadas.
- Las correcciones compatibles actualizan el contenido editorial y mantienen la columna de puntuación. Si se recibe una respuesta durante una sustitución, la clave foránea conserva la pregunta y se omite ese cambio.
- El servidor puntúa con la referencia publicada incluso en una instancia que aún no ha cargado la jornada. Si una jornada está incompleta, completa los huecos con el repositorio y mantiene las preguntas publicadas.
- Al leer las plantillas antiguas con id, unidad, revisión y cifra compatibles, el servidor muestra la explicación revisada de su magnitud y sus unidades. La operación utiliza todos los dígitos necesarios.

## Alternativas consideradas

- Sobrescribir todas las preguntas que coinciden por id mezclaría puntuaciones calculadas con referencias distintas.
- Solicitar un cambio de esquema para las explicaciones añade un paso innecesario. Se pueden actualizar al leer la plantilla usando los datos ya disponibles.
- Cancelar la publicación al primer conflicto deja pendientes correcciones compatibles y jornadas con huecos.

## Consecuencias

Las variantes que alteran la cifra se preparan como preguntas nuevas para otras jornadas si la versión anterior ya se jugó. El informe de publicación identifica las que necesitan esa decisión. Se mantiene la publicación incremental por Vercel en el despliegue de producción.
