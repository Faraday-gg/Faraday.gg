# 0039. Chat en los duelos: reacciones, frases rápidas y mensajes escritos

- **Estado:** propuesta (código en la PR de `feat/chat-duelos`; no necesita migración)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Amplía:** la [0023](0023-duelos-1vs1.md), que dejaba fuera «emoticonos durante la partida».

## Contexto

Luis quiere que los dos jugadores de un duelo puedan hablar durante la partida: reacciones predeterminadas, frases que se envían con un toque y chat escrito.

Limitaciones de siempre: Supabase solo desde el servidor ([0002](0002-acceso-a-supabase-solo-desde-el-servidor.md)), función de Vercel sin conexiones abiertas ([0003](0003-despliegue-en-vercel.md)), jugadores sin cuenta ([0009](0009-jugador-sin-registro-con-cookie.md)) y el apodo, que ya lo escribe el jugador, sin filtro de palabras.

## Decisión

- **Los mensajes viven dentro del duelo.** Se guardan en `state.chat` de la fila de `duels` (el mismo `jsonb`, con su control de versión) y llegan con la consulta de cada segundo (`estado`). No hace falta migración ni ningún servicio nuevo. Nueva acción `chat` en `POST /api/duelo`, con `kind` (`reaction`, `phrase` o `text`) y `value`.
- **Tres tipos de mensaje** (`CHAT` en `lib/duelos.mjs`, y sus emojis y textos en `dist/duel-chat.js` con las mismas claves):
  - **10 reacciones:** 👍 😂 😮 😅 🔥 😱 🤯 👏 🤔 😭.
  - **12 frases:** ¡Suerte!, ¡Igualmente!, ¡Bien jugado!, ¡Casi casi!, Uff, por los pelos, Ni idea de esta, Esta era fácil, Aún puedo remontar, GG, ¿La revancha?, ¡Gracias!, ¡Vamos! Las que encajan con el momento salen primero (por ejemplo, «¡Suerte!» en la presentación y «GG» al terminar).
  - **Texto libre** de hasta 140 caracteres. El servidor quita caracteres de control y de dirección del texto (para que nadie dé la vuelta a lo que se ve) y el navegador lo escapa al pintarlo.
  - Reacciones y frases se guardan por su clave: el servidor rechaza cualquier otra.
- **Cuándo:** desde que hay rival (pantalla «VS») hasta después de terminar, para poder decir «GG». En la sala de espera no hay chat.
- **Límites:** como mucho 6 mensajes por jugador cada 10 segundos y nunca dos en menos de 0,4 s (si no, 429 «Vas muy rápido»). Se guardan los 40 últimos mensajes del duelo.
- **En pantalla:** un botón de chat abajo a la derecha con el número de mensajes sin leer; al abrirlo, el historial, las reacciones, las frases y la caja para escribir (en móvil, una hoja que sube desde abajo y no abre el teclado sola). Lo que se envía y lo que llega aparece además como bocadillo junto al jugador en el marcador, y lo del rival suena con un aviso corto (respeta el botón de silencio).
- **Protección:** casilla «Ver los mensajes escritos del rival», que se recuerda en el navegador. Si se quita, sus mensajes escritos salen como «Mensaje escrito oculto»; reacciones y frases se siguen viendo porque son de la lista cerrada.
- **Faraday-bot** no lee: a algunas frases contesta con su frase («¡Suerte!» → «¡Igualmente!») y al resto, a veces, con una reacción. Lo hace uno o dos segundos después (el mensaje se guarda con hora futura y no se ve hasta entonces) y nunca dos veces en menos de 4 segundos.

## Alternativas descartadas

- **Solo reacciones y frases**, sin texto libre. Más seguro, pero Luis pidió chat literal. Se deja la casilla para ocultarlo.
- **Tabla aparte de mensajes.** Permitiría un historial largo y moderación, pero obliga a una migración y a una segunda consulta por segundo. Para una conversación de una partida basta con el estado del duelo.
- **Supabase Realtime.** Los mismos motivos que en la 0023: clave en el navegador o servidor con conexiones abiertas. El retraso de un segundo de la consulta es suficiente.
- **Bloquear el chat mientras se responde** para evitar pistas. Los dos son rivales y nadie gana dando pistas al otro.

## Consecuencias

- Los mensajes escritos los ve el rival sin filtro de palabras, igual que el apodo. Queda anotado en [mejoras](../mejoras/README.md) junto al filtro de apodos; hoy la defensa es la casilla para ocultarlos y que el duelo dura minutos.
- No hay forma de denunciar un mensaje. Si hiciera falta, los 40 últimos mensajes de cada duelo están en `duels.state.chat`.
- Cada mensaje es una escritura más en la fila del duelo. Con los límites, como mucho 36 escrituras por minuto y jugador, poco frente a las consultas de cada segundo.
- El estado de cada consulta pesa un poco más (hasta 40 mensajes cortos).
- Con las Preview de Vercel compartiendo la tabla con producción ([0001](0001-supabase-un-solo-entorno.md)), alguien en la Preview puede chatear con alguien de producción, como ya pasaba con los duelos.
