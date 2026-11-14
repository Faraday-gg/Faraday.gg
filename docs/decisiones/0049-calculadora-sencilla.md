# 0049 — Calculadora sencilla del bloc

- **Fecha:** 2026-11-14
- **Quién:** Luis, con Claude Code
- **Modifica:** la calculadora del bloc (`#workspace-panel`), que comparten el reto diario y los duelos

## Contexto
La calculadora tenía una fila de teclas científicas (x², x³, xʸ, √, %) y paréntesis que casi nadie usa en una estimación de Fermi y que llenaban el panel. La tecla de borrar (⌫) salía como un cuadrado vacío en algunos dispositivos, porque la fuente no tiene ese carácter, y estaba abajo, lejos de C. Además, los números se veían sin separador de miles (`800000`), difíciles de leer cuando se trabaja con órdenes de magnitud.

## Decisión
- **Teclas:** solo dígitos, coma decimal, + − × ÷, =, C, borrar y π. Fuera x², x³, potencias, raíz, % y paréntesis. Se mantiene la multiplicación implícita con π (`2π`).
- **Distribución** de calculadora de móvil: arriba `C · borrar · π · ÷`; debajo 7‑8‑9 ×, 4‑5‑6 −, 1‑2‑3 +; abajo `0` (doble ancho), `,` e `=`. Borrar queda junto a C.
- **Icono de borrar** dibujado con un SVG en línea, no con un carácter Unicode.
- **Formato es-ES en el campo:** mientras se teclea se ve `800.000 × 2,5` (miles con punto, decimales con coma, espacios alrededor de los operadores). El resultado se muestra igual, con separador de miles también en cifras de cuatro dígitos (`1.000`).
- Por dentro se trabaja con una forma «compacta» (sin espacios ni puntos de miles). El evaluador quita los puntos de miles y cambia la coma por punto antes de calcular.
- **Teclado físico:** el punto y la coma son siempre la coma decimal; `*`, `x`, `/`, `-` y `pi` se convierten en ×, ÷, − y π; Intro o `=` calculan; Retroceso y Supr se saltan los puntos y espacios. Al pegar, `1.500` o `1.500,5` se leen con puntos de miles y `2.5` con punto decimal.
- «Usar» del historial mete el resultado en el campo con el mismo formato.

## Alternativas descartadas
- **Conservar el %.** Luis pidió quitar todo lo científico menos π; el % se puede hacer con `× 0,15`.
- **Mantener los paréntesis.** Sin potencias ni raíces aportan poco y ocupan una fila; la cuenta se puede partir en pasos con «Usar».
- **Punto como separador decimal** (como antes, que aceptaba los dos). Choca con los puntos de miles que se ven en el campo.

## Consecuencias
- El historial no cambia de formato ni de comportamiento (lo llevan otras ramas); las operaciones antiguas guardadas con punto decimal se siguen viendo igual, solo como texto.
- Una operación con caracteres que ya no se admiten (`^`, `√`, paréntesis) se marca como «Revisa la operación».
