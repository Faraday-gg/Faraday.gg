# 0105. Escalada con agarres en Ascensión

- **Estado:** implementada.
- **Fecha:** 2026-11-20.
- **Quién:** Álvaro, con Codex.

## Contexto

Ascensión representaba la altura con el paisaje en movimiento y un gesto de escalada. El jugador veía el avance aunque la mano y el pie quedaran separados de la roca. La [investigación comparada](../../research/ascension-escalada.md) recoge cómo distintos juegos hacen legible el contacto y la transferencia de peso.

## Decisión

La escalada de pared convierte el resultado en una acción del avatar. La presa se ilumina al alcance de la mano. El brazo se fija, cambia de apoyo el pie opuesto y el cuerpo gana altura. Dos vías ofrecen una elección visual. Directa mantiene el eje de la cuerda y Travesía cruza la pared antes de volver a la repisa. La rareza determina entre dos y seis transferencias y ambas vías suman los mismos metros.

La trayectoria calcula los apoyos en las mismas coordenadas que se usan para dibujar la roca. El avatar viste sus piezas y recupera su celebración del armario al llegar. La altura y el hito permanecen disponibles al saltar el tramo o con movimiento reducido. Repetir una subida usa los datos locales del resultado.

## Alternativas consideradas

Un gesto común sobre una pared desplazada necesita pocos recursos, pero el punto de contacto variaría con la escala de pantalla. Un control manual de equilibrio añadiría una segunda habilidad a la competición por rareza. La elección de vía da control sobre el recorrido y deja los metros determinados por la respuesta.

## Consecuencias

La escena resuelve cada pose en el navegador y reutiliza el modelo 3D. Si ese renderizado no está disponible, presenta el avatar y la repisa final sin interpolación. El reloj, la clasificación y la persistencia siguen a cargo de la API de Ascensión.
