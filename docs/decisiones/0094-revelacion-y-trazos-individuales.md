# 0094. Revelación y trazos individuales

- **Estado** — Implementada.
- **Fecha** — 2026-11-18.
- **Quién** — Álvaro, con Codex.
- **Actualiza** — [Decisión 0091](0091-reanudar-trazos-y-partidas-extra.md).

Al revelar, el jugador sigue en la misma gráfica con el trazo que acaba de dibujar. La línea negra del dato real avanza de izquierda a derecha. Después avanza una sola máscara para dibujar a la vez todas las curvas de los demás. Los trazos de la comunidad usan violeta y 1,25 píxeles de grosor. La opacidad de cada trazo permite ver una respuesta aislada y la opacidad del grupo suaviza las zonas de mayor coincidencia. El dato real y el trazo propio se dibujan por encima con un borde claro para seguirlos en los cruces. Se respeta la preferencia de reducir las animaciones.

La gráfica y la tabla prescinden de la media de la comunidad. Solo se muestran las respuestas ajenas después de revelar, con una por jugador y sin identificadores. La API devuelve páginas de 200 y el navegador las reúne antes de la animación. Si no hay respuestas de otros jugadores, muestra 200 trazos de ejemplo etiquetados como simulados.

Las etiquetas de color se leen al final de las curvas. Si coinciden dos o más extremos, cada texto se separa y conserva un conector a su posición final. La etiqueta de la comunidad apunta al trazo que ocupa el centro al ordenar sus extremos verticalmente.
