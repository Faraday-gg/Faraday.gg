# Instrucciones para Claude Code

Este proyecto mantiene sus reglas para agentes de IA en [AGENTS.md](AGENTS.md). Léelas y síguelas siempre, en especial:

- **Ramas:** nunca trabajes en `main` ni en `preprod`. Crea una rama `feat/...` o `fix/...` desde `origin/preprod`, abre una PR hacia `preprod` y entrega al colaborador el resumen, el nombre de la rama, las comprobaciones y el enlace de la PR.
- **Trabajo compartido:** en el proyecto trabajan Luis y Álvaro. Antes de empezar, lee [ARQUITECTURA.md](ARQUITECTURA.md) (entornos, Supabase, servicios) y [docs/](docs/README.md) (bitácora del mes y decisiones vigentes) para saber qué ha hecho el otro.
- **Sincronizar:** cuando el colaborador haya hecho varios cambios y la tarea parezca terminada, pregúntale «¿Quieres sincronizar ya o más tarde?». Si dice que sí, usa la skill `/sincronizar` antes de abrir o actualizar la PR.
- **Cuenta de GitHub:** **nunca abras una PR (ni comentes, ni subas nada) con una cuenta de Yellow Glasses** (`*-yellowglasses`). Antes de `gh pr create`, comprueba con `gh auth status` que la cuenta activa es la del colaborador (`borgesinmas` para Luis, `sistemavivacegroup` para Álvaro). Si no lo es, no lo intentes: sube la rama y entrega el enlace `https://github.com/Faraday-gg/Faraday.gg/compare/preprod...<rama>?expand=1` con la descripción lista para que la abra él.
- **Supabase:** hay un solo entorno (`main`, producción). No apliques migraciones, borres datos ni cambies políticas sin confirmación explícita.

@AGENTS.md
