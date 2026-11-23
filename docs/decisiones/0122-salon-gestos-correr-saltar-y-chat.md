# 0122. Salón: gestos, correr, saltar y chat entre amigos

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-23
- **Quién:** Luis, con Claude

## Contexto

En el Salón ([decisión 0116](0116-salon-casino-de-prueba.md)) el personaje solo andaba. Luis quiere que se parezca a los mundos sociales (Roblox, Habbo, WoW): poder hacer gestos, saltar, correr y hablar por un chat con bocadillos sobre la cabeza.

## Decisión

- **Correr:** con Mayúsculas, o llevando la palanca táctil hasta el borde. Va un 70 % más rápido que andando.
- **Saltar:** con Espacio o el botón «Saltar». Se puede saltar andando o corriendo; no sentado ni dentro de un juego.
- **Gestos:** doce, sacados de los que el avatar ya tenía (decisiones [0028](0028-avatar-de-mujer-y-animaciones.md) y [0053](0053-bailes-del-avatar.md)): saludar, «¡vamos!», giro, bailar, robot, disco, twist, dab, no, pensar, «ni idea» y suspiro. Se abren con el botón «Gestos» o la tecla G, y los diez primeros tienen tecla (del 1 al 0). Se hacen de pie y quieto; andar los corta.
- **Quieto, al personaje lo anima el propio avatar** (respira, parpadea, hace el gesto). Para eso `dist/avatar3d.js` exporta `Avatar3D.actor(modelo)`, que usa la misma animación que el resto del juego fuera de sus vistas. Andando, corriendo, saltando o sentado lo sigue moviendo `dist/casino.js`.
- **Chat:** una caja abajo a la izquierda (arriba en móvil) con el registro y, sobre la cabeza de quien habla, un bocadillo que dura unos segundos. Se escribe con Enter, T o la barra. Mensajes de hasta 140 caracteres.
- **Quién lee el chat: solo los amigos.** El Salón compartido ya era solo entre amigos (decisión 0116) y el chat sigue esa regla: un mensaje llega a quien lo escribe y a sus amigos presentes, a nadie más. Sin el Salón compartido abierto, el mensaje se ve solo en el propio navegador y se avisa de ello.
- **Los mensajes y los gestos viajan con la presencia**, sin tabla ni servicio nuevos:
  - Nueva acción `chat` en `POST /api/casino`. Los mensajes se guardan en `state.chat` de la fila de `casino_rooms` (los 40 últimos) y llegan con el latido de cada 1,2 segundos. Se envían los de los dos últimos minutos.
  - El texto pasa por la misma limpieza que el chat de los duelos (`chatText`, [decisión 0040](0040-chat-en-los-duelos.md)): fuera caracteres de control y de dirección del texto. El navegador lo pinta como texto, nunca como HTML.
  - Mismos límites que en los duelos: 6 mensajes cada 10 segundos y nunca dos en menos de 0,4 s.
  - El último gesto o salto va en el latido (`act: {name, n}`) y se guarda en la presencia. Solo valen los nombres de la lista (`SALON_ACTS` en `lib/casino.mjs`).
- **No hace falta migración.**

## Alternativas descartadas

- **Chat abierto a todo el que esté en la sala.** Es lo que hacen Roblox o Habbo, pero aquí no hay moderación ni filtro de palabras, y el Salón compartido ya estaba limitado a amigos por eso mismo.
- **Supabase Realtime o una conexión abierta** para que el chat y los gestos sean instantáneos. Los mismos motivos que en la [0023](0023-duelos-1vs1.md) y la 0040: clave en el navegador o servidor con conexiones abiertas. Con el latido, un mensaje o un gesto tarda en verse hasta algo más de un segundo.
- **Frases y reacciones predefinidas** como en los duelos. Entre amigos y con los gestos ya disponibles, añaden poco.
- **Animar el personaje del Salón con código propio** para cada gesto. Habría dos versiones de cada gesto que mantener.

## Consecuencias

- Los mensajes llegan a los amigos sin filtro de palabras y no se pueden denunciar, igual que en los duelos. La defensa es que solo los leen amigos. Queda apuntado en [mejoras](../mejoras/README.md).
- El chat no se ve dentro de un juego (ruleta, póker, crash, tragaperras): la mesa lo tapa. Para hablar en la mesa de póker hay que levantarse.
- Los saltos de los amigos se ven con el retraso del latido, así que no van acompasados con los propios.
- Cada mensaje y cada gesto es una escritura más en la fila del Salón, limitada por los límites del chat y por un gesto cada 0,3 s como mucho.
- `Avatar3D.actor` mueve el grupo del modelo, así que en el Salón cada personaje va dentro de un grupo propio que es el que se coloca en la sala.
