# 0094. Revelación y trazos individuales

- **Estado** — Implementada.
- **Fecha** — 2026-11-18.
- **Quién** — Álvaro, con Codex.
- **Actualiza** — [Decisión 0091](0091-reanudar-trazos-y-partidas-extra.md).

Al revelar, el jugador sigue en la misma gráfica con el trazo que acaba de dibujar. La línea negra del dato real avanza de izquierda a derecha. Después avanza una sola máscara para dibujar a la vez todas las curvas de los demás. Sus líneas finas usan varios tonos y quedan detrás del dato real y del trazo en coral. Se respeta la preferencia de reducir las animaciones.

La gráfica y la tabla prescinden de la media de la comunidad. Solo se muestran las respuestas ajenas después de revelar, con una por jugador y sin identificadores. La API devuelve páginas de 200 y el navegador las reúne antes de la animación. Si no hay respuestas de otros jugadores, muestra 200 trazos de ejemplo etiquetados como simulados.
