# 0101. Curva normal de Ascensión con la muestra inicial

- **Estado:** implementada.
- **Fecha:** 2026-11-19.
- **Quién:** Álvaro, con Codex.
- **Amplía:** [0100](0100-ascension-anuncios-y-curva.md), reduciendo el mínimo para mostrar el ajuste de cinco a dos resultados ajenos distintos.

La verificación de preprod confirma que la muestra inicial todavía es pequeña. Para que la curva solicitada sea visible también en ese estado, se ajusta desde dos resultados ajenos y dispersión positiva. La gráfica identifica siempre el ajuste como aproximado, conserva las barras observadas y excluye al propio jugador. Dos valores no certifican normalidad ni representatividad: permiten calcular una media y una dispersión descriptivas.

Con cero o un resultado ajeno, o cuando todos coinciden, se mantiene el aviso y no se inventa una campana. Se descarta conservar el mínimo de cinco porque ocultaría la funcionalidad durante la etapa inicial, y se descarta una campana fija sin relación con los resultados.
