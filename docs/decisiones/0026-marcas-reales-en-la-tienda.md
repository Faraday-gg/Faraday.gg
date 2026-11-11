# 0026. Piezas con nombres de marcas reales en la tienda

- **Estado:** propuesta (código en la rama `feat/tienda-marcas`)
- **Fecha:** 2026-11-11
- **Quién:** Luis, con Claude Code
- **Cambia a:** el punto de la [0025](0025-avatar-3d.md) que decía que todas las marcas de la ropa son inventadas. El resto de la 0025 sigue igual.

## Contexto

La tienda solo tenía ropa de marcas propias (≈ y FRDY). Luis quiere piezas «de calidad» de marcas que los jugadores reconocen (Nike, Adidas, Gucci…), además de más zapatillas y peinados.

## Decisión

- **50 piezas nuevas** en `dist/avatar.js` (el catálogo pasa de 153 a 203 y suma 66.050 faradios):
  - 19 prendas: camisetas, sudaderas, chándales, plumas y una de baloncesto de Nike, Adidas, Puma, Lacoste, Supreme, Gucci, Balenciaga, Champion, Carhartt, Stüssy, Jordan, The North Face y Moncler.
  - 5 pantalones (Levi's, Adidas, Nike, Dickies, Carhartt) y 11 zapatillas y botas (Vans, Converse, Adidas, New Balance, Nike, Jordan, Dr. Martens, Timberland, Gucci).
  - 5 gorros y gorras (Carhartt, Nike, New Era, Supreme, Gucci), 2 gafas (Ray-Ban, Oakley), 6 peinados (tupé, coleta, melena corta, cresta, dos moños, pelo largo) y 2 colores de pelo (naranja, turquesa).
- **De cada marca solo se usa el nombre**, escrito con nuestra letra (Arial Black) sobre la prenda o en una etiqueta. **No se dibujan logotipos ni diseños registrados**: ni el símbolo de Nike, ni las tres bandas, ni monogramas, ni cocodrilos. El chándal sigue con dos franjas.
- **Formas nuevas en `dist/avatar3d.js`:** zapatilla de correr (`runner`), botas, zapatillas de dos colores (lengüeta, franja y talón), gafas de aviador, visor deportivo, seis peinados y etiquetas de texto para gorros y plumas.
- En el catálogo, una prenda de marca lleva el estampado `'@NOMBRE'`; los gorros, `hatBrand`.

## Alternativas descartadas

- **Marcas inventadas que recuerden a las reales.** Es lo más seguro, pero no es lo que se pidió: el atractivo está en el nombre reconocible.
- **Reproducir los logotipos.** Aumenta mucho el riesgo legal y no se pueden dibujar bien con formas básicas.

## Consecuencias

- **Riesgo legal: los nombres son marcas registradas y no tenemos licencia ni acuerdo con ninguna.** El repositorio y la web son públicos. Mientras los faradios solo se ganen jugando el riesgo es bajo, pero **antes de cobrar dinero real por cosméticos** ([idea de monetización](../ideas/monetizacion-cosmeticos.md)) o de hacer publicidad con estas piezas hay que retirarlas, renombrarlas o conseguir permiso. Si una marca pide retirarlas, basta con borrar sus líneas del catálogo: los looks guardados vuelven solos a la pieza por defecto.
- Álvaro no ha participado en esta decisión; conviene que la confirme al revisar la PR.
- Los peinados de melena y pelo largo atraviesan un poco la capucha, igual que ya pasaba con «Cortina».
- Sin pruebas automáticas: las piezas se han comprobado a mano en el navegador.
