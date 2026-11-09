---
name: sincronizar
description: Sincroniza la documentación del proyecto con el trabajo hecho en la sesión. Actualiza ARQUITECTURA.md, README.md, AGENTS.md y docs/ (bitácora, decisiones, mejoras, ideas) para que el otro colaborador sepa exactamente qué se hizo antes de revisar la PR. Úsala cuando el colaborador diga "sincronizar", "sincroniza", "actualiza los .md" o acepte sincronizar al terminar una tanda de cambios.
---

# Sincronizar la documentación

En este proyecto trabajan dos personas, Luis (`borgesinmas`) y Álvaro, cada una con sus agentes. Esta skill deja escrito en el repositorio todo lo que se ha hecho en la sesión, para que quien revise la PR lo entienda sin haber visto la conversación. Sigue también las normas de [AGENTS.md](../../../AGENTS.md).

## Cuándo ofrecerla

Cuando el colaborador haya hecho varios cambios y la tarea parezca terminada (antes de abrir o actualizar la PR), pregúntale exactamente:

> ¿Quieres sincronizar ya o más tarde?

- Si dice **ya** (o sí), ejecuta los pasos de abajo.
- Si dice **más tarde**, no toques los `.md` y vuelve a preguntarlo antes de abrir la PR o al final de la sesión.
- No la ofrezcas tras un cambio pequeño y aislado ni más de una vez seguida si ya dijo "más tarde" y no ha habido cambios nuevos.

## Pasos

### 1. Comprobar la rama

```bash
git status -sb
git fetch origin
```

- Si estás en `main` o `preprod`, **para**: crea una rama `feat/...` o `fix/...` desde `origin/preprod` como dice AGENTS.md antes de escribir nada.
- Si hay cambios sin guardar que no son de esta sesión, pregunta antes de mezclarlos.

### 2. Reunir qué se ha hecho

Usa todas estas fuentes; no inventes nada que no puedas comprobar:

```bash
git log --oneline origin/preprod..HEAD
git diff --stat origin/preprod...HEAD
git diff origin/preprod...HEAD
git status --short
```

Y además lo ocurrido en la conversación: acciones en servicios externos (Supabase, Vercel, GitHub, cuentas), intentos fallidos, decisiones tomadas y descartadas, problemas detectados que no se han arreglado.

Lee antes de editar: `ARQUITECTURA.md`, `README.md`, `AGENTS.md`, `docs/README.md`, la bitácora del mes en `docs/bitacora/` y los índices de `docs/decisiones/`, `docs/mejoras/` e `docs/ideas/`.

### 3. Actualizar cada documento solo si le afecta

| Documento | Actualízalo cuando… |
|---|---|
| `docs/bitacora/AAAA-MM.md` | **Siempre.** Una entrada nueva arriba del todo con fecha, quién (colaborador y agente), rama, qué se hizo, qué servicios se tocaron y el resultado. Si el archivo del mes no existe, créalo y añádelo al índice `docs/bitacora/README.md`. |
| `docs/base-de-datos.md` | Hay una migración nueva en `supabase/migrations/`, se aplicó algo en Supabase o cambian tablas, funciones, permisos o variables de entorno. Actualiza tablas, historial de migraciones, fecha y «Pendiente». Si puedes, comprueba con el conector de Supabase que coincide con la base de datos real. |
| `ARQUITECTURA.md` | Cambian el stack, la estructura de carpetas, las rutas de la API, el flujo de una partida, los entornos o los servicios (proyecto o URL de Supabase, Vercel, variables de entorno por nombre). |
| `README.md` | Cambia cómo se arranca, se prueba o se configura la app. |
| `AGENTS.md` | Cambia una norma de trabajo, de ramas o de comprobaciones. |
| `docs/decisiones/` | Se tomó o se cambió una decisión técnica o de producto: archivo nuevo `NNNN-titulo.md` con la plantilla de su README y una fila en la tabla. Nunca reescribas una decisión anterior: márcala como sustituida. |
| `docs/mejoras/README.md` | Se detectó un problema que no se arregla ahora (fila nueva) o se resolvió uno existente (estado "Hecha" y enlace a la PR o rama). |
| `docs/ideas/README.md` | Surgió una propuesta que no se va a hacer todavía. |

Formato de la entrada de bitácora:

```markdown
## AAAA-MM-DD — Título breve
- **Quién:** nombre del colaborador, con <agente>
- **Rama:** `feat/...`
- **Qué:** lista corta de los cambios, en lenguaje claro
- **Servicios externos:** lo que se cambió o intentó fuera del repositorio, o "Ninguno"
- **Comprobaciones:** qué se ejecutó y su resultado
- **Pendiente:** lo que queda o no se pudo comprobar, o "Nada"
```

Normas:

- Español, frases cortas, para alguien que no ha visto la conversación.
- Nunca escribas claves, tokens, contraseñas, valores de `.env` ni datos de jugadores. Las variables de entorno se citan solo por su nombre.
- No cambies documentos que no se ven afectados ni reformatees lo que ya está bien.
- Si no estás seguro de algo (por ejemplo, quién tomó una decisión), pregunta en vez de suponerlo.

### 4. Revisar, confirmar y subir

1. Enseña al colaborador un resumen de qué documentos cambiaste y por qué.
2. Haz commit solo de esos archivos (`git add <archivo>`, nunca `git add -A`), en la rama de la tarea:
   `Sincroniza la documentación con <resumen breve>`.
3. Sube la rama (`git push -u origin <rama>`). Si la PR ya existe, deja un comentario con lo que se ha documentado (`gh pr comment`); si no existe, ofrécete a abrirla hacia `preprod` usando la entrada de la bitácora como base de la descripción.
4. No hagas merge ni cambies `main` o `preprod`.
