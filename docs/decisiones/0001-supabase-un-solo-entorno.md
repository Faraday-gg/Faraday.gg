# 0001. Supabase con un solo entorno (`main`), sin preprod

- **Estado:** aceptada
- **Fecha:** 2026-11-09
- **Quién:** Luis (con Claude Code); para conocimiento de Álvaro

## Contexto

En Git trabajamos con dos ramas largas: `preprod` (integración y pruebas) y `main` (producción). Queríamos lo mismo en la base de datos: una rama `preprod` dentro del proyecto de Supabase `Faraday Game` (referencia `umiqvlccxxafvafroxii`, organización `Faraday.gg`), para probar migraciones sin tocar producción.

El 9 de noviembre de 2026 se intentó crear esa rama, desde el agente y desde el selector de ramas del panel. **No se pudo**, porque:

- Las ramas de base de datos de Supabase (*branching*) solo están disponibles en el **plan Pro** (25 $/mes por organización). La organización `Faraday.gg` está en el **plan gratuito**.
- Aunque estuviéramos en Pro, cada rama es un entorno completo que se factura aparte por horas de cómputo (desde unos 0,013 $/hora, alrededor de 10 $/mes para una rama persistente) y no queda cubierta por el límite de gasto.

## Decisión

Trabajamos con **un único entorno de Supabase**: la rama `main` (*production*) del proyecto `Faraday Game`. No hay base de datos de preprod.

## Alternativas descartadas

| Opción | Por qué no, de momento |
| --- | --- |
| Pasar la organización a Pro y crear una rama persistente `preprod` | Coste fijo (25 $/mes más el cómputo de la rama) sin usuarios ni datos todavía. |
| Crear un segundo proyecto gratuito como preprod | Gratis, pero hay que mantener dos proyectos sincronizados a mano y los proyectos gratuitos se pausan tras 7 días sin actividad. No compensa con el esquema aún vacío. |

## Consecuencias

- La rama `preprod` de Git sigue siendo obligatoria para el código, pero preprod y producción usan **la misma base de datos**.
- Los cambios de esquema se escriben como migraciones SQL en el repositorio, se revisan en su PR y solo se aplican a Supabase tras aceptarla. Ningún agente aplica migraciones, borra datos ni cambia políticas sin confirmación explícita del responsable.
- Las pruebas automáticas no escriben en Supabase.
- Todo cambio aplicado en Supabase se anota en [la bitácora](../bitacora/).
- **Revisar esta decisión** cuando haya jugadores reales cuyos datos haya que proteger, o antes del primer despliegue público: en ese momento conviene pasar a Pro con rama `preprod` o crear un segundo proyecto.
