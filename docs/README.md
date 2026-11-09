# Documentación del equipo

Aquí guardamos, en Markdown, todo lo que Luis y Álvaro (y los agentes de IA con los que trabajamos) necesitamos saber del proyecto y que no cabe en el código. La idea es que ninguno de los dos dependa de lo que el otro recuerde: si se decidió, se cambió o se pensó algo, está escrito aquí.

| Carpeta | Qué va dentro | Cuándo se escribe |
| --- | --- | --- |
| [decisiones/](decisiones/) | Decisiones técnicas o de producto ya tomadas, con su motivo y sus consecuencias. | Cuando elegimos un camino y descartamos otros. |
| [bitacora/](bitacora/) | Registro cronológico de cada sesión de trabajo y de los cambios hechos fuera del código: Supabase, Vercel, GitHub, cuentas, dominios. | Al sincronizar al final de una tanda de cambios y cada vez que alguien toca un servicio externo. |
| [ideas/](ideas/) | Propuestas sin decidir: funcionalidades, preguntas, cambios de juego. | Cuando se nos ocurre algo que aún no vamos a hacer. |
| [mejoras/](mejoras/) | Problemas y deuda técnica conocidos de lo que ya existe. | Cuando detectamos algo que conviene arreglar más adelante. |

Documento vivo de la base de datos: [base-de-datos.md](base-de-datos.md). Describe las tablas, funciones, seguridad y migraciones de Supabase tal y como están ahora; se actualiza con cada migración.

Documentos generales que siguen en la raíz del repositorio:

- [ARQUITECTURA.md](../ARQUITECTURA.md): stack, entornos, URLs y servicios.
- [AGENTS.md](../AGENTS.md): normas de ramas, PR y trabajo con agentes de IA.
- [README.md](../README.md): cómo arrancar la app en local.

## Sincronizar

Al terminar una tanda de cambios, el agente pregunta «¿Quieres sincronizar ya o más tarde?». Si la respuesta es sí, actualiza estos documentos y la bitácora con lo que se ha hecho, para que quien revise la PR lo sepa sin haber visto la conversación. El procedimiento está en [.claude/skills/sincronizar/SKILL.md](../.claude/skills/sincronizar/SKILL.md) (en Claude Code: `/sincronizar`).

## Normas

- Un archivo `.md` por tema. Nombres en minúsculas, con guiones y sin acentos.
- Cada archivo empieza con un título y una línea de estado y fecha.
- Nunca se escriben claves, tokens, contraseñas ni datos de jugadores.
- Estos archivos se cambian como el código: rama `feat/...` o `fix/...` desde `preprod` y PR.
- Cuando una idea se aprueba, se mueve o enlaza a una decisión; cuando una mejora se resuelve, se marca como hecha con el enlace a su PR.
