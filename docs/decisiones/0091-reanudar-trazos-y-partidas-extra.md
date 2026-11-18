# 0091. Reanudar el dibujo, comparar trazos y seguir jugando

- **Estado** — Implementada.
- **Fecha** — 2026-11-18.
- **Quién** — Álvaro, con Codex.
- **Actualiza** — [Decisión 0087](0087-graficas-y-partida-extra.md) y [decisión 0090](0090-curva-editable-y-banco-de-historias.md).

El punto amarillo muestra hasta dónde llega el tramo continuo. Arrastrarlo extiende el trazo desde ese punto y conserva lo que ya estaba dibujado. Arrastrar el resto de la línea ajusta la curva. El avatar lateral gana tamaño y comunica su reacción con la animación.

Con menos de tres jugadores más en la gráfica, la revelación muestra la media de 32 trazos simulados. Ocho perfiles por estrategia prueban cuatro formas de continuar el historial visible: mantener el último dato, extrapolar la tendencia local, prolongar la tendencia general y aproximarse a la media reciente. La semilla por gráfica mantiene la comparación estable entre jugadores. Las simulaciones se identifican en la leyenda y se generan en memoria aparte de las respuestas. Al alcanzar tres jugadores más aparece la media real.

El resultado de cada partida ofrece volver a jugar. En el plan gratuito se comprueba el anuncio de prueba por cada grupo de tres gráficas y se mantiene el acceso a la suscripción. Plus abre cada partida extra directamente. La rotación recorre las gráficas ajenas a la diaria antes de volver a empezar. Si una gráfica se repite, cuenta la primera respuesta de cada jugador para la media real.

El servidor hace avanzar el número de partida y distingue los reintentos de cada anuncio y respuesta. El resultado recupera la diaria y la última partida extra. Se conserva la numeración y el desbloqueo de la primera partida extra de la versión anterior.
