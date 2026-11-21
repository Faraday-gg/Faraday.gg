# 0113. Estadísticas por juego en el perfil

- **Fecha** · 2026-11-21.
- **Estado** · Implementada.
- **Amplía** · el perfil del jugador ([progreso](0024-avatar-faradios-y-misiones.md), [«Casi casi»](0030-momento-casi-casi.md) y [medallas](0035-medallas-e-insignias.md)).

## Problema

El perfil enseñaba nivel, faradios, medallas y el contador de «Casi casi», pero no cuánto había jugado cada uno. No había forma de presumir de partidas jugadas, duelos ganados o metros subidos en Ascensión.

## Decisión

El perfil tiene una quinta pestaña, «Stats», con una ficha por juego:

- **Reto del día:** retos completados, respuestas, «Casi casi», respuestas a menos de 2×, retos redondos y mejor racha de días.
- **Duelos:** jugados, ganados, porcentaje de victorias, empatados, perdidos y mejor racha, con el desglose de partida rápida y amigos, clasificatorias y duelo de tres. No cuentan las prácticas con el bot ni los abandonados, igual que en las medallas.
- **Ascensión:** partidas, metros ascendidos, mejor ascensión y respuestas de cumbre, más una comparación: los metros se comparan con una altura o un viaje conocido («Eso es como subir 2,2 veces el Everest», «como ir de Madrid a París, pero hacia arriba») y se dice lo que falta para el siguiente. La lista va de la Giralda (104 m) a la Luna (384.400 km).
- **Traza** y **Archivo Vivo:** partidas, puntos y mejor partida.

Las cifras nuevas se guardan en el progreso (`state.plays`), así que viajan con la cuenta como el resto, sin tablas ni migraciones. Las que ya existían (retos, racha, «Casi casi», victorias) se leen de donde estaban.

Cada juego por rondas avisa con `Progress.tally(juego, clave, valores, rondas)` cada vez que recibe el estado de la partida del servidor. Se recuerda cuántas rondas de cada partida reciente están ya apuntadas (las últimas 12 claves por juego), así que volver a abrir una partida o recargar no suma dos veces. Los duelos llegan por el evento `faraday:duel`, que ahora incluye la modalidad.

## Límites conocidos

- Ascensión, Traza, Archivo Vivo y el desglose de duelos se cuentan desde que existe el apartado: no hay historial anterior que recuperar en el navegador. Quien ya jugaba conserva sus retos y los duelos que recordaba su navegador. La pestaña lo dice.
- Son cifras que declara el navegador, como las de las medallas: valen para presumir, no para repartir premios ni para clasificaciones.

## Alternativas descartadas

- **Calcularlas en el servidor** a partir de las partidas guardadas: daría el historial completo y cifras verificadas, pero pide una consulta por juego y por almacén (Ascensión, Traza, duelos, Archivo Vivo) para algo que no reparte nada. Si algún día hay clasificación de metros, se hará ahí.
- **Enseñarlas en la tarjeta del avatar:** ya está llena con nivel, vitrina y suscripción.

## Archivos

- `dist/stats.js` y `dist/stats.css`: cuentas, comparaciones y dibujo de la pestaña.
- `dist/progress.js`: guarda `state.plays`, pinta la pestaña y expone `Progress.tally`.
- `dist/ascension.js`, `dist/tendencias.js`, `dist/archivo-vivo.js` y `dist/duel.js`: avisan de lo jugado.
- `tests/estadisticas.test.mjs`.
