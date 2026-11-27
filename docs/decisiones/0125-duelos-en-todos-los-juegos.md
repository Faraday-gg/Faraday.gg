# 0125. Duelos de Ascensión, Traza y Archivo Vivo

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-27
- **Quién:** Luis, con Claude

## Contexto

Un duelo solo usaba preguntas de estimación del reto diario ([0023](0023-duelos-1vs1.md)). Luis quiere poder batirse en duelo en el resto de juegos, y retar a cualquiera de ellos desde el lobby ([0124](0124-lobby-publico-al-entrar.md)).

## Decisión

- **El duelo tiene un campo `game`:** `estimacion` (por defecto y para los duelos que ya existían), `ascension`, `traza` y `archivo`. Se fija al crear o buscar, se hereda en la revancha y la partida rápida solo empareja el mismo juego, modo y tamaño.
- **El motor es el mismo y cada juego es un adaptador** (`lib/duelos-juegos.mjs`): banco de rondas, validación de la respuesta, puntuación, lo que ve el jugador antes y después de resolver, y bot. La estimación es un adaptador más dentro de `lib/duelos.mjs`.
- **Puntos de 0 a 5000 en todos**, para que la vida de 6000, el daño y los multiplicadores ([0083](0083-multiplicadores-personales-en-duelos.md)) valgan igual: la rareza de Ascensión se multiplica por 50 y los puntos de Traza y de Archivo Vivo por 5.
- **Rondas:** 10 en estimación, 7 en Ascensión y 5 en Traza y en Archivo Vivo. Los tiempos están en la [0127](0127-tiempo-limite-en-todos-los-modos.md).
- **Combinaciones:** los cuatro juegos valen para 1 contra 1 con código, partida rápida, práctica contra el bot y duelo de tres. Las clasificatorias siguen siendo solo de estimación.
- **Cada juego evita lo que sale hoy en su edición diaria** y, entre duelos, lo ya visto por los jugadores, como hacía la estimación.
- **Archivo Vivo en duelo no admite apuesta ni paga faradios.** Los años de las fotos viajan al navegador en `dist/archivo-vivo-rondas.js` y el banco tiene pocas fotos: quien lea el archivo o las memorice gana siempre. La experiencia y lo cosmético siguen.
- **Cliente:** `dist/duel-games.js` pinta la pregunta, la respuesta, el resultado y el repaso de los tres juegos nuevos (texto en Ascensión; trazo con ratón, dedo o teclado en Traza; foto y año en Archivo Vivo, con sus créditos y licencia siempre a la vista). El portal de duelos tiene un selector de juego.
- **`window.Duel`** (`open`, `create({game})`, `join(code)`, `cancel()`, `GAMES`) es lo que usa el lobby para retar.
- **No hay migración:** el juego va dentro del JSON `state` de `duels`.

## Alternativas descartadas

- **Un motor de duelo por juego:** cuatro copias del reloj, la vida, el chat, las apuestas y la revancha.
- **Reutilizar el lienzo de `dist/tendencias.js`:** está cerrado en su módulo; el del duelo es más simple (un valor por periodo).
- **El visor 360° de Archivo Vivo en el duelo:** con 45 s por foto no da tiempo a explorarlo; la foto es plana y se puede ampliar.
- **Clasificatorias en los juegos nuevos:** los bancos son pequeños y el rango mezclaría habilidades distintas.

## Consecuencias

- El banco de Archivo Vivo es pequeño: a los pocos duelos entre los mismos jugadores se repiten fotos.
- El duelo de Archivo Vivo usa también fotos retiradas del modo por no tener recreación 360°, para llegar a cinco rondas.
- Los duelos en curso al desplegar siguen valiendo (sin `game` son de estimación); su ronda abierta conserva el plazo antiguo.
- Preview y producción comparten la tabla `duels`: mientras producción no tenga este código, no hay que probar en Preview la partida rápida de los juegos nuevos (un jugador de producción podría emparejarse); con código privado sí.
