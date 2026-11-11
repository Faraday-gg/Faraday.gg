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
- **Hoja translúcida dentro de la tarjeta, sin desplazarse:** al pulsar «Cómo se calcula ▴» sube desde los botones una hoja medio transparente (fondo de la tarjeta al 78 % con desenfoque). Se ajusta a su texto y como mucho llega hasta debajo del multiplicador. Detrás, «Tú / Real» y el gráfico se atenúan y suben un poco. El multiplicador y «Siguiente» siguen siempre a la vista; si el texto no cabe, solo se desplaza la hoja, con un degradado abajo que avisa de que hay más. Se cierra con el mismo botón, tocando el resultado atenuado o con Esc. *(Primero se probó un desplegable en el flujo, como la «Napkin math» de Fermi.gg, pero obligaba a desplazarse para leer y para llegar a «Siguiente».)*
- **Compacto:** no repite la pregunta, pasos a 14 px, cuenta y supuestos en gris pequeño y fuentes en una sola línea («Fuentes: … · …»).
- **Botonera:** bloc, «Cómo se calcula» y «Siguiente →» (o «Ver total →»); en el móvil, «Siguiente» ocupa una segunda fila. Va pegada abajo (sticky): en pantallas bajas sigue visible y, al abrir la hoja, la tarjeta se recoloca con el multiplicador arriba.
- **Cifras largas:** a partir de 8 caracteres el multiplicador ocupa su propia línea y baja de tamaño (antes «14.600.000×» se salía de la tarjeta en el móvil), y «Tú / Real» encoge sus cifras en vez de partirlas («7.300.000.00 / 0»).
- **Foto:** se muestra recortada (110 px de alto) y al pulsarla crece en su sitio hasta unos 380 px. Se vuelve a pulsar para reducirla. Ya no abre una pestaña nueva. Los créditos y la licencia siguen debajo.
- **«Seguir jugando»** en el resumen del día, bajo «Compartir» y «Volver al inicio»:
  - «Jugar el reto de hoy», si el día terminado no es el de hoy y el de hoy no está completo.
  - El día anterior y el siguiente del archivo, con su número, su fecha y su estado («Sin jugar», «A medias» o la puntuación).
  - «Elegir día» en el centro, que abre el menú con el calendario.
  - Si no hay día anterior o siguiente, su hueco queda punteado y vacío para que la fila no se descoloque.

## Alternativas descartadas
- **Panel opaco que tapa toda la tarjeta** (la versión anterior): ocultaba el multiplicador y las cifras.
- **Desplegable en el flujo de la página:** obligaba a desplazarse.
- **Panel lateral:** en el móvil no cabe al lado.
- **Ampliar la foto en una capa a pantalla completa (lightbox):** es justo lo que Luis no quería.
- **Solo un botón «Otro día» que abra el calendario:** obliga a un paso más para lo habitual, que es ir al día de al lado.
