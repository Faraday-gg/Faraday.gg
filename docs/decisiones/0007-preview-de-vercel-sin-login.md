# 0007. Despliegues de Vercel sin Vercel Authentication

- **Estado:** aceptada. Sustituye en parte a la [0006](0006-vercel-hobby-en-la-cuenta-de-alvaro.md) en lo relativo a quién puede abrir los despliegues Preview.
- **Fecha:** 2026-11-09
- **Quién:** Álvaro (con Claude); para conocimiento de Luis

## Contexto

El proyecto `faraday-gg` se creó con Vercel Authentication en modo estándar: todos los despliegues, salvo los dominios de producción, pedían iniciar sesión en Vercel con acceso a la cuenta. La cuenta es Hobby y no admite miembros de equipo, así que solo Álvaro podía abrir las Preview. Luis no podía revisar la Preview de `preprod` ni la de sus PR antes de fusionarlas.

En Hobby no hay protección con contraseña: es de los planes Pro y Enterprise.

## Decisión

Se desactiva Vercel Authentication en el proyecto `faraday-gg`. Las Preview, como la de `preprod`, se abren sin iniciar sesión.

Se mantiene activa *Git Fork Protection*: una PR desde un *fork* de terceros no se despliega, ni recibe las variables de entorno, sin que alguien la autorice en Vercel.

## Alternativas descartadas

| Opción | Por qué no |
| --- | --- |
| Mantener la protección y generar enlaces temporales para Luis | Hay que crear un enlace en cada revisión, y solo puede hacerlo Álvaro. |
| Protección con contraseña | No está disponible en Hobby. |
| Pasar a Pro con los dos en el equipo | Tiene coste por miembro, y queremos seguir gratis ([decisión 0006](0006-vercel-hobby-en-la-cuenta-de-alvaro.md)). |

## Consecuencias

- Abrir las Preview no expone nada que no sea ya público: el repositorio es público ([decisión 0004](0004-repositorio-publico-en-organizacion.md)) y producción también lo es.
- Las Preview usan la misma base de datos que producción ([decisión 0001](0001-supabase-un-solo-entorno.md)). Cualquiera que tenga la URL de una Preview puede enviar respuestas reales, igual que en producción.
- La clave secreta de Supabase sigue solo en el servidor; el navegador no la recibe ([decisión 0002](0002-acceso-a-supabase-solo-desde-el-servidor.md)).
- **Revisar** si una Preview llega a tener algo que no deba verse antes de publicarse, o al crear un entorno de preprod en Supabase.
