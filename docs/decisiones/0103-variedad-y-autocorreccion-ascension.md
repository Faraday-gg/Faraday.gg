# 0103. Variedad de preguntas y autocorrección en Ascensión

- **Estado:** implementada.
- **Fecha:** 2026-11-19.
- **Quién:** Álvaro, con Codex.
- **Amplía:** [0098](0098-ascension-respuestas-raras.md).

## Auditoría

El banco de lanzamiento tenía 28 categorías. Veintidós correspondían a geografía de países y territorios, emojis o premios Nobel. El selector consideraba cada conjunto de emojis como un tema propio, por lo que su límite dejaba entrar varias preguntas con el mismo planteamiento.

En las 120 fechas consecutivas desde el 19 de noviembre de 2026, el banco anterior colocaba al menos cuatro preguntas de ese grupo en 114 diarias. El nuevo banco baja a cero diarias con cuatro o más de ese grupo. El promedio baja de 5,3 a 1,4 por partida. Las repeticiones de una categoría exacta entre días consecutivos bajan de 212 a 30. La primera práctica de cada una de las 120 fechas tiene preguntas distintas a la diaria. La comparación mide repertorio y rotación, no comportamiento de jugadores.

## Decisión

El catálogo pasa de 2.637 a 3.410 entradas repartidas en 49 categorías. Los 21 grupos nuevos incluyen cine, Pokémon, cocina, orquesta, deportes femeninos y masculinos, cuerpo humano, tradiciones, literatura y astronomía. Cada pregunta establece el repertorio que cuenta. Las categorías familiares tienen al menos cinco respuestas valoradas en 10 o 30 puntos para ofrecer distintas formas de empezar.

Cada partida combina cuatro preguntas familiares, dos de descubrimiento y una difícil. Las dos primeras son familiares. Hay siete temas distintos y como máximo dos preguntas de ciencia, cuerpo, espacio o naturaleza en conjunto. Los emojis comparten un tema y los Nobel cuentan como preguntas difíciles. Dentro de semanas fijas, la diaria da prioridad a las categorías que no salieron en las dos fechas previas. Las prácticas dan prioridad a categorías distintas a las de la diaria y a las de la selección anterior cuando hay alternativas.

El servidor conserva la copia privada de las categorías de las partidas existentes. Las nuevas partidas utilizan la versión 2 del banco. Si coinciden dos versiones en un mismo día por el despliegue, cada una conserva su clasificación.

La coincidencia exacta conserva prioridad y se siguen aceptando nombres regionales, mayúsculas y tildes. Para una errata, el servidor tolera artículos, espacios, letras cambiadas o intercambiadas y letras de más o de menos dentro de un límite que crece con la longitud. Con dos respuestas igual de cercanas se puede reintentar mientras quede tiempo. Se mantiene el número escrito en los títulos para distinguir secuelas. Al aceptar una corrección se muestran el nombre canónico y una nota breve. Solo se conserva ese nombre, junto con el indicador de corrección.

## Fuentes

Las preguntas y los rangos de rareza son propios. Cada categoría enlaza su repertorio primario en el juego y en el fichero editorial reproducible. [Fuentes y criterios del banco](../../research/ascension-fuentes.md).
