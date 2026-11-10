# 0017 — La jornada de cada día se genera sola con la API de OpenAI

- **Estado:** aceptada (pendiente de configurar en Vercel y Supabase)
- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code; para conocimiento de Álvaro
- **Modifica:** la [decisión 0013](0013-preguntas-de-cultura-general.md) en lo del banco automático congelado, y la [decisión 0005](0005-contenido-servido-desde-supabase.md) en que el repositorio es el único origen del contenido

## Contexto
Luis quiere que cada día a las 00:01 se cree automáticamente la jornada siguiente con 3 preguntas nuevas, escritas con la API de ChatGPT (OpenAI), y que de vez en cuando alguna sea de actualidad. Hasta ahora, después del piloto, las jornadas salían de un banco de plantillas («¿cuántos folios A4…?») que se acaba el 14 de diciembre de 2026.

## Decisión
- **Quién escribe:** `lib/generar.mjs` llama a la API Responses de OpenAI con la herramienta de búsqueda web (`web_search`) y una salida JSON con esquema estricto. El prompt resume las reglas de la decisión 0013 (cultura general mezclada, referentes conocidos, fuentes reales) y le pasa las preguntas de los últimos 60 días para que no se repita. El modelo se elige con `OPENAI_MODEL` (por defecto `gpt-5`).
- **Actualidad:** un día de cada dos, una de las tres preguntas (solo una) trata un tema de los últimos días, sin tragedias ni política partidista.
- **Validación antes de guardar:** 3 preguntas de categorías distintas, todos los campos de `research/validar-archivo.mjs`, que `referenceExpression` dé `answer` (con un margen del 0,5 %), que haya o no pregunta de actualidad según toque y que las URL de las fuentes existan (solo se rechaza si no responden o dan 404/410). Si falla, se pide una vez más explicando el error; si vuelve a fallar, no se guarda nada y la fecha usa el banco como respaldo.
- **Dónde se guarda:** directamente en Supabase (`days.source = 'ia'`, preguntas `ia-<fecha>-<posición>`). No pasa por el repositorio ni por PR.
- **Cuándo:** `pg_cron` de Supabase llama a `/api/generar-dia` a las 00:01 de Madrid, que crea la jornada de **mañana**: siempre hay un día de margen. El cron de Vercel (`vercel.json`, 23:30 UTC) es el respaldo, porque en el plan Hobby solo se garantiza la hora, no el minuto. Las dos llamadas usan `Authorization: Bearer CRON_SECRET`, y si la jornada ya existe no se hace nada.
- **Qué jornadas se pueden sustituir:** solo las del banco automático que nadie haya jugado todavía. Las escritas a mano (archivo y piloto) y las que ya tienen respuestas no se tocan. La publicación de cada despliegue (`lib/publicar.mjs`) no toca las jornadas `ia`.
- **Solo en producción:** la función solo genera con `VERCEL_ENV=production`, porque las Preview comparten base de datos.

## Alternativas descartadas
- **Claude escribe y abre una PR cada noche:** con revisión humana, pero no sería automático a las 00:01. Luis prefirió OpenAI y la publicación automática.
- **Ampliar el banco de plantillas:** sin coste ni claves, pero no son preguntas nuevas.
- **Solo el cron de Vercel:** en Hobby puede ejecutarse en cualquier minuto de la hora programada.

## Consecuencias
- Hay un servicio externo nuevo con coste por uso (OpenAI). Son unas pocas llamadas al día, con búsqueda web.
- Variables nuevas en Vercel (Production): `OPENAI_API_KEY`, `CRON_SECRET` y, si se quiere, `OPENAI_MODEL`. El mismo `CRON_SECRET` va en Vault de Supabase con el nombre `cron_secret`.
- Migración `20261110120000_jornadas_generadas` (admite `source = 'ia'`, activa `pg_cron` y `pg_net` y programa la tarea). Hay que aplicarla en producción con confirmación de Luis.
- **Nadie revisa las preguntas antes de que se publiquen.** La validación comprueba la forma y la cuenta, no que el dato sea cierto. Las jornadas generadas no llevan foto.
- A partir del 16 de noviembre (si está configurado), las jornadas del banco se van sustituyendo por jornadas generadas la noche anterior a cada fecha.
