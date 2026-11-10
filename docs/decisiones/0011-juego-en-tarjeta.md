# 0011 — El juego dentro de una tarjeta

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
Con la [decisión 0010](0010-juego-a-pantalla-completa.md), cada paso del juego pintaba la pantalla entera con su color. Luis pidió que todo estuviera dentro de un recuadro, como una carta, para que el juego se perciba como una pieza compacta.

## Decisión
- La página del juego queda neutra (crema), con la flecha de volver y la marca Faraday.gg arriba.
- La pregunta, la respuesta y el resultado final van dentro de una tarjeta centrada: 600 px de ancho como máximo, esquinas redondeadas y una sombra suave. La tarjeta lleva la paleta de cada paso de la decisión 0010 (coral, azul noche y amarillo).
- Los pasos (1, 2, 3 y Total) y el número del reto están en la cabecera de la tarjeta.
- En la respuesta, la tarjeta muestra la distancia, las dos cifras y el gráfico. «Cómo se calcula, foto y fuentes» va plegado, y «Siguiente pregunta» ocupa todo el ancho al final de la tarjeta.
- En el móvil, la tarjeta ocupa casi todo el ancho, con un margen de 10 px.

## Alternativas descartadas
- **Copiar la web de Fermi.gg en español a partir de un scraping:** se descartó. Sería clonar el aspecto de otro producto. La tarjeta es un patrón genérico; lo hacemos con nuestra paleta, nuestra tipografía y nuestros textos.
- **Todo el color a pantalla completa (0010):** se distinguían bien los pasos, pero el juego no se veía como una pieza compacta.

## Consecuencias
- Sustituye la parte de «a pantalla completa» de la decisión 0010. Siguen valiendo su contenido por pantalla, la navegación y las paletas.
