# 0084. Continuar desde el resultado de la calculadora

- **Estado** — Aceptada
- **Fecha** — 2026-11-17
- **Quién** — Álvaro, con Codex
- **Actualiza** el funcionamiento de `=` en la [decisión 0049](0049-calculadora-sencilla.md).

## Contexto

Al pulsar `=`, el campo seguía mostrando la operación completa. Si el jugador añadía otro operador, la calculadora volvía a evaluar toda la expresión según su precedencia. Por ejemplo, después de `2 + 3 = 5`, añadir `× 4` daba `14`.

## Decisión

Al pulsar `=` o Intro, el resultado de una operación válida ocupa el campo editable y el cursor queda al final. En el ejemplo, escribir `× 4` a continuación forma `5 × 4` y da `20`. El campo usa el formato decimal español y conserva la precisión del resultado durante el encadenamiento.

El historial sigue guardando la expresión original y su resultado con el formato y las acciones de la [decisión 0051](0051-historial-de-la-calculadora.md). El bloc compartido aplica este comportamiento en el reto diario y en los duelos. Si hay un error de cálculo, el campo conserva la operación para que se pueda corregir.

## Alternativa descartada

Recuperar el resultado desde la cinta permite encadenar operaciones, pero obliga a tocar una fila entre cada paso.
