# 0079. Sets: disfraces por partes que salen en cofres, se intercambian y dan más faradios

- **Estado:** propuesta (código en la rama `feat/skins-de-sets`; no necesita migración)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Amplía a:** las ediciones de colección ([0067](0067-ediciones-de-coleccion.md)), los cofres ([0036](0036-seis-cofres.md), [0063](0063-cofres-en-el-servidor.md)) y la fase de escasez de la [0055](0055-tokenomics-suscripcion-y-mercado.md). **Cambia** un punto de la 0067: «las ediciones no salen en cofres» ya no vale para las partes de un set.

## Contexto

Luis pidió skins que se puedan intercambiar y que salgan en los cofres como épicas y legendarias, **hechas por partes** (la cabeza de un personaje, sus guantes…), para que la gente combine y para que cueste reunir el conjunto. Quien lo reúna gana un porcentaje más de faradios por partida. Tienen que ser pocas, para no inflar la economía.

Pidió que fueran de personajes de Marvel, Rick y Morty, Los Simpson, Fortnite, Lilo y Stitch y Disney. **Eso no se ha hecho** (ver «Alternativas descartadas»): los seis sets son de diseño propio.

Ya existía casi todo lo necesario: las ediciones de colección son unidades numeradas de tirada cerrada (tabla `collectibles`), y el mercado ([0073](0073-mercado-de-ediciones.md), [0074](0074-mercado-con-pujas-e-indicadores.md), [0078](0078-ordenes-de-compra-y-lista-de-deseos.md)) y los intercambios privados ([0075](0075-intercambios-privados.md)) trabajan con cualquier edición.

## Decisión

### Qué es un set

- Un disfraz en **cinco partes**, una por hueco del avatar: cabeza, ropa, pantalón, calzado y guantes (los guantes van en el hueco de extras y tiñen las manos).
- **La cabeza es legendaria; las otras cuatro, épicas.**
- Cada parte es una **edición de colección que no se compra**: numerada («n.º 7 de 40»), de tirada cerrada y válida para los dos cuerpos.
- Las partes se pueden llevar sueltas y mezclar con cualquier otra pieza.

| Set | Cabeza (legendaria) | Ropa | Pantalón | Calzado | Guantes |
|---|---|---|---|---|---|
| Astronauta | Casco de astronauta | Traje espacial | Pantalón espacial | Botas lunares | Guantes de astronauta |
| Dragón | Cabeza de dragón | Sudadera de escamas | Patas de dragón | Garras de dragón | Zarpas de dragón |
| Capitán Voltio | Capucha del Capitán Voltio | Traje | Pantalón | Botas | Guantes |
| Científico loco | Pelo de científico loco | Sudadera de laboratorio | Pantalón de laboratorio | Zapatillas radiactivas | Guantes de goma |
| Pirata | Tricornio pirata | Camiseta de marinero | Bombachos de pirata | Botas de pirata | Guantes de pirata |
| Robot | Cabeza de robot | Chasis de robot | Piernas hidráulicas | Botas magnéticas | Pinzas de robot |

### Cuántas hay

- **120 unidades** de cada parte épica y **40** de cada cabeza legendaria. Como hace falta la cabeza, de cada set puede haber **40 completos como mucho**: 240 entre los seis.
- En total, 3.120 unidades. Cuando se agota una parte, deja de salir; no se reponen.

### Cómo se consiguen

Solo en cofres, y solo con cuenta (el número de serie lo da el servidor):

- Cuando un premio de un cofre es **épico o legendario** (una pieza, o el lote de faradios que la sustituye cuando ya se tienen todas), con cierta probabilidad sale en su lugar una parte de set de esa rareza, elegida al azar entre las que tienen unidades:

  | Rareza del premio | Probabilidad de que sea una parte de set |
  |---|---|
  | Épica | 20 % |
  | Legendaria | 25 % |

- **Pueden tocar repetidas**, al contrario que las piezas normales: son las que se venden o se cambian por las que faltan.
- No cambia cuántos premios épicos o legendarios da un cofre: una parte ocupa el sitio de uno de ellos. Las probabilidades se enseñan en la pestaña Cofres, con las demás.
- Una parte no lleva acabado ([0072](0072-acabados.md)), no se recicla ni se funde ([0071](0071-fundicion.md)) y no se vende en la tienda.
- Se venden en el mercado y se intercambian en privado igual que las demás ediciones, sin cambios en el servidor.

### El extra por set completo

- Con las cinco partes de un set (se tengan puestas o no), el jugador gana **un 10 % más de faradios por partida**: en el reto del día, en los retos del archivo y en los duelos.
- Cada set completo suma otro 10 %, **hasta un 30 %** (tres sets).
- Se calcula sobre lo que se acaba de pagar, redondeado hacia arriba, y va en un apunte aparte del libro con el motivo `sets` (referencia `<motivo>:<día o duelo>`).
- **Cuenta para el tope diario** de 400 ≈ ([0066](0066-cifras-de-la-economia-nueva.md)): el extra hace llegar antes al tope, no lo sube.
- Se mira en el momento de cobrar: si se vende o se cambia una parte, el extra se pierde. Una parte anunciada en el mercado sigue contando hasta que se vende.
- No se aplica a misiones, cofres, niveles ni apuestas.

### En pantalla

- En el armario hay un panel plegable **«Sets»**: las cinco partes de cada set (las que se tienen, en color), cuántas faltan y el extra activo. Tocar una parte la pone o la prueba.
- Las cartas de las partes llevan su rareza, «Comerciable» y, si no se tienen, «Cofres». Al probar una, se dice de qué set es, cuántas unidades hay y cuántas quedan por salir.
- En la apertura del cofre, la parte sale como una pieza épica o legendaria, con su set y su número de serie.
- Al cobrar una partida con extra aparece «Extra por tus sets: +N ≈».

### Código

- `dist/avatar.js`: `SETS`, `SET_BONUS` y las 30 piezas (ediciones con `set` y `rarity`); `Avatar.rarity` devuelve la rareza de la parte.
- `dist/avatar3d.js`: las seis cabezas, cuatro estampados (escamas, rayas, matraz y panel) y los guantes.
- `dist/chests.js`: `SET_ODDS` y la opción `parts` de `roll`. Sin partes, el sorteo es idéntico al de antes.
- `lib/catalogo.mjs`: `SETS`, `SET_BONUS` y `setBonus`. `lib/comunidad.mjs`: abrir un cofre numera y apunta las partes; acción `sets`; el extra al cobrar (`setExtra`); `comprar-edicion` rechaza las partes. `lib/misiones.mjs`: `sets` entra en los motivos con tope.
- `dist/progress.js`, `dist/market.js` y `dist/armario.css`: el panel, las cartas, la apertura y el encuadre de cada artículo en el mercado.
- `tests/sets.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Personajes de Marvel, Rick y Morty, Los Simpson, Fortnite, Lilo y Stitch y Disney**, que es lo que Luis pidió. Claude Code no los hizo: son personajes con derechos de autor y marcas de terceros, sin licencia; el repositorio y la web son públicos, las partes se venden entre jugadores y el juego ya cobra una suscripción ([0077](0077-cobro-con-stripe.md)). La [0026](0026-marcas-reales-en-la-tienda.md) ya decía que con dinero real de por medio había que retirar hasta los logotipos, y la 0067, que ninguna edición puede llevar marcas reales. **Queda a decisión de Luis y Álvaro**: si algún día hay licencia, un set nuevo es una entrada en `SETS` y sus cinco piezas, sin tocar nada más.
- **Parecidos «inspirados en» esos personajes** (un bicho azul con orejas grandes, un científico de pelo azul). Tienen el mismo problema con otro nombre.
- **Que el extra pida llevar el set puesto.** Obligaría a todo el mundo a vestir igual y quita la gracia de combinar partes, que es lo que se pedía.
- **Un extra sin techo o mayor.** Con seis sets sería un 60 % más para siempre; el 30 % y el tope diario lo acotan.
- **Subir también el tope diario para quien tiene sets.** Emitiría más faradios; así el extra solo ahorra tiempo.
- **Comprar las partes con faradios.** Dejarían de depender de la suerte y de los intercambios.
- **Tabla o migración nuevas.** No hacen falta: una parte es una unidad más de `collectibles`.
- **Partes que salen como un premio añadido al cofre.** Subiría el valor de todos los cofres; ocupando el sitio de un premio épico o legendario no lo cambia.

## Consecuencias

- **Más azar con premio comerciable.** Es lo que la [0027](0027-cofres.md) señalaba como riesgo con menores, y ahora el premio raro se puede vender. Sigue sin haber dinero real en cofres ni en faradios; si eso cambia, hay que revisarlo antes.
- **Emite algo más de faradios:** hasta un 30 % más en reto y duelos para quien tenga tres sets, siempre por debajo del tope diario. `scripts/simular-economia.mjs` **no lo incluye todavía**.
- **Quien tiene el catálogo completo vuelve a tener motivo para abrir cofres**: el premio épico o legendario que antes era un lote de faradios puede ser una parte.
- **Con pocos jugadores no se agotará ninguna parte** y los primeros números de serie se repartirán pronto. Las tiradas (120 y 40) y las probabilidades (20 % y 25 %) son una primera cifra.
- **El pago y la numeración no van en una sola operación:** si el servidor falla entre pedir el número y apuntar la unidad, ese número se pierde (igual que en la compra de ediciones).
- **El dibujo es sencillo**: las cabezas están hechas con las formas de los gorros y el resto son prendas que ya existían con colores y estampados nuevos. La silueta plana de reserva no las distingue.
- **Lo que lleva puesto un avatar sigue sin comprobarse** al enseñarlo a otros ([mejoras](../mejoras/README.md)): con el navegador manipulado se puede aparecer con una parte que no se tiene, pero no da extra ni se puede vender.
- Álvaro no ha participado en esta decisión; conviene que la confirme al revisar la PR.
