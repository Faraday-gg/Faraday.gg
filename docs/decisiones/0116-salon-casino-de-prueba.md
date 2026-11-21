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
