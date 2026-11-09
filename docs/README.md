# Documentación del equipo

Aquí guardamos, en Markdown, todo lo que Luis y Álvaro (y los agentes de IA con los que trabajamos) necesitamos saber del proyecto y que no cabe en el código. La idea es que ninguno de los dos dependa de lo que el otro recuerde: si se decidió, se cambió o se pensó algo, está escrito aquí.

| Carpeta | Qué va dentro | Cuándo se escribe |
| --- | --- | --- |
| [decisiones/](decisiones/) | Decisiones técnicas o de producto ya tomadas, con su motivo y sus consecuencias. | Cuando elegimos un camino y descartamos otros. |
| [bitacora/](bitacora/) | Registro cronológico de cambios hechos fuera del código: Supabase, Vercel, GitHub, cuentas, dominios. | Cada vez que alguien toca un servicio externo. |
| [ideas/](ideas/) | Propuestas sin decidir: funcionalidades, preguntas, cambios de juego. | Cuando se nos ocurre algo que aún no vamos a hacer. |
| [mejoras/](mejoras/) | Problemas y deuda técnica conocidos de lo que ya existe. | Cuando detectamos algo que conviene arreglar más adelante. |

Documentos generales que siguen en la raíz del repositorio:

- [ARQUITECTURA.md](../ARQUITECTURA.md): stack, entornos, URLs y servicios.
- [AGENTS.md](../AGENTS.md): normas de ramas, PR y trabajo con agentes de IA.
- [README.md](../README.md): cómo arrancar la app en local.

## Normas

- Un archivo `.md` por tema. Nombres en minúsculas, con guiones y sin acentos.
- Cada archivo empieza con un título y una línea de estado y fecha.
- Nunca se escriben claves, tokens, contraseñas ni datos de jugadores.
- Estos archivos se cambian como el código: rama `feat/...` o `fix/...` desde `preprod` y PR.
- Cuando una idea se aprueba, se mueve o enlaza a una decisión; cuando una mejora se resuelve, se marca como hecha con el enlace a su PR.
