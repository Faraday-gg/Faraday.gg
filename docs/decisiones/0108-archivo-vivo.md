# 0108. Archivo Vivo, adivinar el año desde una foto histórica

- **Fecha:** 2026-11-20.
- **Estado:** implementada como primera colección de tres fotos. La [decisión 0109](0109-archivo-vivo-primera-persona.md) amplía la vista inmersiva. La [decisión 0111](0111-ampliacion-archivo-vivo.md) incorpora la colección rotativa y las prácticas.
- **Origen:** Álvaro propuso una modalidad de fotografía histórica con exploración inmersiva.

## Partida

Archivo Vivo se abre desde Jugar, la navegación superior y el menú. Se empieza por la foto documental. Al tocarla se accede a un visor con arrastre, flechas de teclado, zoom, encuadre inicial y vista inmersiva. El jugador escribe el año y confirma. La revelación muestra el año documentado, el error en años, la historia de la toma y su atribución. Las pistas opcionales describen objetos visibles en el original. El resumen enlaza las tres fichas y permite repetir.

Cada ronda aporta hasta 1000 puntos. La puntuación se calcula como `redondear(1000 × exp(−error_en_años / 12))`: el año exacto da 1000, un año de error da 920 y diez años dan 435. La primera colección es fija, gratuita y se puede repetir. El navegador conserva la ronda y el año en edición. La puntuación es personal y las respuestas se incluyen en el catálogo del cliente. Plus se muestra con el componente compartido en el resumen.

## Visor y edición de escenas

- El visor dibuja una perspectiva sobre una textura panorámica mediante WebGL. Solo carga la escena cuando se abre, redibuja cuando cambia la vista y libera sus recursos al salir. Si el dispositivo no ofrece WebGL o falla la textura, la ronda sigue siendo jugable con la fotografía.
- En Chicago y Ámsterdam, la vista frontal de la recreación se orienta hacia una composición semejante a la foto. El usuario puede girar desde ese punto fijo. Las extensiones se produjeron fuera del juego con el generador integrado de imágenes y siempre se rotulan «Recreación con IA». Se pidió un panorama equirectangular 2:1 monocromo, con la toma como referencia del centro, continuidad lateral y objetos de época. En Chicago el encargo incluyó el cruce, los toldos, los peatones y el tranvía. En Ámsterdam incluyó los cinco frentes de tranvía, la cubierta de acero y las vías de la cochera.
- En la Luna se usa el montaje histórico de Eric Jones, con 360° alrededor del horizonte y un margen vertical limitado por las tomas. La foto de la ronda es un recorte de ese montaje. Sus bordes contienen los cortes del material de archivo.
- La fecha se comprueba en un catálogo fechado, el historial de la fotografía o la cronología primaria. Detalles de recreación como rótulos, peatones añadidos o vehículos secundarios quedan fuera de las pistas.

| Toma | Fecha acreditada | Autoría y derechos |
| --- | --- | --- |
| [State Street](https://www.loc.gov/resource/fsa.8a06473/) | Julio de 1940 | John Vachon / Library of Congress, sin restricciones conocidas. Se recortó el borde del negativo. |
| [Estación ALSEP](https://commons.wikimedia.org/wiki/File:Apollo_16_-_ALSEP_Pan_HR_2_panorama.jpg) | 21 de abril de 1972, [cronología de la NASA](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_16i_Timeline.htm) | NASA / John Young y Charlie Duke. Montaje de Eric Jones, dominio público en EE. UU. según la ficha. |
| [Cochera de Lekstraat](https://commons.wikimedia.org/wiki/File:Trams_in_de_remise_in_de_Lekstraat,_Bestanddeelnr_932-4096.jpg) | 22 de noviembre de 1982 | Marcel Antonisse / Anefo / Nationaal Archief, CC0 1.0. |

## Alternativas consideradas

- Ampliación plana como [Rewind](https://witsday.com/rewind/). Conserva la autenticidad de toda la imagen visible y permite inspeccionar detalles. La exploración alrededor del punto de toma requería un panorama.
- Generar escenas cuando el jugador toca la foto. Introduciría espera y variaciones entre jugadores. El catálogo fija cada escena antes de jugar y permite comprobar que los elementos plausibles siguen fuera de las pistas.
- Desplazamiento entre posiciones al estilo de Street View. Requiere capturas históricas solapadas o un entorno tridimensional reconstruido. La primera colección gira desde un punto por escena.
