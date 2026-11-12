# Instrucciones para agentes de IA

Lee también [ARQUITECTURA.md](ARQUITECTURA.md), [README.md](README.md) y [docs/README.md](docs/README.md) antes de modificar el proyecto. Estas reglas son obligatorias para cualquier persona o agente (Claude, Codex, Copilot, Cursor u otro) que cambie este repositorio, y se aplican a todo él.

## En una frase

Todo cambio nace en una rama creada **desde `preprod`**, entra en `preprod` mediante una PR que abre el agente y pasa a `main` con otra PR. **El agente llega hasta la PR; el merge lo hace siempre Luis (`borgesinmas`).** Nadie trabaja ni sube cambios directamente a `main` ni a `preprod`.

## Ramas

| Rama | Para qué | Quién escribe en ella |
|---|---|---|
| `main` | Producción. Lo que hay aquí es lo que ve la gente. | Solo el propietario, al aceptar la PR `preprod` → `main`. |
| `preprod` | Integración y pruebas. Rama por defecto del repositorio. | Solo el propietario, al aceptar PR de ramas de tarea. |
| `feat/...` | Una funcionalidad nueva. | El agente que hace la tarea. |
| `fix/...` | Una corrección. | El agente que hace la tarea. |

- Una rama por tarea. Nombre en minúsculas, con guiones, sin espacios ni acentos, que diga qué hace: `feat/ranking-semanal`, `fix/imagen-pregunta-18`. Si una tarea mezcla ambas cosas, elige el prefijo de su objetivo principal.
- No uses nombres que empiecen por `main/` o `preprod/`, ni reutilices una rama ya fusionada: crea otra.
- GitHub no bloquea los push directos a `main` ni a `preprod` en este repositorio. Lo que lo impide es esta norma, así que cúmplela aunque técnicamente puedas saltártela.

## Trabajo compartido entre Luis y Álvaro

En este proyecto trabajamos dos personas, Luis (`borgesinmas`) y Álvaro (`sistemavivacegroup`), Owners los dos de la organización de GitHub `Faraday-gg`, donde está el repositorio público [`Faraday-gg/Faraday.gg`](https://github.com/Faraday-gg/Faraday.gg), cada una con sus propios agentes. Los dos tenemos que poder saber en todo momento qué ha hecho el otro sin preguntárselo, así que **lo que no está escrito en el repositorio no existe**:

| Dónde | Qué se apunta |
|---|---|
| [ARQUITECTURA.md](ARQUITECTURA.md) | Stack, entornos y servicios: proyecto y URL de Supabase, repositorio, Vercel. Se actualiza cuando cambia cualquiera de ellos. |
| [docs/decisiones/](docs/decisiones/) | Cada decisión técnica o de producto, con el motivo y las alternativas descartadas. |
| [docs/bitacora/](docs/bitacora/) | Qué se hizo en cada sesión de trabajo y cada cambio o intento en un servicio externo (Supabase, Vercel, GitHub, cuentas), aunque no salga bien. |
| [docs/ideas/](docs/ideas/) | Propuestas aún sin decidir. |
| [docs/mejoras/](docs/mejoras/) | Problemas y deuda técnica detectados que no se arreglan en la tarea actual. |

Reglas para agentes:

- Al empezar una tarea, lee la bitácora del mes y las decisiones vigentes para saber qué ha hecho el otro colaborador.
- Si tocas un servicio externo, añade la entrada en `docs/bitacora/` en la misma PR. Si tomas o cambias una decisión, crea su archivo en `docs/decisiones/`.
- Todo esto va en Markdown, en español, sin claves, tokens, contraseñas ni datos de jugadores, y entra por PR como el código.
- **Sincronizar al terminar.** Cuando el colaborador haya hecho varios cambios y la tarea parezca terminada, pregúntale: «¿Quieres sincronizar ya o más tarde?». Si dice que sí, actualiza los `.md` siguiendo [.claude/skills/sincronizar/SKILL.md](.claude/skills/sincronizar/SKILL.md) antes de abrir o actualizar la PR. En Claude Code es la skill `/sincronizar`; los demás agentes siguen el mismo archivo como procedimiento.
- Supabase tiene **un solo entorno** (`main`, producción): no hay base de datos de preprod. Ver [decisión 0001](docs/decisiones/0001-supabase-un-solo-entorno.md).

## Antes de empezar

1. Comprueba dónde estás: `git status -sb`. Si hay cambios sin guardar que no son tuyos, no los borres, no los mezcles con tu tarea y pregunta al colaborador qué hacer con ellos.
2. Trae lo último: `git fetch origin`.
3. Crea la rama desde `preprod` remoto, no desde lo que haya en local:

   ```bash
   git switch -c feat/descripcion-breve origin/preprod
   git branch --unset-upstream
   ```

   (Quitar el seguimiento evita que un `git push` sin argumentos acabe en `preprod`.)

4. Comprueba la rama otra vez antes de cada commit y cada push. Si otra conversación o herramienta ha cambiado de rama en la misma carpeta, para y avisa.

## Mientras trabajas

- Haz cambios pequeños y centrados en la tarea. No reformatees ni "mejores" archivos que no hacen falta para ella; si ves algo que conviene arreglar, propónlo como tarea aparte.
- Commits en español, en presente y en tercera persona, describiendo qué hace el cambio: `Añade ranking semanal`, `Corrige la imagen de la pregunta 18`. Añade con `git add <archivo>` solo lo que pertenece a la tarea; nunca `git add -A` a ciegas.
- Nunca incluyas en commits ni en PR: `runtime/` (respuestas de jugadores), `.openai/hosting.json`, `.env`, claves, tokens ni contraseñas. Si un secreto llega a un commit, avisa enseguida: borrarlo en otro commit no basta, hay que cambiarlo.
- Conserva las atribuciones y licencias de las imágenes y las fuentes de cada pregunta.
- Los cambios visuales se miran antes de entregarlos: arranca la app y comprueba la pantalla que has tocado.

## Comprobaciones antes de abrir la PR

- Siempre que cambies el servidor, el contenido diario, las preguntas o el flujo de respuestas:

  ```bash
  node tests/community.test.mjs
  node tests/editorial.test.mjs
  node tests/vercel.test.mjs
  node tests/publicar.test.mjs
  node tests/generar.test.mjs
  node tests/duelos.test.mjs
  node tests/cofres.test.mjs
  node tests/casi.test.mjs
  node tests/auth.test.mjs
  node tests/ligas.test.mjs
  node tests/medallas.test.mjs
  ```

- Cambios de interfaz: `node preview-server.mjs`, abre la app en el navegador y revisa lo que has cambiado, también en ancho de móvil.
- Si una comprobación falla, no abras la PR como lista: arréglalo o explícalo en la PR.

## La pull request la abre el agente

Sube la rama y abre tú la PR, con la base en `preprod`. Usa la cuenta de GitHub del colaborador con el que trabajas (`gh auth status` para comprobarlo): `borgesinmas` (Luis) o `sistemavivacegroup` (Álvaro). **Nunca abras una PR con una cuenta de Yellow Glasses** (`*-yellowglasses`) ni con otra que no sea la del colaborador: en ese caso sube la rama y entrega el enlace de comparación (`https://github.com/Faraday-gg/Faraday.gg/compare/preprod...<rama>?expand=1`) con la descripción lista.

```bash
git push -u origin feat/descripcion-breve
gh pr create --base preprod --head feat/descripcion-breve --title "Añade ranking semanal" --body-file <archivo-con-la-descripcion>
```

- **Título:** igual que un buen commit, en español y diciendo qué cambia.
- **Descripción:** rellena la plantilla [.github/pull_request_template.md](.github/pull_request_template.md): qué y por qué, cómo probarlo, comprobaciones con su resultado y riesgos o pendientes. Escríbela para alguien que no ha visto la conversación.
- Si la tarea no está terminada, abre la PR como borrador (`--draft`) y dilo en la descripción.
- No hagas merge de tu propia PR, no la cierres y no borres ramas sin que el propietario lo pida.

### Comentarios en la PR

El agente también mantiene la conversación de la PR:

- Cuando subas más commits a una PR abierta, deja un comentario con lo que ha cambiado: `gh pr comment <número> --body "..."`.
- Si el propietario pide cambios o deja comentarios de revisión, léelos (`gh pr view <número> --comments`), aplica los cambios en la misma rama y responde a cada comentario diciendo qué hiciste o por qué no lo hiciste.
- Si encuentras un problema que no vas a resolver en esta PR, déjalo escrito en un comentario o en la descripción, no solo en el chat.
- Escribe los comentarios en español, concretos y sin relleno. No menciones a nadie con `@usuario` salvo que haga falta avisarle.

## Paso a producción (`preprod` → `main`)

Solo cuando el propietario lo pida:

1. Revisa qué va a subir: `git diff --stat origin/main...origin/preprod`.
2. Abre la PR `gh pr create --base main --head preprod`, con un resumen de todas las PR que incluye.
3. El propietario la revisa y hace el merge. Si al fusionar entra algo que no se revisó, se avisa y se comprueba.

Las urgencias siguen el mismo camino (`fix/...` → `preprod` → `main`), solo que más rápido. Para deshacer algo ya fusionado se abre otra PR con el `git revert`; nunca se reescribe el historial de `main` ni de `preprod` con `push --force`.

## Entrega al colaborador

Al terminar cada tarea, dile al colaborador, de forma clara:

1. Qué se añadió o corrigió y cualquier decisión relevante.
2. El nombre exacto de la rama `feat/...` o `fix/...`.
3. Qué comprobaciones ejecutaste y su resultado.
4. El enlace directo a la PR dirigida a `preprod`, para que el propietario la revise, la acepte y haga el merge.

Si no puedes subir la rama o abrir la PR (por ejemplo, porque no tienes sesión en GitHub), explica el impedimento y dale los comandos que faltan. Nunca afirmes que existe un enlace que no has comprobado.

## Proyecto

- La aplicación usa HTML, CSS y JavaScript en `dist/` y contenido diario en `content-engine.mjs`. La lógica de la API vive en `lib/api.mjs` y la comparten el servidor local (`preview-server.mjs`) y la función de Vercel (`api/index.mjs`). No hay dependencias de npm.
- Las respuestas se guardan en `runtime/answers.json` en local y en Supabase en Vercel (`lib/stores.mjs`). Supabase tiene un solo entorno (`main`, producción, sin preprod); sus datos están en [ARQUITECTURA.md](ARQUITECTURA.md#entornos-y-servicios) y el esquema en [docs/base-de-datos.md](docs/base-de-datos.md). Los cambios de esquema van como migración en `supabase/migrations/` y se documentan en ese archivo en la misma PR. No apliques migraciones, borres datos ni cambies políticas en Supabase sin confirmación explícita del responsable.
- La clave secreta de Supabase solo existe en variables de entorno (Vercel o `.env` local). Nunca en el código, en `dist/` ni en el navegador. Cuando se cree el proyecto de Vercel, documéntalo en ARQUITECTURA.md.
- Registra en [docs/](docs/README.md) lo que el otro colaborador debe saber: decisiones en `docs/decisiones/`, cambios en servicios externos (Supabase, Vercel, GitHub) en `docs/bitacora/`, propuestas en `docs/ideas/` y deuda técnica en `docs/mejoras/`.
- El contenido (jornadas, preguntas e imágenes) se sirve desde Supabase. Se edita en `dist/questions.json`, `content-engine.mjs` y `dist/assets/`, y se publica solo: el despliegue de producción de Vercel (al fusionar en `main`) ejecuta `scripts/publicar-contenido.mjs`, que sube únicamente lo que ha cambiado. Las Preview no publican. No lo ejecutes a mano sin confirmación del responsable.
- El repositorio es público: no escribas en él datos personales, claves ni nada que no deba verse.
- No añadas dependencias, servicios externos ni claves nuevas sin dejarlo explicado en la PR.
