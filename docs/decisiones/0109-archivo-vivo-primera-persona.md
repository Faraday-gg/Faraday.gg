# 0109. El avatar en primera persona en Archivo Vivo

- **Fecha** · 2026-11-21.
- **Estado** · Implementada. La [decisión 0111](0111-ampliacion-archivo-vivo.md) eleva ambos brazos.
- **Amplía** · [Archivo Vivo](0108-archivo-vivo.md) y reutiliza el modelo del [avatar 3D](0025-avatar-3d.md).

## Entrada y vuelta a la ronda

Toda la fotografía es un botón con la acción «Entrar en el año» y la indicación 360°. El primer clic o toque abre la escena casi a toda pantalla con el mismo diálogo de Archivo Vivo. La acción de volver está a la vista independientemente del giro y del zoom. Quien está jugando regresa a su respuesta y conserva lo que llevaba escrito. Quien ya contestó vuelve al resultado. Escape hace el mismo regreso en un paso. Se usan unidades de ventana dinámica para acomodar las barras de los navegadores móviles. [Patrón de diálogo del W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [Unidades de ventana del W3C](https://www.w3.org/TR/css-values-4/#viewport-variants)

## Proyección del avatar

- Una capa transparente compone el avatar encima del panorama. El brazo queda en el borde de la escena y se ve desde el inicio. Al bajar la mirada entran la ropa del torso, las piernas y las zapatillas. El visor puede bajar la mirada directamente a los pies y volver al encuadre inicial.
- El modelo parte del aspecto equipado que devuelve `Progress.look()` e incluye la geometría, la piel, las prendas y los acabados resueltos por el armario. Usa una cámara en primera persona con su propio campo de visión. El zoom del panorama permite examinar la fotografía sin ampliar las manos ni la ropa. [Renderizado en primera persona de Epic](https://dev.epicgames.com/documentation/en-us/unreal-engine/first-person-rendering) · [Cámara de perspectiva en Three.js](https://threejs.org/docs/pages/PerspectiveCamera.html)
- El montaje lunar conserva su ángulo vertical de archivo. El movimiento de cámara se proyecta en dos rangos: el fondo gira dentro de la franja registrada y el cuerpo completa la inclinación necesaria para mostrar los pies. Las reconstrucciones admiten la inclinación de cámara completa.
- La capa comparte el renderizador de los avatares del resto del juego y se copia a un lienzo transparente. Se vuelve a dibujar cuando cambian la inclinación o las dimensiones. La sesión libera la geometría, los materiales y el lienzo al salir. Si Three.js o el avatar fallan, la fotografía o el panorama siguen disponibles según el estado del visor. [Renderizado bajo demanda en Three.js](https://threejs.org/manual/pages/rendering-on-demand.html)

## Alternativas consideradas

- Dibujar brazos y zapatos como imágenes aparte habría exigido duplicar variantes y materiales de ambos cuerpos del armario.
- Renderizar panorama y avatar en una sola escena 3D habría ligado la lectura de las imágenes históricas al motor del avatar. La composición de dos capas permite mantener sus proyecciones y recuperación de errores independientes.
- Desplazar el cuerpo por el entorno habría requerido reconstruir la profundidad y preparar puntos de vista adicionales. El jugador explora y mira su cuerpo desde el punto de toma.
