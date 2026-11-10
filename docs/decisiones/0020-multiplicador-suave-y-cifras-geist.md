# 0020 — Multiplicador suave y cifras en Geist

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code
- **Sustituye en parte a:** [0014](0014-distribucion-simulada-y-cifras.md) (la fuente de las cifras y el ritmo de la animación)

## Contexto
Luis vio la tarjeta de respuesta tosca: el multiplicador «bailaba» al subir (cambiaba de 1× a 1,3× y 1,35×, y con ello el ancho y la posición de la etiqueta de al lado) y las cifras en Manrope 800 se veían pesadas. Pidió una animación suave y una fuente más minimalista y tranquila.

## Decisión
- **Cifras en Geist** (Google Fonts), fina (300) en el multiplicador y el resumen, 400–500 en «Tú / Real» y las filas, con números tabulares. Sustituye a Manrope también en la demo de la portada.
- **Contador estable:** durante la subida se muestran siempre los mismos decimales que la cifra final y se reserva su ancho, así nada se mueve alrededor.
- **Ritmo calmado:** sigue en escala logarítmica, pero dura de 1,3 a 2,2 s y frena despacio al final (curva cuártica). Arranca con un fundido desde un ligero desenfoque.
- **Entrada en orden:** la etiqueta, las tarjetas «Tú / Real», la unidad y las barras del gráfico (que crecen desde abajo una tras otra) aparecen con la misma curva suave.
- Con «reducir movimiento» del sistema no se anima nada.

## Alternativas descartadas
- **Mantener Manrope con menos peso:** sus números siguen siendo anchos y redondos; no daban la sensación de calma pedida.
- **Animar dígito a dígito (tipo cuentakilómetros):** más código y más movimiento en pantalla, lo contrario de lo que se buscaba.

## Consecuencias
- La fuente web Manrope deja de cargarse y entra Geist en su lugar (sigue siendo una sola fuente extra para cifras).
