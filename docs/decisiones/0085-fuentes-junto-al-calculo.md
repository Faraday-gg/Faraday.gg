# 0085. Explicar de dónde sale cada cifra del cálculo

- **Estado:** propuesta
- **Fecha:** 2026-11-17
- **Quién:** Álvaro, con Codex
- **Amplía:** [0029, cálculo por pasos](0029-calculo-por-pasos.md) y [0048, cálculo en duelos](0048-calculo-y-sin-repetir-en-duelos.md).

## Contexto

La tabla derivada de una fórmula producía filas como «Partimos de», sin identificar qué medía cada cifra. Incluso en las tablas escritas a mano, las fuentes se mostraban como una lista de enlaces sin decir qué aportaban.

## Decisión

- Usar filas solo si están escritas para la pregunta. Si faltan, mostrar la explicación en lenguaje natural y ofrecer la operación original cuando aporte algo.
- Mostrar qué dato aporta cada fuente, y permitir enlazarla desde la fila correspondiente con `source` (posición empezando por 1). Un dato elegido para el juego puede llevar `assumed: true`. Las conversiones exactas pueden ir sin cita.
- Colocar el razonamiento completo en el mismo panel. Ha de permitir reproducir la cuenta o entender cuánto cambia al variar un supuesto. En duelos esto aparece al terminar la ronda y en el repaso.
- Comprobar por separado la aritmética, la validez del modelo y el respaldo de cada dato. Un enlace que responde y una operación que cuadra son comprobaciones distintas de que el dato sea correcto.

## Alternativas descartadas

- Etiquetar automáticamente los números de una fórmula: la fórmula no dice qué magnitudes son ni de dónde vienen.
- Recalcular las respuestas de producción en la misma tanda: antes hay que reconciliar el banco publicado y separar las revisiones que afecten a puntuaciones.

## Consecuencias

Sin cambios de esquema. Los campos nuevos son opcionales. Ya puede leerse la explicación del archivo con sus fuentes; quedan pendientes las filas escritas a mano para buena parte del banco. El alcance y la reconciliación pendiente están en la [auditoría](../mejoras/auditoria-preguntas.md).
