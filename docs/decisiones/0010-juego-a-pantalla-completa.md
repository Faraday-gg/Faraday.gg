# 0010 — Juego a pantalla completa, centrado en la pregunta

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
El juego se abría en una ventana modal sobre la portada, con mucho texto, etiquetas de color, sombras y la foto dentro de un marco azul. Luis pidió una experiencia más limpia y profesional, en la que lo importante sea la pregunta y jugar, y fácil de recorrer entre preguntas.

## Decisión
- Al jugar, el juego ocupa toda la pantalla, con el fondo de la web y sin ventana. La barra superior solo lleva: volver (←), los pasos 1, 2, 3 y Total, y el número del reto.
- **Pantalla de pregunta:** solo la pregunta, el campo de la cifra con su unidad, el botón del bloc y «Confirmar». Sin etiqueta de tema, sin foto y sin textos de ayuda.
- **Pantalla de resultado:** la distancia en grande, las dos cifras y «Siguiente pregunta» arriba. Debajo, separados por líneas finas, la distribución, «Cómo se calcula», la foto y «Fuentes y supuestos».
- **La foto** se ve sin marco ni fondo: tamaño natural, esquinas redondeadas y con su crédito y licencia. Sigue sin recortarse.
- **Navegación:** los pasos de la barra permiten volver a cualquier pregunta ya respondida o al total. El botón «atrás» del navegador o del móvil vuelve a la portada, porque abrir el juego añade una entrada al historial.
- El bloc (calculadora y notas) es un panel lateral sobrio; en el móvil ocupa toda la pantalla.

## Alternativas descartadas
- Mantener el modal con menos adornos: seguía mostrando la portada detrás y el tamaño se veía raro.
- Mostrar la foto en la pregunta sin marco: distrae de la pregunta. Se ve al ver el resultado.
- Recortar las fotos para llenar un hueco fijo: alteraría la obra. Ahora se muestran enteras y sin modificar.

## Consecuencias
- La portada no cambia en esta decisión.
- Se pierde el texto «Tu cifra se comparte de forma anónima…» de la pantalla de pregunta. El anonimato se explica en la documentación y, cuando se fusione, en las preguntas frecuentes de la portada.
