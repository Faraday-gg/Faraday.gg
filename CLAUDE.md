# Instrucciones para Claude Code

Este proyecto mantiene sus reglas para agentes de IA en [AGENTS.md](AGENTS.md). Léelas y síguelas siempre, en especial:

- **Ramas:** nunca trabajes en `main` ni en `preprod`. Crea una rama `feat/...` o `fix/...` desde `origin/preprod`, abre una PR hacia `preprod` y entrega al colaborador el resumen, el nombre de la rama, las comprobaciones y el enlace de la PR.
- **Trabajo compartido:** en el proyecto trabajan Luis y Álvaro. Antes de empezar, lee [ARQUITECTURA.md](ARQUITECTURA.md) (entornos, Supabase, servicios) y [docs/](docs/README.md) (bitácora del mes y decisiones vigentes) para saber qué ha hecho el otro.
- **Sincronizar:** cuando el colaborador haya hecho varios cambios y la tarea parezca terminada, pregúntale «¿Quieres sincronizar ya o más tarde?». Si dice que sí, usa la skill `/sincronizar` antes de abrir o actualizar la PR.
- **Supabase:** hay un solo entorno (`main`, producción). No apliques migraciones, borres datos ni cambies políticas sin confirmación explícita.

@AGENTS.md
