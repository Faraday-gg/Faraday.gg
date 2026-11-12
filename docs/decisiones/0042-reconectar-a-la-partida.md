# 0042. Reconectar a la partida

- **Estado:** propuesta (código en la PR de `feat/reconectar-duelo`; no hay migración)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

## Contexto

En un duelo ([0023](0023-duelos-1vs1.md)) el servidor manda y el navegador solo pregunta el estado. Si un jugador cierra la pestaña, recarga, vuelve a la portada o pierde la conexión, el duelo sigue corriendo con el reloj (3 minutos por pregunta, 30 s si el rival ya respondió) y el rival lo espera. Hasta ahora el único rastro de «en qué duelo estoy» era `casi-casi:duelo:actual` en el navegador, y solo se miraba al pulsar «Duelo 1 vs 1». Además había un fallo: `open()` pintaba la sala y esta borraba esa clave antes de leerla, así que la vuelta automática nunca funcionaba. Sin cuentas ([0009](0009-jugador-sin-registro-con-cookie.md)), el jugador es su identificador anónimo (en `localStorage`, no en una cookie; su SHA-256 es lo que guarda el duelo).

## Decisión

- **El servidor responde «¿tengo un duelo en marcha?».** Acción nueva `activo` en `POST /api/duelo`, sin `id`: busca los duelos recientes del jugador (`duels.recent(hash)`), los pone al día con el reloj y devuelve un resumen (`id`, `status`, `phase`, ronda, vida de los dos, rival, código si espera) o `active: null`. No devuelve la cifra real ni ninguna respuesta.
- **Qué cuenta como «en marcha»:** un duelo `playing` (aunque el reloj siga corriendo sin ti); uno `waiting` si hubo señal en los últimos 5 minutos (`RULES.waitingMs`: cubre el reto por código; una partida rápida sin rival vuelve a ser visible en cuanto se reconecta); y, si no hay ninguno vivo, el último `finished` de los últimos 30 minutos (`RULES.resultMs`), para que quien estaba fuera pueda ver cómo acabó y que cuenten su XP y su racha.
- **Rendirse no es desconectarse.** «Salir» sigue siendo una rendición explícita (confirmación + acción `salir`): quien se rinde no ve «Reconectar», y el rival sí ve el resultado. Un duelo `cancelado` (nadie llegó) nunca se ofrece. Cerrar la pestaña o perder la red no es una acción: el duelo sigue y se puede volver a él.
- **Cliente.** `dist/reconectar.js` (+ `reconectar.css`) pregunta `activo` al cargar, al volver a la pestaña, al cerrar el duelo y cada 20 s, y enseña un aviso fijo «Reconectar a la partida» (ronda, vida y rival) y una entrada destacada al principio del menú. Desaparece cuando el duelo termina o caduca, y un duelo terminado ya contado en este navegador no se ofrece. Pulsarlo llama a `DueloReconectar.open(id)` (`duel.js`), que carga el estado actual (ronda, vida, reloj) y sigue como si no se hubiera ido. `duel.js` también arregla la lectura de `actual` y, si el navegador no recuerda el duelo, se lo pregunta al servidor.
- **Dos pestañas.** Las dos ven el aviso y pueden entrar: las respuestas son idempotentes (la primera es la que vale), así que no se rompe nada. Con el duelo abierto en una pestaña, la otra solo enseña el aviso.

## Alternativas descartadas

- **Solo `localStorage`.** Es lo que había: no sabe nada del servidor (duelo ya terminado, caducado) y se pierde si cambia la clave.
- **Reconectar automáticamente al cargar la web.** Metería al jugador en un duelo sin que lo pida, quizá con el reloj casi agotado. Se prefiere un aviso explícito.
- **Terminar el duelo cuando alguien se desconecta.** Penalizaría fallos de red y no hay forma fiable de detectar una desconexión sin conexiones abiertas ([0023](0023-duelos-1vs1.md)).

## Consecuencias

- Cada navegador con la web abierta hace una petición `activo` al cargar y cada 20 s mientras mira la portada (no durante un duelo). Con Supabase es una consulta por contención en `jsonb` (`state @> {"players":[{"hash":…}]}`) acotada por `updated_at`; sin índice sobre `state` es un recorrido de tabla. Con pocos duelos no importa; está anotado en [mejoras](../mejoras/README.md). No hay migración.
- Si un jugador se va y no vuelve, el duelo se juega solo con el reloj hasta acabar (sin respuestas, el rival gana puntos y vida). Es el comportamiento de antes.
