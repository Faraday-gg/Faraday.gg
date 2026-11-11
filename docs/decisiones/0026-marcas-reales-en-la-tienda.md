# 0026. Piezas de marcas reales en la tienda, con su logotipo

- **Estado:** propuesta (código en la rama `feat/tienda-marcas`)
- **Fecha:** 2026-11-11
- **Quién:** Luis, con Claude Code
- **Cambia a:** el punto de la [0025](0025-avatar-3d.md) que decía que no se reproducen logotipos ni diseños de marcas reales. El resto de la 0025 sigue igual.

## Contexto

La tienda solo tenía ropa de marcas propias (≈ y FRDY). Luis quiere piezas «de calidad» de marcas que los jugadores reconocen (Nike, Adidas, Gucci…), además de más zapatillas y peinados. Una primera versión escribía solo el nombre de la marca en la prenda; Luis la descartó: las piezas deben llevar **el logotipo real, modelos reales y sus colores reales**.

## Decisión

- **50 piezas nuevas** en `dist/avatar.js` (el catálogo pasa de 153 a 203 y suma 64.820 faradios):
  - 19 prendas: camisetas, sudaderas, chándales, plumas y una de baloncesto de Nike, Adidas, Puma, Fila, Reebok, Under Armour, The North Face, Jordan, Supreme, Gucci y Balenciaga.
  - 5 pantalones (Levi's, Nike, Adidas, Jordan) y 11 zapatillas y botas con nombre de modelo: Vans Old Skool, Converse Chuck Taylor, Adidas Samba y Superstar, New Balance 574, Nike Dunk Panda y Air Max 90, Air Jordan 1 Chicago, Gucci Ace, Dr. Martens 1460 y Timberland 6 Inch.
  - 5 gorros y gorras (The North Face, Nike, Jordan, Supreme, Gucci), 2 gafas (Ray-Ban Aviator, Oakley), 6 peinados (tupé, coleta, melena corta, cresta, dos moños, pelo largo) y 2 colores de pelo (naranja, turquesa).
- **Logotipos reales.** Los de Nike, Adidas, Puma, Jordan, The North Face, New Balance, Under Armour, Fila y Reebok son trazados vectoriales exactos, copiados de [Simple Icons](https://simpleicons.org) 16.35.0 (datos con licencia CC0) en el archivo nuevo `dist/avatar-logos.js` (10 KB). Los que esa colección no tiene se dibujan en `dist/avatar3d.js` (`DRAWN`): caja roja de Supreme, doble G y franja verde-roja-verde de Gucci, letras de Balenciaga, tres bandas de Adidas, franja lateral de Vans y estrella de Converse.
- **Colores de los modelos reales:** Dunk blanca y negra, Jordan 1 blanca, roja y negra, Samba con suela de goma, plumas Nuptse amarillo con canesú negro, chándal Adidas negro con tres bandas blancas, etc.
- **Solo marcas cuyo logotipo se puede dibujar bien.** Se descartaron Lacoste, Champion, Carhartt, Stüssy, Moncler, Dickies y New Era porque su logotipo no está en la colección y a mano quedaba mal.
- **Formas nuevas en `dist/avatar3d.js`:** zapatilla de correr (`runner`), botas, zapatillas de dos colores, gafas de aviador, visor deportivo y seis peinados. En la tienda, las zapatillas se enseñan de lado y con pantalón corto para que se vea el logotipo.
- En el catálogo, una prenda de marca lleva el estampado `'@marca'`; los gorros, `hatBrand`; los pantalones, `bottomLogo`, y las zapatillas, `shoesLogo`.

## Alternativas descartadas

- **Escribir solo el nombre de la marca.** Fue la primera versión; Luis la descartó porque no parece la prenda real.
- **Marcas inventadas que recuerden a las reales.** Es lo más seguro, pero el atractivo está en la marca reconocible.
- **Dibujar todos los logotipos a mano.** Los complejos (puma, Jumpman) quedaban aproximados; se prefirió copiar los trazados exactos.

## Consecuencias

- **Riesgo legal claro: los logotipos y los nombres son marcas registradas y no tenemos licencia ni acuerdo con ninguna.** Que los trazados vengan de una colección CC0 no da permiso para usar la marca. El repositorio y la web son públicos. Mientras los faradios solo se ganen jugando es menos probable que una marca reclame, pero **antes de cobrar dinero real por cosméticos** ([idea de monetización](../ideas/monetizacion-cosmeticos.md)), de hacer publicidad con estas piezas o de crecer mucho, hay que retirarlas o conseguir permiso. Para retirar una marca basta con borrar sus piezas del catálogo y su línea de `avatar-logos.js`: los looks guardados vuelven solos a la pieza por defecto.
- Álvaro no ha participado en esta decisión; conviene que la confirme al revisar la PR.
- La web no pide los logotipos a ningún servicio externo: están copiados en el repositorio.
- Los peinados de melena y pelo largo atraviesan un poco la capucha, igual que ya pasaba con «Cortina».
- Sin pruebas automáticas: las piezas se han comprobado a mano en el navegador.
