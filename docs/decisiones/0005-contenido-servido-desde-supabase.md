# 0005. El contenido se sirve desde Supabase

- **Estado:** aceptada
- **Fecha:** 2026-11-09
- **Quién:** Luis (con Claude Code); para conocimiento de Álvaro
- **Modifica:** la [decisión 0003](0003-despliegue-en-vercel.md), en la que el calendario salía de `content-engine.mjs` y las jornadas se publicaban solo al recibir respuestas

## Contexto

Luis pidió que las preguntas y «absolutamente todo lo posible» estén en Supabase. Hasta ahora Supabase solo guardaba respuestas; las jornadas y preguntas se copiaban allí al responder, pero la web las leía del repositorio y las fotos se servían desde `dist/assets/`.

## Decisión

- **Todo el contenido está en Supabase**: las 36 jornadas (piloto y banco editorial) en `days`, sus 108 preguntas en `questions` y las 21 fotografías en el almacén público `imagenes` de Storage.
- **La API lee el contenido de Supabase** (`/api/calendar`, `/api/day`, `/daily-content.js`) y puntúa con la cifra guardada allí. `content-engine.mjs` queda como respaldo si una fecha no está publicada o Supabase no responde.
- **El repositorio sigue siendo el origen editorial**: el contenido se edita en `dist/questions.json`, `content-engine.mjs` y `dist/assets/`, se revisa por PR y se publica con `scripts/publicar-contenido.mjs`.
- **El almacén de imágenes es público solo para lectura.** Es una excepción acotada a la [decisión 0002](0002-acceso-a-supabase-solo-desde-el-servidor.md): las fotos ya son públicas en la web. Las tablas siguen sin acceso público.

## Alternativas descartadas

| Opción | Por qué no |
| --- | --- |
| Editar el contenido directamente en Supabase | Perderíamos la revisión por PR y el historial de cambios del contenido. |
| Mantener las fotos solo en Vercel (`dist/assets/`) | Luis quiere todo lo posible en Supabase; además, así se pueden cambiar sin desplegar. |
| Guardar en Supabase el progreso personal del jugador | No hay cuentas: sin autenticación no se puede asociar a nadie. Sigue en `localStorage`. |

## Consecuencias

- Tras fusionar en `main` un cambio de contenido hay que ejecutar `node --env-file=.env scripts/publicar-contenido.mjs`; si no, la web muestra la versión anterior.
- Sustituir una pregunta ya publicada por otra con distinto `id` en la misma fecha y posición exige borrar antes la antigua.
- La web hace una consulta a Supabase por cada carga del calendario; sin caché, la latencia depende de Supabase.
- `dist/questions.js` y `dist/assets/` se quedan como copia de respaldo de la web.
