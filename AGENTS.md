# Instrucciones para agentes de IA

Lee también [ARQUITECTURA.md](ARQUITECTURA.md) y [README.md](README.md) antes de modificar el proyecto. Estas reglas son obligatorias para cualquier persona o agente (Claude, Codex, Copilot, Cursor u otro) que cambie este repositorio, y se aplican a todo él.

## En una frase

Todo cambio nace en una rama creada **desde `preprod`**, entra en `preprod` mediante una PR que abre el agente y pasa a `main` con otra PR. **El agente llega hasta la PR; el merge lo hace siempre el propietario del repositorio (`borgesinmas`).** Nadie trabaja ni sube cambios directamente a `main` ni a `preprod`.

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
  ```

- Cambios de interfaz: `node preview-server.mjs`, abre la app en el navegador y revisa lo que has cambiado, también en ancho de móvil.
- Si una comprobación falla, no abras la PR como lista: arréglalo o explícalo en la PR.

## La pull request la abre el agente

Sube la rama y abre tú la PR, con la base en `preprod`. Usa la cuenta de GitHub del colaborador con el que trabajas (`gh auth status` para comprobarlo).

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

- La aplicación actual usa HTML, CSS y JavaScript en `dist/`, un servidor Node.js sin dependencias en `preview-server.mjs` y contenido diario en `content-engine.mjs`.
- Las respuestas de jugadores se guardan hoy en archivos locales dentro de `runtime/`; no existe todavía una base de datos conectada. Supabase y Vercel son la arquitectura de despliegue prevista, no servicios ya integrados.
- No añadas dependencias, servicios externos ni claves nuevas sin dejarlo explicado en la PR.
