# 0016 — Menú hamburguesa en el juego y archivo en calendario

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
Dentro del juego solo había una flecha para volver a la portada: para jugar otro día había que salir, bajar hasta el archivo y elegirlo. Y el archivo de la portada ([0015](0015-portada-sencilla.md)) era una lista de texto que a Luis no le gustaba. El de Fermi.gg (una cuadrícula de casillas coloreadas según si se jugó) estaba mejor planteado, pero tampoco le convencía. Pidió un archivo nuevo, divertido, coherente con la web, que invite a hacer clic y con alguna animación suave, en la portada y accesible desde el juego.

## Decisión
- **Menú hamburguesa en lugar de la flecha.** En la barra del juego, el botón de tres rayas abre un cajón lateral con «Reto de hoy», «Volver al inicio» y el archivo. Elegir un día del cajón lo abre sin pasar por la portada. Escape cierra primero el menú.
- **El archivo es un calendario por meses** (`dist/archive.js`), el mismo componente en la portada y en el menú:
  - Arriba, cuántos retos has jugado de los disponibles con una barra de progreso, y un botón **«Reto sorpresa»** con un dado: hace una ruleta por los días pendientes de ese mes y abre el elegido.
  - Cada casilla es un día. Amarilla con tu puntuación media si lo has jugado, crema con tres puntos del color de sus categorías si no, coral con «Hoy» y un pulso suave si es el de hoy, y con borde discontinuo los días sin reto (antes del Nº 1 o futuros).
  - Debajo, una ficha azul noche con el día que señalas (o, si no señalas ninguno, el último que te falta: «Te espera») y su botón de jugar.
  - Animaciones: las casillas saltan en cascada al aparecer, se deslizan al cambiar de mes, se inclinan al pasar por encima y la barra de progreso se llena. Con «reducir movimiento» no se anima nada.
- La puntuación media de cada día jugado se guarda en el navegador (`casi-casi:score:<fecha>`), porque las jornadas de más de 30 días llegan sin respuestas y no se podría recalcular.

## Alternativas descartadas
- **Copiar la cuadrícula de Fermi.gg:** no dice qué día es cada casilla ni cuánto sacaste; el calendario sí, y usa nuestros colores de pantalla (coral, amarillo, azul noche).
- **Mantener la lista con «Ver todo el archivo»:** 94 filas de texto no invitan a jugar.
- **Una página aparte para el archivo:** la web es de una sola página y el cajón permite saltar de día sin salir del juego.

## Consecuencias
- Sustituye la lista del archivo de la decisión 0015 y la flecha de volver del juego.
- Las puntuaciones de días antiguos jugados antes de este cambio, si ya no están en la ventana de 30 días, se ven como «✓» hasta que se vuelve a abrir ese día.

## Actualización (2026-11-10): la hamburguesa también en la portada
Luis pidió poder llegar al archivo más fácil desde la portada. Ahora hay un botón de tres rayas fijo arriba a la izquierda (círculo papel con sombra), que abre el mismo cajón: «Reto de hoy» y el archivo. En la portada no aparece «Volver al inicio», porque ya estás en él, y el archivo abre el mes actual. Escape cierra el cajón también desde la portada. En el móvil la portada baja 70 px para que el botón no tape el logo de la tarjeta.
