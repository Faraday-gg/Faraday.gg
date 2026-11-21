# 0111. Más épocas, dos brazos y continuación en Archivo Vivo

- **Fecha** · 2026-11-21.
- **Estado** · Implementada.
- **Amplía** · [Archivo Vivo](0108-archivo-vivo.md), [el avatar en primera persona](0109-archivo-vivo-primera-persona.md) y [los anuncios comunes](0099-anuncios-para-continuar.md).

## Partidas

La colección crece de tres a diez fotografías tomadas entre 1852 y 2001. Se aceptan estimaciones de 1840 a 2020 para dejar margen en ambos extremos. La sesión inicial gratuita alterna cuatro grupos de tres fotos según el día de Madrid. Cada grupo incluye al menos una foto anterior a 1900 y las diez pasan por la rotación gratuita. Las prácticas reúnen otras tres, priorizan las aún no vistas ese día y evitan repetir la partida anterior cuando reciclan el catálogo. Las partidas en curso se pueden retomar, incluso al día siguiente. Un intento guardado desde la primera versión conserva sus fotos y respuestas.

Tras terminar la partida aparece la continuación común. En el plan gratuito se usa el primer anuncio simulado de 15 segundos de Archivo Vivo cada día de Madrid y los posteriores de 60 segundos. Plus abre la práctica directamente. Cancelar un anuncio conserva su turno. Las puntuaciones siguen siendo personales. [Referencia del flujo de anuncios con recompensa](https://developers.google.com/ad-placement/apis?hl=es)

## Visor

La [decisión 0114](0114-archivo-vivo-postura-y-apoyo.md) actualiza la postura, el apoyo y la selección de panoramas para partidas nuevas.

Ambos antebrazos y sus manos aparecen elevados en los lados del encuadre, con la piel y las prendas equipadas. El centro queda disponible para inspeccionar la escena. Los brazos bajan suavemente en función de la inclinación al mirar a los pies. El zoom de la foto mantiene la escala del avatar. [Renderizado en primera persona](https://dev.epicgames.com/documentation/en-us/unreal-engine/first-person-rendering)

Los panoramas de Chicago y Ámsterdam se rehacen usando sus fotos como referencia frontal. En los ocho montajes generados, se busca mantener las proporciones, el ángulo, las sombras y los objetos documentados. El visor suaviza el cruce del meridiano trasero solo en las recreaciones. Los panoramas de San Francisco y de la Luna conservan la franja vertical que registraron las fotos. Las texturas se cargan cuando se entra y se ajustan al tamaño máximo que acepta el dispositivo. Las recreaciones se identifican dentro del visor y las pistas se redactan a partir de los originales. [Encuadre en panoramas equirectangulares parciales](https://pannellum.org/documentation/reference/#equirectangular-specific-options)

## Nuevas fotografías

| ID | Toma | Fecha | Autoría y derechos |
| --- | --- | --- | --- |
| 04 | [Público del desfile en Washington](https://www.loc.gov/pictures/item/2013649000/) | Mayo de 1865 | Autoría sin identificar / Library of Congress. Sin restricciones conocidas. |
| 05 | [Torre Eiffel en obras](https://parismuseescollections.paris.fr/en/node/461661) | 10 de mayo de 1888 | Théophile Féau / Musée Carnavalet, Paris Musées. CC0. Se recorta la segunda toma de la lámina y se excluye la fecha escrita en su soporte. |
| 06 | [Animales y cuidadores en la feria de Chicago](https://www.loc.gov/resource/ds.14184/) | 1893 | Frances Benjamin Johnston / Library of Congress. Sin restricciones conocidas. |
| 07 | [Una calle de Grasse](https://www.metmuseum.org/art/collection/search/283736) | 1852 | Charles Nègre / The Metropolitan Museum of Art. Dominio público. |
| 08 | [Escena de calle en San Juan](https://www.loc.gov/resource/fsa.8b30615/) | Enero de 1938 | Edwin Rosskam / Library of Congress, FSA-OWI. Dominio público. |
| 09 | [Sala de control de la estación espacial en Houston](https://www.nasa.gov/image-article/space-station-flight-control-room/) | 16 de agosto de 2001 | NASA / Johnson Space Center. Dominio público en EE. UU. |
| 10 | [Panorama de San Francisco](https://commons.wikimedia.org/wiki/File:Panorama_of_San_Francisco_by_Eadweard_Muybridge,_1878.jpg) | Abril de 1878 | Eadweard Muybridge / Society of California Pioneers. Digitalización de Gawain Weaver, dominio público. Trece placas, [ver conservación](https://gawainweaver.com/news/News-1878-Muybridge-San-Francisco-Panorama-Conserved/). |

## Encargos de generación

Los JPEG finales están en `dist/assets/archivo-vivo/`. Se usó el generador integrado de imágenes por separado para los ID 01, 03 y 04 a 09. El encargo común pidió una textura equirectangular 2:1 de 360° × 180°, con la composición, proporciones, tono y pistas de la foto documental en el centro, extensiones de época plausibles y ambos extremos alineados a la misma vista trasera. Se excluyeron marcos, fechas legibles, objetos modernos y duplicaciones. Estas fueron las referencias de escena:

- **01 Chicago** · Toldos, tranvía, farolas, peatones y adoquines desde el ángulo de State Street.
- **03 Ámsterdam** · Cinco frentes de tranvía, raíles continuos y cubierta dentada en la misma cochera.
- **04 Washington** · Arco de piedra, verja, sombrillas y público. Se pidió retirar la cúpula que había añadido el primer borrador y continuar las columnas con una cornisa de época.
- **05 París** · Hierro y andamios en el estado de la primera plataforma fotografiada. Se excluyó la torre terminada.
- **06 Feria de Chicago** · Pabellón arqueado, fila de elefantes y cebras, bombines y farola en la posición de referencia.
- **07 Grasse** · Camino de ladera, muros de piedra, lavadero, casas y ropa tendida.
- **08 San Juan** · Fachada de dos tonos, personas en la acera, adoquines y automóvil de época en primer plano.
- **09 Houston** · Consolas y grandes pantallas del centro de control, monitores gruesos y teléfono con cable.

## Alternativas

Más fotografías por partida habría alargado el juego base y reducido la variedad de las prácticas. Se mantuvieron tres por partida y se amplió el catálogo. Añadir altura ficticia a las tomas históricas habría alterado lo que documentan. El recorte vertical se configura por panorama.
