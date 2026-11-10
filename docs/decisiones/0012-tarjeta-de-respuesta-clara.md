# 0012 — Tarjeta de respuesta: solo lo que importa

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
Después de cada pregunta, la tarjeta de respuesta repetía la pregunta y tenía leyendas, párrafos y avisos. Se veía poco nítida. Luis pidió centrarla en cuatro cosas: lo que respondió, la cifra real, el multiplicador y la distribución, y guardar el cálculo detrás de un botón.

## Decisión
- **Arriba, el veredicto:** el multiplicador en grande (por ejemplo, 2,04×), una etiqueta con la dirección («↑ Te pasaste», «↓ Corto» o «✓ Exacto») y una sola línea de posición («Más cerca que el 50% de 6 jugadores»).
- **Libro de cuentas «Tú / Real»:** dos casillas con tu cifra y la real, redondeada a tres cifras significativas, con la unidad debajo.
- **La distribución,** sin título, sin leyenda y sin párrafos.
- **Una fila de acciones:** bloc, «Cómo se calcula ▴» y «Siguiente →» (o «Ver total →» en la última pregunta).
- **«Cómo se calcula»** abre un panel dentro de la tarjeta (en el móvil, una hoja que sube desde abajo) con la pregunta, los pasos, la cuenta de referencia, los supuestos, la foto y las fuentes. Se cierra con ×, con el mismo botón o con Esc.
- La pregunta ya no se ve en la tarjeta; queda para lectores de pantalla y dentro del panel.

## Alternativas descartadas
- **Copiar tal cual la tarjeta de resultado de Fermi.gg con variaciones sutiles:** se descartó por ser un clon del diseño de otro producto. Se aplicaron los mismos principios (menos texto, cifras grandes, explicación bajo demanda) con una composición propia: el veredicto arriba, el libro «Tú / Real» y un panel en el color del texto.
- **Plegar el cálculo con un `<details>` dentro de la tarjeta (0011):** alargaba la tarjeta y mezclaba el texto con las cifras.

## Consecuencias
- La tarjeta de respuesta cabe en una pantalla sin hacer scroll en escritorio y en la mayoría de los móviles.
- Se pierde el botón «Actualizar» de la distribución: se recalcula al volver a abrir la respuesta.
