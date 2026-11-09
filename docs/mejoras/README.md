# Mejoras

Problemas y deuda técnica conocidos de lo que ya existe. Cuando una mejora se resuelve, se marca como hecha y se enlaza su PR. Si una mejora necesita más detalle, va en su propio archivo `titulo-breve.md`.

| Mejora | Por qué | Estado |
| --- | --- | --- |
| Pasar las respuestas de `runtime/` a Supabase | Los archivos locales solo funcionan con una instancia del servidor y no sirven en Vercel. El esquema ya existe ([base-de-datos.md](../base-de-datos.md)); falta conectar el servidor. | En curso |
| Cargar la semana piloto y el banco editorial en `days` y `questions` | Las tablas están vacías; el contenido sigue en `dist/questions.json` y `content-engine.mjs`. | Pendiente |
| Borrar los datos de prueba de Supabase | Jornada `2000-01-01` y preguntas `prueba-t1`/`prueba-t2`; SQL en [base-de-datos.md](../base-de-datos.md#pendiente). | Pendiente |
| Crear un entorno de preprod en Supabase | Hoy preprod y producción comparten base de datos. Ver [decisión 0001](../decisiones/0001-supabase-un-solo-entorno.md). | Pendiente (al tener jugadores reales) |
| Generar `dist/questions.js` desde `dist/questions.json` | Hoy son dos copias que hay que mantener sincronizadas a mano. | Pendiente |
| Copias de seguridad, observabilidad y control de acceso de administración | No existen en la implementación actual. | Pendiente |
| Proteger las ramas `main` y `preprod` en GitHub | GitHub no bloquea hoy los push directos; solo lo impide la norma de [AGENTS.md](../AGENTS.md). | Pendiente |
