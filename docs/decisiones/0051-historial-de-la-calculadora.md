# 0051 — Historial de la calculadora como cinta de recibo

- **Fecha:** 2026-11-14
- **Quién:** Luis, con Claude Code
- **Modifica:** el historial del bloc (calculadora y notas)

## Contexto
El historial de la calculadora estaba al final del bloc, debajo de las notas. En el móvil había que bajar del todo para verlo, el resultado se leía pequeño, los números de cuatro cifras salían sin separador de miles («7300») y cada fila tenía dos botones («Usar» y «×») del mismo peso. Al pulsar «Usar» no había ninguna señal de que el resultado había vuelto a la calculadora.

## Decisión
- **Sitio:** el historial pasa a ser una cinta de recibo justo encima de la pantalla de la calculadora, dentro de la sección «Calculadora». Las notas quedan debajo, como antes.
- **Orden:** el cálculo más reciente queda abajo, pegado a la pantalla, como el papel de una sumadora; los anteriores suben. La lista usa `flex-direction: column-reverse`, así arranca ya desplazada hasta el último sin JavaScript, también cuando se abre el bloc.
- **Filas:** la operación en gris pequeño y, debajo, el resultado grande, alineado a la derecha, con separador de miles siempre (`es-ES`, `useGrouping: 'always'`, hasta 6 decimales).
- **Reutilizar:** toda la fila es un botón. Al tocarla, el resultado vuelve a la calculadora: se añade a la operación si esta termina en un operador o en «(» (para encadenar, «3 × 7300») y la sustituye en los demás casos. Se escribe con coma decimal y redondeado a 12 cifras significativas para quitar el ruido de coma flotante. La fila y la pantalla parpadean en amarillo un momento.
- **Borrar:** una «×» discreta por fila (más visible al pasar el ratón o en pantallas táctiles, con área de 36 px). Tras borrar, el foco pasa a la fila vecina. «Vaciar historial» está en la cabecera de la calculadora y solo aparece si hay cálculos; mantiene la confirmación de antes.
- **Vacío:** «Tus cálculos aparecerán aquí. Toca uno para volver a usarlo.»
- **Móvil:** la cinta tiene scroll propio y una altura `clamp(42px, min(86dvh, 640px) − 540px, 100px)`: en un 375 × 812 caben dos filas y media y el teclado entero queda a la vista sin desplazar la hoja; en móviles más bajos se queda en una fila.
- **Accesibilidad:** botones reales con `aria-label` («Usar 7.300, resultado de (12+8) × 365», «Borrar el cálculo …»), contorno de foco visible y animaciones desactivadas con `prefers-reduced-motion`. La lista ya no es `aria-live` (la anunciaba entera en cada cálculo; el resultado ya se anuncia en la pantalla).
- Los datos no cambian: `workspaceData.history` sigue siendo una lista de `{expression, result}` del más nuevo al más viejo, con el mismo límite de 40.

## Alternativas descartadas
- **Cinta debajo de la pantalla, entre la pantalla y las teclas.** Separa la operación de las teclas con las que se escribe y empuja el teclado hacia abajo en cada cálculo.
- **Dejar el historial al final del bloc.** Es lo que lo hacía invisible en el móvil.
- **Mantener el botón «Usar» por fila.** Toda la fila como botón es un objetivo mayor y deja una sola acción secundaria (borrar).
- **Sustituir siempre la operación al reutilizar.** Impide encadenar un resultado con lo que ya se está escribiendo.

## Consecuencias
- Las teclas y el momento en que se borra el historial no cambian (los llevan otras ramas: `feat/calculadora-sencilla` y `fix/historial-por-pregunta`).
- La altura de la cinta en el móvil depende de lo que mide el resto de la calculadora (unos 540 px). Si se quitan teclas, sobra sitio; si se añaden, hay que revisar ese número.
- El juego no tiene modo oscuro, así que no hay variante oscura que mantener.
