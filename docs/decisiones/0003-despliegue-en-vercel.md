# 0002. Despliegue en Vercel con una función y respuestas en Supabase

- **Estado:** propuesta (se acepta al fusionar la PR de `feat/despliegue-vercel-supabase`)
- **Fecha:** 2026-11-09
- **Quién:** Álvaro (con Claude); para revisión de Luis

## Contexto

ARQUITECTURA.md preveía desplegar en Vercel y guardar las respuestas en Supabase. Las respuestas vivían en `runtime/answers.json`, que no sirve en Vercel: el disco de las funciones es de solo lectura y no se comparte entre instancias. Supabase tiene un único entorno, `main` (ver [decisión 0001](0001-supabase-un-solo-entorno.md)), así que preprod y producción comparten base de datos.

## Decisión

- **Una sola función de Vercel** (`api/index.mjs`) para toda la API. Usa el formato `fetch` estándar y `vercel.json` reescribe hacia ella `/api/<ruta>` y `/daily-content.js`, como recomienda Vercel para proyectos sin framework. `dist/` se publica como web estática.
- **Lógica compartida** en `lib/api.mjs`, usada también por `preview-server.mjs`, para que el entorno local y Vercel se comporten igual.
- **Supabase por su API REST, sin SDK ni dependencias de npm.** La clave secreta (`sb_secret_...`) solo está en variables de entorno del servidor.
- **Tabla separada para Preview** (`answers_preview`) dentro de la única base de datos. Producción usa `answers` y la variable `ANSWERS_TABLE` elige cuál. Así, las pruebas en despliegues Preview no contaminan las respuestas reales, sin necesidad de un segundo entorno.
- **RLS activo y sin políticas** en las dos tablas, sin permisos para `anon` ni `authenticated`. Solo el servidor accede, con el rol `service_role`.
- **Región `fra1`** (Frankfurt) para la función, junto a la base de datos (`eu-central-1`).

## Alternativas descartadas

| Opción | Por qué no |
| --- | --- |
| SDK `@supabase/supabase-js` | Añade `package.json`, dependencias y paso de instalación. Con dos operaciones (leer e insertar), la API REST basta. |
| Una función por ruta | Vercel recomienda agrupar las rutas en una función. Además, se duplicaría código y arranques en frío. |
| Misma tabla para Preview y producción | Mezclaría respuestas de prueba con las reales en la distribución que ven los jugadores. |
| Guardar en `/tmp` de la función | No se comparte entre instancias y se pierde: no sirve para comparar respuestas. |
| Edge Functions de Supabase | Otro runtime y otro despliegue que mantener; la lógica quedaría repartida. |

## Consecuencias

- **Propietario del proyecto de Vercel.** Según la documentación de Vercel, en el plan Hobby con repositorio privado solo el propietario de la cuenta puede disparar despliegues, y los commits de otros autores se bloquean. Si el proyecto es de Luis, se despliegan los merges que él hace (commit de merge a su nombre), pero no las ramas de Álvaro. Las alternativas son plan Pro con los dos en el equipo, o hacer público el repositorio. **Pendiente de decidir entre los dos.**
- La rama de producción de Vercel debe configurarse como `main`, porque la rama por defecto del repositorio es `preprod`.
- La migración `supabase/migrations/20261109213500_create_answers.sql` se aplica en Supabase solo después de aceptar la PR y con confirmación explícita. Se anota en la bitácora.
- La función lee todas las respuestas de una pregunta en cada envío. Es suficiente para el piloto; con muchos jugadores convendrá calcular el histograma en la base de datos (ver [mejoras](../mejoras/README.md)).
- Revisar junto con la decisión 0001 cuando haya jugadores reales.
