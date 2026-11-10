# 0015 — Portada sencilla: el reto de hoy y los tres pasos

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
La portada tenía demasiado ruido: un hero partido con dibujo de interrogaciones y órbitas, una cinta («PIENSA · CALCULA…»), tres tarjetas de reglas, un archivo con pegatina y un cierre en coral con otro botón de jugar. Luis pidió una portada sencilla que enseñe los pasos del juego, inspirada en la de Fermi.gg, con nuestra paleta.

## Decisión
- **Arriba, una sola tarjeta coral centrada,** con la misma forma que la tarjeta del juego ([0011](0011-juego-en-tarjeta.md)): marca y número de reto, el titular «La respuesta está *por ahí.*», la fecha, los iconos de las tres preguntas y un único botón «Jugar el reto de hoy».
- **«Cómo se juega» en tres pasos alternos,** cada uno con su texto y una tarjeta de ejemplo en el color de esa pantalla del juego ([0010](0010-juego-a-pantalla-completa.md)): coral para la estimación, azul noche para la respuesta y amarillo para el resumen del día. Los ejemplos usan las preguntas reales del lunes 9 de noviembre (toallas en la Plaza de España, jamones y la EEI, pósits en La Última Cena); la cifra real es la de la pregunta y las estimaciones son inventadas.
- **El archivo se queda** como una lista limpia («El archivo») debajo de los pasos, porque es la única forma de jugar días anteriores.
- **Se quitan:** la cabecera con menú, la cinta, el dibujo del hero, la pegatina del archivo y el bloque de cierre. Los botones de jugar se marcan con `data-play` en vez de con identificadores fijos.

## Alternativas descartadas
- **Copiar la portada de Fermi.gg con sus textos y elementos:** se toma la estructura (tarjeta del reto + pasos con ejemplo), pero con nuestra marca, nuestra tipografía, nuestra paleta encadenada y nuestras preguntas. No se copian su ilustración, su sección «Sobre Fermi», el envío de preguntas ni las preguntas frecuentes.
- **Esconder el archivo detrás de un menú:** habría dejado la portada aún más limpia, pero sin otra forma visible de llegar a los días anteriores.

## Consecuencias
- La portada pasa de seis bloques a tres y tiene un único botón para jugar.
- Las tarjetas de ejemplo son HTML estático: si cambia el diseño del juego, hay que actualizarlas a mano.
