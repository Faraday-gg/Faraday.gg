# Instrucciones para agentes de IA

Lee también [ARQUITECTURA.md](ARQUITECTURA.md) y [README.md](README.md) antes de modificar el proyecto. Estas reglas se aplican a todo el repositorio.

## Ramas y revisión obligatoria

- `main` representa producción. `preprod` es la rama de integración y pruebas. Nunca trabajes, hagas commits ni envíes cambios directamente a `main` o `preprod`.
- Antes de editar, comprueba la rama con `git status -sb` y actualiza `preprod`. Crea una rama nueva desde `preprod` para cada tarea: `feat/descripcion-breve` para funcionalidades o `fix/descripcion-breve` para correcciones. Usa nombres en minúsculas, sin espacios ni acentos. Si una tarea contiene ambas cosas, elige el prefijo que describa su objetivo principal.
- Si ya hay cambios locales sin guardar, no los sobrescribas ni los incluyas por accidente. Coordina cómo conservarlos antes de crear la rama.
- Haz commits únicamente en la rama de tarea. Sube esa rama a GitHub y abre una pull request cuya base sea `preprod`. No hagas el merge de tu propia PR ni cierres la PR sin indicación del responsable.
- El paso de `preprod` a `main` se hace mediante otra PR, revisada y aceptada por el propietario del proyecto. Ningún agente publica o despliega producción por su cuenta.
- Si GitHub permite configurar protección de ramas, mantén obligatoria la revisión por PR para `preprod` y `main`. Estas instrucciones también se deben seguir aunque la protección todavía no esté configurada.

## Entrega al colaborador

Al terminar cada tarea, comunica al colaborador, de forma clara:

1. Qué se añadió o corrigió y cualquier decisión relevante.
2. El nombre exacto de la rama `feat/...` o `fix/...`.
3. Qué comprobaciones ejecutaste y su resultado.
4. El enlace directo a la PR dirigida a `preprod` para que la revise, acepte y haga el merge.

Si no puedes subir la rama o abrir la PR, explica el impedimento y entrega los pasos restantes; nunca afirmes que existe un enlace que no has comprobado.

## Proyecto

- La aplicación actual usa HTML, CSS y JavaScript en `dist/`, un servidor Node.js sin dependencias en `preview-server.mjs` y contenido diario en `content-engine.mjs`.
- Las respuestas de jugadores se guardan hoy en archivos locales dentro de `runtime/`; no existe todavía una base de datos conectada. Supabase y Vercel son la arquitectura de despliegue prevista, no servicios ya integrados.
- No incluyas `runtime/`, `.openai/hosting.json`, secretos ni archivos `.env` en commits o PR. Conserva las atribuciones y licencias de imágenes y las fuentes de cada pregunta.
- Ejecuta `node tests/community.test.mjs` cuando cambies el servidor, el contenido diario o el flujo de respuestas. Para cambios de interfaz, prueba también la app con `node preview-server.mjs` y explica lo revisado.
