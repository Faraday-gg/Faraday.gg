# 0089. Merge automático de PR comprobadas hacia preprod

- **Estado:** aceptada
- **Fecha:** 2026-11-17
- **Quién:** Álvaro, con Codex

## Contexto

Las instrucciones reservaban el merge a Luis aunque Álvaro y Luis tienen la misma autoridad en la organización. Álvaro autorizó completar la integración automáticamente una vez que la tarea esté lista y las comprobaciones pasen.

## Decisión

El agente abre la PR desde la rama de trabajo y la fusiona hacia `preprod` cuando esté lista y cumpla los controles del repositorio. Una publicación en producción sigue el flujo `preprod` → `main` y requiere autorización explícita de Luis o Álvaro.

## Alternativas consideradas

Mantener un turno manual de aprobación para cada PR retrasa la integración de cambios que ya tienen autorización. Los push directos quitarían el registro de la PR y de sus comprobaciones.

## Consecuencias

Cada integración conserva el enlace de la PR y el resultado de las comprobaciones. El agente comunica si la PR se fusionó o si GitHub impide integrarla.
