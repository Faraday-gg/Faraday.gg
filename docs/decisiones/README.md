# Decisiones

Registro de decisiones tomadas. Cada una en un archivo numerado `NNNN-titulo-breve.md`, que no se reescribe: si una decisión cambia, se crea otra nueva que la sustituye y se enlazan entre sí.

| Nº | Decisión | Estado | Fecha |
| --- | --- | --- | --- |
| [0001](0001-supabase-un-solo-entorno.md) | Supabase con un solo entorno (`main`), sin preprod | Aceptada | 2026-11-09 |
| [0002](0002-acceso-a-supabase-solo-desde-el-servidor.md) | Acceso a Supabase solo desde el servidor | Aceptada | 2026-11-09 |
| [0003](0003-despliegue-en-vercel.md) | Despliegue en Vercel con una función que usa el esquema de Supabase | Aceptada (en parte sustituida por 0006) | 2026-11-09 |
| [0004](0004-repositorio-publico-en-organizacion.md) | Repositorio público en la organización `Faraday-gg` | Aceptada | 2026-11-09 |
| [0005](0005-contenido-servido-desde-supabase.md) | El contenido se sirve desde Supabase | Aceptada | 2026-11-09 |
| [0006](0006-vercel-hobby-en-la-cuenta-de-alvaro.md) | Vercel Hobby en la cuenta de Álvaro, con el repositorio público en la organización `Faraday-gg` | Aceptada (en parte sustituida por 0007) | 2026-11-09 |
| [0007](0007-preview-de-vercel-sin-login.md) | Despliegues de Vercel sin Vercel Authentication | Aceptada | 2026-11-09 |
| [0008](0008-categorias-y-archivo.md) | Categorías con icono y archivo desde el 9 de agosto de 2026 | Aceptada | 2026-11-10 |
| [0010](0010-juego-a-pantalla-completa.md) | Juego a pantalla completa, centrado en la pregunta | Aceptada; la parte de pantalla completa la sustituye la 0011 | 2026-11-10 |
| [0011](0011-juego-en-tarjeta.md) | El juego dentro de una tarjeta | Aceptada | 2026-11-10 |
| [0012](0012-tarjeta-de-respuesta-clara.md) | Tarjeta de respuesta: solo lo que importa | Aceptada | 2026-11-10 |
| [0013](0013-distribucion-simulada-y-cifras.md) | Distribución simulada, multiplicador animado y cifras más legibles | Aceptada | 2026-11-10 |

## Plantilla

```markdown
# NNNN. Título

- **Estado:** propuesta | aceptada | sustituida por NNNN
- **Fecha:** AAAA-MM-DD
- **Quién:** nombres

## Contexto
Qué problema había y qué limitaciones.

## Decisión
Qué hacemos.

## Alternativas descartadas
Qué otras opciones había y por qué no.

## Consecuencias
Qué implica, riesgos y cuándo revisarla.
```
