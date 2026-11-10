# 0010 — Juego a pantalla completa, centrado en la pregunta

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
El juego se abría en una ventana modal sobre la portada, con mucho texto, etiquetas de color, sombras y la foto dentro de un marco azul. Luis pidió una experiencia más limpia y profesional, en la que lo importante sea la pregunta y jugar, y fácil de recorrer entre preguntas.

## Decisión
- Al jugar, el juego ocupa toda la pantalla, sin ventana, con el color de cada paso (ver la paleta abajo). La barra superior solo lleva: volver (←), los pasos 1, 2, 3 y Total, y el número del reto.
- **Pantalla de pregunta:** solo la pregunta, el campo de la cifra con su unidad, el botón del bloc y «Confirmar». Sin etiqueta de tema, sin foto y sin textos de ayuda.
- **Pantalla de resultado:** la distancia en grande, las dos cifras y «Siguiente pregunta» arriba. Debajo, separados por líneas finas, la distribución, «Cómo se calcula», la foto y «Fuentes y supuestos».
- **La foto** se ve sin marco ni fondo: tamaño natural, esquinas redondeadas y con su crédito y licencia. Sigue sin recortarse.
- **Navegación:** los pasos de la barra permiten volver a cualquier pregunta ya respondida o al total. El botón «atrás» del navegador o del móvil vuelve a la portada, porque abrir el juego añade una entrada al historial.
- El bloc (calculadora y notas) es un panel lateral sobrio; en el móvil ocupa toda la pantalla.
- **Una paleta de tres colores por pantalla**, encadenadas: el acento de una pantalla es el fondo de la siguiente, para que el paso de una a otra se note a simple vista.

  | Pantalla | Fondo | Texto | Acento |
  | --- | --- | --- | --- |
  | Pregunta (piensa) | coral `#ff6548` | tinta `#202630` | azul noche `#23395b` (botón «Confirmar», línea de la cifra al escribir) |
  | Respuesta (compara) | azul noche `#23395b` | crema `#fff8ec` | amarillo `#ffdb70` (distancia, «Siguiente pregunta», tu marca en el gráfico) |
  | Resultado final (celebra) | amarillo `#ffdb70` | tinta `#202630` | coral `#ff6548` (botón «Compartir»), que enlaza con la pregunta de mañana |

  Contraste del texto: 5,2:1 en la pregunta y más de 11:1 en las otras dos. El coral sobre amarillo tiene poco contraste (2,2:1), así que en el resultado final solo se usa como fondo de botón, con texto tinta (5,2:1). Los grises y las líneas salen del color del texto con transparencia. El bloc sigue en papel neutro.

## Alternativas descartadas
- Mantener el modal con menos adornos: seguía mostrando la portada detrás y el tamaño se veía raro.
- Mostrar la foto en la pregunta sin marco: distrae de la pregunta. Se ve al ver el resultado.
- Recortar las fotos para llenar un hueco fijo: alteraría la obra. Ahora se muestran enteras y sin modificar.
- Un único color de fondo para todo el juego: más sobrio, pero no se distinguía de un vistazo en qué paso estás.
- Transición animada entre colores: durante el cambio, el contorno de la puntuación final se veía con el color equivocado.

## Consecuencias
- La portada no cambia en esta decisión.
- Se pierde el texto «Tu cifra se comparte de forma anónima…» de la pantalla de pregunta. El anonimato se explica en la documentación y, cuando se fusione, en las preguntas frecuentes de la portada.
