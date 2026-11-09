# Mejoras

Problemas y deuda técnica conocidos de lo que ya existe. Cuando una mejora se resuelve, se marca como hecha y se enlaza su PR. Si una mejora necesita más detalle, va en su propio archivo `titulo-breve.md`.

| Mejora | Por qué | Estado |
| --- | --- | --- |
| Pasar las respuestas de `runtime/` a Supabase | Los archivos locales solo funcionan con una instancia del servidor y no sirven en Vercel. Ver [ARQUITECTURA.md](../ARQUITECTURA.md#despliegue-vercel-y-supabase). | En curso: rama `feat/despliegue-vercel-supabase` (falta aplicar la migración y crear el proyecto de Vercel) |
| Crear un entorno de preprod en Supabase | Hoy preprod y producción comparten base de datos. Ver [decisión 0001](../decisiones/0001-supabase-un-solo-entorno.md). | Pendiente (al tener jugadores reales) |
| Generar `dist/questions.js` desde `dist/questions.json` | Hoy son dos copias que hay que mantener sincronizadas a mano. | Pendiente |
| Copias de seguridad, observabilidad y control de acceso de administración | No existen en la implementación actual. | Pendiente |
| Calcular la distribución de respuestas en la base de datos | Hoy la función lee todas las respuestas de la pregunta en cada envío (paginadas de 1000 en 1000). Vale para el piloto, no para miles de jugadores. Ver [decisión 0002](../decisiones/0002-despliegue-en-vercel.md). | Pendiente |
| Proteger las ramas `main` y `preprod` en GitHub | GitHub no bloquea hoy los push directos; solo lo impide la norma de [AGENTS.md](../AGENTS.md). | Pendiente |
