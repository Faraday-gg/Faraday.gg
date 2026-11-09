# 0003. Despliegue en Vercel con una función que usa el esquema de Supabase

- **Estado:** propuesta (se acepta al fusionar la PR de `feat/despliegue-vercel-supabase`)
- **Fecha:** 2026-11-09
- **Quién:** Álvaro (con Claude); para revisión de Luis

## Contexto

ARQUITECTURA.md preveía desplegar en Vercel y guardar las respuestas en Supabase. Las respuestas vivían en `runtime/answers.json`, que no sirve en Vercel: el disco de las funciones es de solo lectura y no se comparte entre instancias.

En Supabase ya está aplicado el esquema de Luis (`days`, `questions`, `answers`; ver [base-de-datos.md](../base-de-datos.md)). Hay un único entorno ([decisión 0001](0001-supabase-un-solo-entorno.md)) y solo el servidor accede a la base de datos ([decisión 0002](0002-acceso-a-supabase-solo-desde-el-servidor.md)). En `answers`, `question_id` es clave foránea de `questions`, y `days` y `questions` estaban vacías.

## Decisión

- **Una sola función de Vercel** (`api/index.mjs`) para toda la API. Usa el formato `fetch` estándar y `vercel.json` reescribe hacia ella `/api/<ruta>` y `/daily-content.js`, como recomienda Vercel para proyectos sin framework. `dist/` se publica como web estática.
- **Lógica compartida** en `lib/api.mjs`, usada también por `preview-server.mjs`, para que el entorno local y Vercel se comporten igual.
- **Supabase por su API REST, sin SDK ni dependencias de npm.** La clave secreta (`sb_secret_...`) solo está en variables de entorno del servidor.
- **Publicación bajo demanda.** Al recibir la primera respuesta de una jornada, la API inserta la jornada en `days` y sus preguntas en `questions`, ignorando las que ya existan. Así se cumple la clave foránea sin un paso de carga aparte. El calendario sigue saliendo de `content-engine.mjs`.
- **Región `fra1`** (Frankfurt) para la función, junto a la base de datos (`eu-central-1`).

## Alternativas descartadas

| Opción | Por qué no |
| --- | --- |
| SDK `@supabase/supabase-js` | Añade `package.json`, dependencias y paso de instalación. Con insertar y leer basta la API REST. |
| Una función por ruta | Vercel recomienda agrupar las rutas en una función. Además, se duplicaría código y arranques en frío. |
| Cargar `days` y `questions` con un script antes de desplegar | Es otro paso manual que hay que repetir cada vez que el banco editorial avanza. La publicación bajo demanda no lo impide: el script puede añadirse después. |
| Tabla aparte para los despliegues Preview (`answers_preview`, propuesta inicial de esta rama) | El esquema aplicado no la tiene, y la decisión 0001 ya acepta que preprod y producción compartan datos. Se descartó al integrar el esquema de Luis. |
| Guardar en `/tmp` de la función | No se comparte entre instancias y se pierde: no sirve para comparar respuestas. |

## Consecuencias

- **Propietario del proyecto de Vercel.** Según la documentación de Vercel, en el plan Hobby con repositorio privado solo el propietario de la cuenta puede disparar despliegues, y los commits de otros autores se bloquean. Si el proyecto es de Luis, se despliegan los merges que él hace (commit de merge a su nombre), pero no las ramas de Álvaro. Las alternativas son plan Pro con los dos en el equipo, o hacer público el repositorio. **Pendiente de decidir entre los dos.**
- La rama de producción de Vercel debe configurarse como `main`, porque la rama por defecto del repositorio es `preprod`.
- Las respuestas que se envíen desde despliegues Preview, o desde local con las variables de Supabase, quedan en la misma base de datos que producción.
- Una jornada ya publicada no se actualiza. Si cambia una pregunta de una fecha publicada, su inserción falla (ver [base-de-datos.md](../base-de-datos.md#uso-desde-la-app)).
- La función lee todas las respuestas de una pregunta en cada envío. Es suficiente para el piloto; con muchos jugadores convendrá usar `daily_scores` o calcular el histograma en la base de datos (ver [mejoras](../mejoras/README.md)).
