# 0120. Mesas del Salón dentro de la sala, sala de casino y crash

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-23
- **Quién:** Luis, con Claude

## Contexto

Con la [decisión 0117](0117-salon-mesas-a-pantalla-completa-y-holdem.md) la mesa ocupaba toda la pantalla al entrar en un juego y el mundo 3D dejaba de pintarse. Paseando por el Salón no se veía ni a la crupier ni el tapete con los números: solo aparecían al entrar. Luis lo considera mal planteado: en un casino la mesa, el tapete y quien lanza la bola se ven desde fuera, y al acercarse uno se arrima a la mesa. Además la sala se veía pobre y pide pantallas con el juego de crash.

## Decisión

- **La mesa y su crupier están en la sala.** La ruleta es una mesa larga con la rueda a un lado, el tapete con todos los números al otro y la crupier detrás. La mesa de póker tiene su crupier al fondo y a los cuatro jugadores de la casa sentados. Las crupieres son personajes 3D (`Avatar3D.build`), no un dibujo aparte.
- **Con la E la cámara se acerca a la mesa** en vez de cambiar de pantalla. La sala se sigue pintando y encima van el tapete donde se dejan las fichas y los botones. Esto cambia la alternativa descartada en la 0117: el tapete táctil se mantiene en HTML, que es lo que necesitaba precisión, pero ya no tapa la sala.
  - La bola corre por la rueda de la mesa y las fichas apostadas se ven también sobre el tapete de la sala.
  - En el póker, las cartas comunes, las cartas de cada jugador y el bote se ven sobre la mesa. El jugador se sienta en su silla.
  - El bocadillo de la crupier se coloca sobre su cabeza.
  - Las tragaperras siguen a pantalla completa.
- **Sin 3D todo sigue como en la 0117**: si el mundo no carga, la mesa ocupa la pantalla con la rueda y la crupier dibujadas.
- **Sala de casino.** Moqueta granate con rombos dorados, paredes con zócalo de madera, pilastras y apliques, techo artesonado, lámparas de araña, puerta con pasarela y cordones, bar, plantas y cinco tragaperras. La mesa de póker es más grande para que quepan los jugadores.
- **Crash.** Tres pantallas en la pared derecha enseñan rondas que corren solas, se juegue o no. Cada ronda: 7 segundos para apostar, el multiplicador sube desde 1,00× y revienta en un punto al azar. Quien se retira antes cobra su apuesta por el multiplicador de ese momento; quien no, la pierde.
  - La probabilidad de llegar a un multiplicador `m` es `0,97 / m`, así que retirarse en cualquier punto devuelve de media el 97 % (ventaja de la casa del 3 %, parecida al 2,7 % de la ruleta). El máximo es 500×.
  - Usa las fichas y los límites de la [decisión 0116](0116-salon-casino-de-prueba.md): de 5 a 100 faradios de prueba por ronda y 500 de pérdida diaria. La apuesta se cobra al despegar.
  - Alejarse de las pantallas con la ronda en vuelo es retirarse en ese momento. Una apuesta puesta para la ronda siguiente se quita al irse.
  - Las reglas están en `CRASH`, dentro de `dist/casino-rules.js`, con sus pruebas.
- **La sala es un módulo aparte**, `dist/casino-world.js`. `dist/casino.js` se queda con el personaje, la cámara, las apuestas y el monedero.

## Alternativas descartadas

- **Apostar tocando el tapete 3D.** Los caballos y cuadros son zonas pequeñas que en perspectiva y en móvil no se tocan bien (el motivo de la 0117 sigue valiendo).
- **Crash con rondas que empiezan cuando el jugador pulsa.** Las pantallas tienen que verse vivas al pasear, así que la ronda es de la sala y el jugador se sube a la siguiente.
- **Retirada automática a un multiplicador elegido.** Útil, pero es otra pieza de interfaz; queda para cuando se decida si crash se queda.

## Consecuencias

- El crash decide en el navegador, como el resto de juegos individuales de la prueba: no sirve para nada que tenga valor. Si algún día se juega con saldo real o entre varios, el punto de corte tiene que salir del servidor.
- En la sala hay seis personajes más (dos crupieres y cuatro jugadores). Cuando se sientan amigos a la mesa compartida, los jugadores de la casa desaparecen para dejarles los sitios.
- La invitación a Plus se muestra bajo el juego al acabar una ronda de crash, nunca durante el vuelo.
