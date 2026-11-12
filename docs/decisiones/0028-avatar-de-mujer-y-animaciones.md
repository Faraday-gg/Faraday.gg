# 0028. Avatar de hombre o de mujer, con su colección, y animaciones más naturales

- **Estado:** propuesta (código en la rama `feat/avatar-mujer-animaciones`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0025](0025-avatar-3d.md) (avatar 3D) y la [0026](0026-marcas-reales-en-la-tienda.md) (piezas de marca). No las sustituye.

## Contexto

El avatar solo tenía un cuerpo, de chico, y se movía de forma mecánica: un vaivén de seno, los brazos rígidos (sin codo), un parpadeo cada 4,2 segundos exactos y un único saludo al aparecer. Luis pidió animaciones más naturales y con variantes, poder elegir entre hombre y mujer, y que la mujer tenga «todo lo cosmético»: el mismo número de piezas, con el mismo formato y estilo.

## Decisión

### Dos cuerpos

- El look guarda el cuerpo (`body`: `hombre` o `mujer`). Un look sin cuerpo, de antes de esta decisión, es de hombre.
- En el armario hay un selector **Hombre / Mujer** encima de las pestañas. Cada cuerpo recuerda su ropa y su peinado (`closet` en `localStorage`); al cambiar se conservan la piel y el color de pelo.
- El cuerpo de mujer (`dist/avatar3d.js`) tiene cintura, hombros, brazos y piernas más finos, pestañas y ceja fina. La cabeza es la misma.

### Colección de mujer: 185 piezas, las mismas que la de hombre

- El catálogo (`dist/avatar.js`) pasa de 203 a **384 piezas**: 185 de hombre, 185 de mujer y 19 comunes (12 colores de pelo, 6 pieles y «Nada»). No son 388 porque los cuatro «Nada» (cabeza, gafas, cuello, extras) ya no se cuentan dos veces.
- Cada pieza de mujer es la pareja de una de hombre: **mismo hueco, mismo precio, mismo nivel y misma rareza**. Por hueco: 69 de ropa, 24 de pantalón, 28 de zapatillas, 30 de cabeza, 17 peinados, 4 gafas, 2 de cuello, 4 extras y 3 gestos. Cada colección suma 64.340 faradios.
- Lo que cambia es el corte y el surtido:
  - **Ropa:** la camiseta es un top corto; sudaderas, chándales, plumas y universitarias llegan a la cintura. Mismos estampados (≈, FRDY, 1,2×, ajedrez, llamas) y las mismas marcas reales.
  - **Pantalón:** vaquero ancho, **falda** tableada (con calcetín), **mallas**, corto, chándal y cargo.
  - **Zapatillas:** las mismas hormas, en otros colores. Modelos de marca: Vans Old Skool, Converse Chuck Taylor, Adidas Gazelle y Superstar, New Balance 530, Nike Dunk y Air Max 90, Air Jordan 1, Dr. Martens 1460, Timberland 6 Inch y Gucci Ace.
  - **Cabeza:** gorros, capucha, pescadores y gorras, más **boinas**, **lazos** y **diademas**. Por nivel: diadema dorada (5), aureola (10) y **tiara** (15).
  - **Peinados:** melena lisa, bob con flequillo, rizos largos, pixie, sin pelo, media melena, moño alto, dos trenzas, dos coletas, trenzas africanas, afro, largo con flequillo, coleta alta, trenza lateral, semirrecogido, dos moños y pelo extralargo.
  - **Gafas, cuello y extras:** ojo de gato, gafas de sol de corazón, Ray-Ban Round y Oakley rosas; colgante y collar de perlas; aros grandes, cascos lila y pendientes de diamante (nivel 8).
- **Cada cuerpo solo lleva su colección** (y las piezas comunes). Las piezas de mujer llevan el prefijo `mj-` en el identificador y el campo `for: 'mujer'`. Si un look trae una pieza del otro cuerpo, vuelve a la de por defecto.
- **No se añade ninguna marca nueva** respecto a la 0026: se usan los mismos logotipos.

### Animación

- **Esqueleto con articulaciones:** cadera → cintura → cuello → cabeza; cada brazo dobla por el codo; las zapatillas van aparte de las piernas y se quedan en el suelo cuando la cadera se mueve.
- **Postura base que no se repite:** respira, se mece con tres ondas de periodos que no casan, apoya el peso en una pierna y mira con una deriva suave.
- **Retardo por partes:** cada articulación persigue a su objetivo; la cabeza y los antebrazos llegan un poco después que el cuerpo, y la melena, las coletas y las trenzas se balancean con retraso.
- **Parpadeo irregular** (cada 2-6 segundos, a veces doble).
- **20 gestos** que entran y salen suaves, elegidos al azar sin repetir el anterior:
  - Tranquilo (11): mirar a los lados, cambiar el peso de pierna, estirarse, rascarse, brazos en jarras, botar, dar golpecitos con el pie, encogerse de hombros, bailar, girar el cuello y pensar con la mano en la barbilla.
  - Saludo (2), celebración (salto, puño y giro, más el baile), lamento (suspiro y negar con la cabeza) y golpe (sacudida y tambaleo).
- En la portada saluda al aparecer, con una de las dos variantes, y otra vez al pasar el ratón. En los duelos, quien gana va alternando celebraciones y quien pierde se queda cabizbajo.
- Con uno o dos avatares en pantalla se dibuja cada fotograma (antes, 30 por segundo); con más, 30.
- Con «reducir movimiento» activado en el sistema, el avatar se queda quieto, como antes.

## Alternativas descartadas

- **Una sola colección para los dos cuerpos.** Es lo más flexible, pero Luis pidió la colección de mujer aparte y con el mismo número de piezas, y una lista de casi 400 piezas por hueco es difícil de recorrer.
- **Animaciones grabadas (archivos de animación o un esqueleto exportado de Blender).** Darían más detalle, pero el personaje se construye en el código y no hay modelo al que aplicarlas.
- **Duplicar también el color de pelo y la piel.** Son colores, no prendas: se comparten.

## Consecuencias

- **Los cofres ([decisión 0027](0027-cofres.md)) solo dan piezas del cuerpo que se lleva puesto** y las comunes, para que el premio siempre se pueda estrenar. Con el catálogo de cada cuerpo igual de grande y a los mismos precios, el valor medio de un cofre no cambia.
- **Las piezas compradas son de un cuerpo.** Quien cambia de cuerpo empieza con las piezas gratuitas del otro y tiene que comprar las suyas. Si resulta frustrante, se puede regalar la pareja de cada pieza comprada: los precios coinciden uno a uno ([idea](../ideas/piezas-para-los-dos-cuerpos.md)).
- Más piezas de marcas reales (42: las parejas de las de la 0026), con el mismo riesgo legal que describe esa decisión.
- El servidor de duelos acepta el campo `body` (`lib/duelos.mjs`) y sigue sin comprobar que las piezas se hayan comprado. Un rival con una versión anterior de la web ve a una jugadora con el avatar por defecto de hombre.
- Los brazos son cortos y la cabeza grande: las manos no llegan a la cara ni a lo alto de la cabeza, y algunos gestos (estirarse, rascarse) quedan en parte tapados por la cabeza o el pelo.
- La franja de tripa del top corto es estrecha a propósito: el público del juego incluye menores.
- `Avatar3D.play('nombre')` en la consola del navegador lanza un gesto en los avatares animados; `Avatar3D.clips` da la lista.
- Sin pruebas automáticas del avatar: se ha comprobado a mano en el navegador. La única prueba que cambia es la de duelos (campo `body`).
