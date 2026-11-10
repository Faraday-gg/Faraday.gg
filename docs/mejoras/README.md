# Mejoras

Problemas y deuda técnica conocidos de lo que ya existe. Cuando una mejora se resuelve, se marca como hecha y se enlaza su PR. Si una mejora necesita más detalle, va en su propio archivo `titulo-breve.md`.

| Mejora | Por qué | Estado |
| --- | --- | --- |
| Pasar las respuestas de `runtime/` a Supabase | Los archivos locales solo funcionan con una instancia del servidor y no sirven en Vercel. El esquema ya existe ([base-de-datos.md](../base-de-datos.md)). | Hecha: PR #7 y #8 (probado contra el Supabase real por Luis) |
| Cargar la semana piloto y el banco editorial en `days` y `questions` | Las tablas estaban vacías; el contenido sigue en `dist/questions.json` y `content-engine.mjs`. | Hecha: PR #10 (todo el contenido publicado en Supabase) y PR #12 (publicación automática en cada despliegue de producción) |
| Borrar los datos de prueba de Supabase | Jornada `2000-01-01` y respuestas falsas de `2026-12-14`. | Hecha el 9 de noviembre en `feat/documentar-clave-y-previews` (ver [bitácora](../bitacora/2026-11.md)) |
| Rotar la clave secreta de Supabase | La clave actual se compartió en el chat de un agente el 9 de noviembre. Crear otra, ponerla en los `.env` y en Vercel, y borrar la anterior. | Hecha el 9 de noviembre: Luis la rotó, Álvaro la añadió en Vercel (ver [bitácora](../bitacora/2026-11.md)) |
| Crear un entorno de preprod en Supabase | Hoy preprod y producción comparten base de datos. Ver [decisión 0001](../decisiones/0001-supabase-un-solo-entorno.md). | Pendiente (al tener jugadores reales) |
| Generar `dist/questions.js` desde `dist/questions.json` | Hoy son dos copias que hay que mantener sincronizadas a mano. | Pendiente |
| Copias de seguridad, observabilidad y control de acceso de administración | No existen en la implementación actual. | Pendiente |
| Calcular la distribución de respuestas en la base de datos | Hoy la función lee todas las respuestas de la pregunta en cada envío (paginadas de 1000 en 1000). Vale para el piloto, no para miles de jugadores. Se puede usar la función `daily_scores` de la base de datos ([base-de-datos.md](../base-de-datos.md)). | Pendiente |
| Proteger las ramas `main` y `preprod` en GitHub | GitHub no bloquea hoy los push directos; solo lo impide la norma de [AGENTS.md](../../AGENTS.md). | Pendiente |
| Publicar el contenido automáticamente al fusionar en `main` | Antes había que ejecutar `scripts/publicar-contenido.mjs` a mano. | Hecha en `feat/publicacion-automatica`: lo hace el build de producción de Vercel |
| Revisar las fuentes más débiles del archivo | Algunas preguntas de `content/archivo/` usan prensa, tiendas o Wikipedia porque la web oficial no se pudo abrir, o supuestos del modelo. Están en la descripción de las PR de `feat/iconos-y-archivo` y `feat/revision-preguntas`. | Pendiente |
| Peso de las fotos en el repositorio | Las 276 fotos del archivo sumaban unos 65 MB en `dist/assets/`. | Hecha en `feat/revision-preguntas`: solo el 17 % de las preguntas lleva foto y `dist/assets` pesa 21 MB ([decisión 0013](../decisiones/0013-preguntas-de-cultura-general.md)) |
| Revisar las jornadas generadas con OpenAI | Se publican sin revisión humana ([decisión 0017](../decisiones/0017-jornada-diaria-generada-con-openai.md)). La validación comprueba la forma, la cuenta y que las URL existan, no que el dato sea cierto. Las generadas tampoco llevan foto. | Pendiente |
| Caché del calendario | Cada carga consulta Supabase. Con tráfico real conviene cachear unos minutos. | Pendiente |
