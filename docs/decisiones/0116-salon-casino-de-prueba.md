# 0116. Salón de juegos con faradios de prueba

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-21
- **Quién:** Luis, con Codex

## Contexto

Luis quiere probar un salón que se recorra en tercera persona con el avatar del armario y permita jugar desde las mesas.

## Decisión

- El Salón abre desde el vestíbulo de Faraday.gg. El avatar se mueve con teclado o joystick táctil y la cámara gira al arrastrar. El jugador puede acercarse a una mesa o abrirla desde la barra inferior, que también funciona sin 3D.
- El prototipo incluye ruleta europea, tragaperras de tres rodillos y vídeo póker individual «jotas o mejor». Cada mesa explica sus combinaciones o pagos.
- Cada navegador empieza con 1.000 faradios de prueba. Se juega con fichas de 5 a 100, hasta un máximo de 500 de pérdida neta por día de Madrid. Hay un mínimo de 100 al empezar un día nuevo.
- Los faradios de prueba se guardan en el navegador. No se compran, canjean, transfieren ni se mezclan con el saldo de la cuenta. Plus no cambia las apuestas, el límite ni los premios.

## Consecuencias

La prueba es individual. El navegador lleva la partida y el saldo, por lo que no sirve para premios compartidos ni para operar con el saldo de las cuentas. Salir de la mesa cobra la mano de póker con las cartas que ya están repartidas. Recargar durante una mano abandona la apuesta.

## Segunda prueba: Salón compartido

Al elegir «Entrar con amigos», se comparte el avatar y la posición con las amistades aceptadas que también entraron. La presencia caduca si el navegador deja de enviar señales. Las amistades bloqueadas quedan excluidas. Se muestra el puesto ocupado alrededor de la mesa de póker, y se puede volver a ella desde el mundo.

Las mesas tienen dos a cuatro personas. Cada jugador confirma 25 faradios ficticios antes de cada mano. El anfitrión reparte cuando todos están listos. Cada persona recibe cinco cartas privadas y puede cambiarlas una vez. Con 45 segundos agotados o al levantarse, el servidor conserva sus cartas actuales. La mejor mano cobra el bote. En caso de empate, se reparte entre las manos empatadas. El reparto, las cartas y la liquidación se validan en el servidor.

El póker compartido empieza con 1.000 faradios ficticios por cuenta y ámbito. Conserva su saldo propio en el servidor y tiene un suelo diario de 100. Los modos individuales siguen usando el monedero local del navegador. La migración crea un estado versionado por ámbito para la prueba con grupos pequeños.
