# 0095. Celebraciones elegidas por resultado y modalidad

- **Estado** — Implementada.
- **Fecha** — 2026-11-19.
- **Quién** — Álvaro, con Codex.
- **Amplía** — [0033](0033-avatar-en-el-reto-y-recompensa.md), [0053](0053-bailes-del-avatar.md) y [0087](0087-graficas-y-partida-extra.md).

Álvaro pide que el avatar pueda usar celebraciones elegidas por el jugador en los distintos niveles de resultado, como preparación para un futuro juego de respuestas raras.

## Decisión

El armario incorpora «Celebraciones y emotes», con 22 gestos existentes y vista previa sobre el avatar vestido. Hay una selección general y ajustes independientes para reto diario, archivo, duelo de dos, duelo de tres, clasificatorias y Traza la tendencia. Cada hueco puede heredar la selección general, recuperar el gesto original de ese modo, elegir otro o quedarse sin gesto. Restablecer un modo elimina sus excepciones y recupera la herencia.

El reto, archivo y duelos comparten los siete tramos del multiplicador del reto diario. En los duelos la reacción de la ronda expresa la precisión de la respuesta; el marcador y el daño siguen expresando quién ganó. El final permite elegir victoria, empate y derrota. Traza conserva sus cinco umbrales (950, 800, 600 y 350 puntos) y el puño original del tramo de 600–799. La portada y los premios de los cofres tienen también un hueco general configurable.

`dist/celebrations.js` reúne catálogo, umbrales, normalización, herencia y selección de reacciones. `Progress.reaction(mode, cue, options)` lo conecta con los juegos. La configuración se guarda en `state.celebrations`, dentro del progreso existente: persiste en el navegador y utiliza la sincronización de la cuenta. No necesita migración.

El perfil de entrada a los duelos lleva una selección compacta para los tres modos de duelo. El servidor limita los campos y acepta solo identificadores cortos; el cliente receptor los contrasta con su catálogo. Cada rival ve las elecciones del otro al entrar a la partida. Los duelos anteriores sin configuración siguen funcionando. Si se cambia una elección durante la partida, se aplica al propio avatar; el rival la recibe al entrar en la siguiente.

Los gestos elegidos se mantienen en la celebración, en lugar de volver inmediatamente al sorteo de otros bailes. El desmayo se ejecuta una vez y acaba tumbado. Repasar una respuesta no vuelve a lanzar el gesto, y la preferencia de reducir movimiento conserva las posturas sin animaciones.

## Alcance y alternativas

Los 22 gestos existentes siguen incluidos para todos. No se añade todavía una economía de emotes: la obtención de nuevos gestos mediante cofres, tienda y mercado necesita catálogo de piezas y validación del inventario en el servidor. No se deben convertir las preferencias cosméticas en prueba de propiedad de un emote de pago.

Se descarta duplicar umbrales y reglas en cada juego: dificultaría aplicar una elección de forma consistente. Se descarta integrar ya el nuevo juego de rareza: Álvaro pide primero una recomendación sobre la actividad del avatar. La propuesta está en [Ascensión](../ideas/ascension-respuestas-raras.md).

## Comprobaciones

18 suites de Node, incluidas las 16 exigidas por AGENTS.md, tendencias y celebraciones. La nueva prueba comprueba fronteras de puntuación, herencia, restauración del original, preferencias inválidas, guardado y catálogo de animaciones. Duelos comprueba limpieza de los identificadores y transmisión al rival. Revisión visual local a 1280 y 375 px, vista previa, recarga, respuesta exacta y victoria con Disco elegido. Sin errores de consola en los recorridos revisados.
