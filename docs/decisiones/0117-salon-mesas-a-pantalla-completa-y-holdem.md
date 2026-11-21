# 0117. Mesas del Salón a pantalla completa, tapete de ruleta y Texas Hold'em

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-21
- **Quién:** Luis, con Claude

## Contexto

En el Salón de la [decisión 0116](0116-salon-casino-de-prueba.md) cada juego se abría en un cuadro encima del mundo 3D. La ruleta era una lista de botones con una sola apuesta por giro y el póker era de descarte con cinco cartas. Luis quiere que jugar se parezca a sentarse en una mesa de casino: ver la rueda girar, dejar fichas por el tapete, sentarse a una mesa de póker con los demás alrededor y tener una crupier delante.

## Decisión

- **Sin cuadros.** Al acercarse a un juego y entrar, la mesa ocupa toda la pantalla (`#casino-stage`). El mundo 3D deja de pintarse mientras tanto y se vuelve a él con «← Salón». El monedero sigue visible arriba.
- **Ruleta.** La rueda gira siempre y, al lanzar, la bola corre en sentido contrario, cae y se queda en el número que ha salido. Al lado está el tapete europeo completo: plenos, caballos, transversales, cuadros, seisenas, columnas, docenas y suertes sencillas, más las apuestas anunciadas (zona cero, vecinos del cero, tercio y huérfanos). Se elige ficha (1, 5, 10, 25 o 50) y se dejan tantas como se quiera. En pantallas estrechas el tapete se pone en vertical.
- **Todas las apuestas de la ruleta pagan 36 entre los números que cubren**, así que la ventaja de la casa sigue siendo 1/37. Los límites de la 0116 no cambian, pero ahora se aplican al total del giro: de 5 a 100 faradios de prueba y 500 de pérdida diaria.
- **El póker es Texas Hold'em sin límite**: dos cartas por jugador y cinco comunes, con ciegas, subidas, «all-in» y botes laterales. Desaparecen el vídeo póker «jotas o mejor» y el póker de descarte entre amigos.
  - **Contra la casa:** te sientas con 100 faradios de prueba (la apuesta máxima de la 0116) frente a cuatro jugadores automáticos, con ciegas 1 y 2. Al levantarte vuelven al monedero las fichas que te queden. Las fichas de la mesa se apuntan en el navegador para recuperarlas si se cierra la pestaña; lo que ya esté en el bote se pierde, como al retirarse.
  - **Entre amigos:** misma mesa y mismas reglas, llevadas por el servidor. Ciegas 5 y 10; cada uno juega la mano con lo que tenga en el monedero compartido, hasta 200. Hay 30 segundos por jugada: quien no responde o se desconecta pasa si puede y, si no, se retira. Se mantiene que todos se declaren listos y que reparta quien abrió la mesa. El servidor solo envía a cada jugador sus cartas y, al enseñar, las de quien llega al final.
- **Las reglas del Hold'em son un único módulo** (`HOLDEM` en `dist/casino-rules.js`) que usan el navegador y el servidor. El estado de la mano es un objeto plano que el servidor guarda tal cual en `casino_rooms`.
- **Crupier.** Una crupier ilustrada preside la ruleta y el póker y canta el juego («Hagan juego», «No va más», el número, a quién le toca). Es un dibujo vectorial dentro de `dist/casino-tables.js`, sin imágenes externas.

## Alternativas descartadas

- **Hacer las mesas dentro del mundo 3D.** Acercar la cámara a la mesa es vistoso, pero los caballos y cuadros necesitan zonas pequeñas y precisas que en perspectiva y en móvil no se pueden tocar bien.
- **Dejar el póker entre amigos como estaba.** Habría dos pókers distintos en la misma sala.
- **Subir el máximo de la ruleta para que quepan más fichas.** Cambia la economía de la prueba; en su lugar hay ficha de 1.

## Consecuencias

- La tabla `casino_rooms` no cambia, pero sí lo que guarda cada mesa: una mesa guardada con el póker anterior se queda sin mano la próxima vez que se lea. No hace falta migración.
- Los jugadores automáticos del póker contra la casa deciden en el navegador y la baraja también está allí, igual que el resto de juegos individuales de la prueba: no sirve para nada que tenga valor.
- La invitación a Plus (`plus-offers.js`) se muestra bajo la mesa al acabar un giro, una tirada o una mano, nunca durante la jugada.
