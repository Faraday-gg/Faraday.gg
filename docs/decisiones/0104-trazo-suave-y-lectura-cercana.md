# 0104. Trazo más estable y lectura junto al punto

- **Estado:** implementada.
- **Fecha:** 2026-11-19.
- **Quién:** Álvaro, con Codex.
- **Actualiza:** [0093](0093-guia-y-coordenadas-de-dibujo.md), en la lectura de coordenadas; conserva el aviso de inicio.

## Contexto

Álvaro detecta que la curva acusa demasiado los pequeños movimientos del ratón y que consultar los valores en los ejes obliga a apartar la mirada. Pide moderar la sensibilidad, conservar la precisión del dibujo y mostrar el periodo y el dato cerca del punto activo.

Se revisa la página pública de [Extraplot](https://guessdash.com/extraplot), su DOM y el comportamiento del borrador con puntero y teclado. Se observa la lectura flotante y la columna que señala el periodo activo; no se copia código ni se revela una respuesta de la referencia.

## Decisión

El trazo usa diez muestras por periodo en lugar de dieciséis. Una amortiguación corta, calculada en píxeles CSS con una distancia de tres píxeles, reduce el temblor fino antes de actualizar la curva y conserva los movimientos amplios. Aplica también al ajuste de una curva existente. Repetir la misma posición al soltar no hace avanzar el filtro; volver exactamente al origen recupera la posición inicial del ajuste. Se mantienen la interpolación, el editor numérico, los límites de escala y los valores por periodo que puntúa la API.

Una etiqueta flotante dentro de la gráfica muestra periodo completo, estimación y unidad junto al punto activo. El periodo aparece subrayado, y una banda tenue con subrayado inferior destaca su columna. Los ejes conservan sus rótulos estáticos; se retiran las dos etiquetas dinámicas que se apoyaban en ellos.

La tarjeta conserva tamaño de texto en pantalla, se desplaza al lado opuesto cerca de los bordes y se mantiene dentro de la gráfica. El dedo recibe un margen mayor. Cambiar el ancho recoloca la lectura; borrar la curva oculta lectura y banda y recupera el aviso de inicio. Al revelar se elimina el contenedor de dibujo para que la etiqueta no permanezca sobre las respuestas y la animación.

## Comprobaciones

Revisión local en escritorio y a 375 px: dibujo parcial, reanudación desde el extremo, ajuste, borrado, editor numérico, esquinas superior e inferior, etiqueta con unidad larga y revelación. El periodo y la lectura siguen al punto; no hay etiquetas dinámicas en los ejes, desbordamiento horizontal ni errores de consola. La respuesta y los trazos comunitarios conservan su revelación.

Una simulación puntual del filtro reduce una oscilación de ±0,5 px a menos de 0,08 px, conserva un desplazamiento deliberado de 30 px y comprueba que soltar no añade un salto. Se ejecutan las suites del repositorio. No cambia el banco, el servidor, la puntuación, los cupos ni el esquema de Supabase.
