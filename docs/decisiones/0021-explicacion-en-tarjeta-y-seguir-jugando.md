# 0021 — «Cómo se calcula» dentro de la tarjeta, foto ampliable y «Seguir jugando»

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code
- **Sustituye en parte a:** [0012](0012-tarjeta-de-respuesta-clara.md) (la fila de acciones y el panel de «Cómo se calcula»)

## Contexto
Luis vio tres problemas en la tarjeta del juego:
1. El panel «Cómo se calcula» se abría encima de la tarjeta (en el móvil, como una hoja desde abajo) y tapaba el multiplicador, las cifras y el gráfico. Pidió fijarse en Fermi.gg, que muestra su «Napkin math» como un desplegable dentro del flujo, bajo el gráfico, y deja el resultado a la vista.
2. La foto se abría a pantalla completa en otra pestaña.
3. Al terminar un día no había una forma clara de seguir jugando otro.

## Decisión
- **Desplegable en el flujo:** «Cómo se calcula ▾» es una fila a todo el ancho bajo el gráfico. Al abrirse, el contenido se despliega con suavidad debajo, empuja los botones hacia abajo y la vista baja hasta el título. El resultado sigue arriba, a un desplazamiento. Ya no hay botón de cerrar: se pliega con la misma fila (o con Esc).
- **Compacto:** no repite la pregunta, pasos a 14 px, cuenta y supuestos en gris pequeño y fuentes en una sola línea («Fuentes: … · …»).
- **Botonera:** queda el bloc a la izquierda y «Siguiente →» (o «Ver total →») a la derecha.
- **Foto:** se muestra recortada (110 px de alto) y al pulsarla crece en su sitio hasta unos 380 px. Se vuelve a pulsar para reducirla. Ya no abre una pestaña nueva. Los créditos y la licencia siguen debajo.
- **«Seguir jugando»** en el resumen del día, bajo «Compartir» y «Volver al inicio»:
  - «Jugar el reto de hoy», si el día terminado no es el de hoy y el de hoy no está completo.
  - El día anterior y el siguiente del archivo, con su número, su fecha y su estado («Sin jugar», «A medias» o la puntuación).
  - «Elegir día» en el centro, que abre el menú con el calendario.
  - Si no hay día anterior o siguiente, su hueco queda punteado y vacío para que la fila no se descoloque.

## Alternativas descartadas
- **Panel lateral o modal más pequeño:** sigue tapando parte del resultado y en el móvil no cabe al lado.
- **Ampliar la foto en una capa a pantalla completa (lightbox):** es justo lo que Luis no quería.
- **Solo un botón «Otro día» que abra el calendario:** obliga a un paso más para lo habitual, que es ir al día de al lado.
