# 0047 — Probador del avatar y cartas de la tienda

- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Modifica:** la presentación del armario de la [decisión 0025](0025-avatar-3d.md)

## Contexto
En el móvil, el armario ponía el avatar arriba, con el nivel, la clasificatoria y la vitrina, y el catálogo debajo. Al bajar por las prendas, el avatar desaparecía y no se veía cómo quedaba lo que te probabas. Además, el catálogo (pastillas de texto, «Tienes 3 de 106» y piezas en círculo) no parecía la tienda de un juego profesional.

## Decisión
- **Probador en el móvil:** en la pestaña Armario, el avatar se queda fijo arriba (un tercio de la pantalla, como mucho 270 px) y el catálogo se desliza por debajo. Al probar una pieza, la barra con «Comprar» o «Quitar» aparece sobre el propio escenario y la figura se encoge un poco para no taparse. El nivel, la clasificatoria y la vitrina siguen en las demás pestañas.
- **Escritorio:** el avatar ya estaba fijo a la izquierda. Ahora también se quedan fijas las pestañas de las partes al bajar por el catálogo.
- **Catálogo:**
  - Cabecera con la colección total (barra de progreso) y el cambio de cuerpo.
  - Pestañas de partes con icono de línea y cuántas tienes de cada una, en una fila que se desliza.
  - Filtro «Todo / Tuyas / Por conseguir».
  - Cartas con el color de su rareza: común, especial (azul), rara (morado), épica (coral), legendaria (dorado, con brillo) y exclusiva (verde, las que se desbloquean por nivel, «Casi casi» o el Circuito). Llevan la etiqueta de rareza, una marca ✓ en la que llevas puesta, el precio en una pastilla oscura y un candado con lo que hace falta para las exclusivas.
- Todo vive en `dist/armario.css` (nuevo, después del resto de hojas de estilo) y en las funciones `tile()` y `wardrobe()` de `dist/progress.js`.

## Alternativas descartadas
- **Avatar al lado del catálogo también en el móvil:** en 375 px de ancho deja solo dos columnas estrechas de cartas. Arriba y fijo es lo que usan los editores de avatar de los juegos de móvil en vertical.
- **Ventana aparte para probar cada pieza:** obliga a abrir y cerrar por cada prenda.

## Consecuencias
- Las cartas de la tienda son más grandes que los círculos de antes, así que la vista previa en 3D de cada pieza se ve mejor, pero se dibuja en un lienzo mayor.
- Con `prefers-reduced-motion` se quita el brillo de las legendarias.
