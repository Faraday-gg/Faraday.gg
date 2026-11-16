# 0079. Pase de batalla: una temporada con pista gratuita y pista prémium, incluida en la suscripción

- **Estado:** propuesta (código en la rama `feat/pase-de-batalla`; **sin migración**: no cambia el esquema)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0076](0076-suscripcion-sin-cobro.md) y la [0077](0077-cobro-con-stripe.md): la pista prémium va con la suscripción, sin cobro aparte.
- **Cambia a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) y la 0076 en un punto: la suscripción **sí da faradios**, pocos y solo jugando (ver «Consecuencias»).

## Contexto

Luis pide un pase de batalla como los de Clash Royale o Fortnite: niveles, una serie de premios gratuitos y otra de pago que, al pagar, desbloquea de golpe todo lo que ya se había ganado. Tiene que venir «con el mismo pago» que ya existe (la suscripción con Stripe) y dar faradios, cosméticos de científicos, mejoras de experiencia y medallas. Y tiene que enganchar.

Lo que ya había y se aprovecha: la experiencia la lleva el servidor (0061), los cofres también (0063), el inventario de piezas (0062), el libro contable (0057) y quién tiene la suscripción (0076).

## Decisión

### Cómo funciona

- **Temporadas.** La primera es «Pioneros de la ciencia», del 16 de noviembre al 31 de diciembre de 2026 (fechas de Madrid). Fuera de temporada el pase no suma.
- **30 niveles.** Se empieza en el 1 y cada nivel pide **150 puntos de experiencia**. La experiencia del pase es la misma que ya se gana jugando: cada respuesta, reto, misión y duelo suma lo mismo al nivel de siempre y al pase. No hay nada nuevo que aprender.
- **Dos pistas.** La **gratuita** es para cualquiera con cuenta. La **prémium** va incluida en la suscripción: no se compra aparte.
- **Lo ganado no se pierde.** Los niveles se alcanzan jugando, con suscripción o sin ella. Quien se suscribe más tarde recoge de golpe todos los premios prémium de los niveles que ya tenía.
- **Sin cuenta** se ve la temporada entera y sus premios, pero no se avanza: el pase lo lleva el servidor.

### Premios

| | Pista gratuita | Pista prémium |
|---|---|---|
| Niveles con premio | 25 de 30 | los 30 |
| Faradios | 620 en total | 1.060 en total |
| Cofres | 6 (Chispa, Imán, Rayo, Dinamo) | 9 (Imán, Rayo, Dinamo, Tormenta) |
| Piezas exclusivas | 4 | 6 |
| Insignias | 3 | 2 |
| Impulsos de experiencia | 1 | 4 |

- **Piezas** (una para cada cuerpo, se dan las dos): Sudadera Curie, Camiseta Átomo, Gorro Tesla, Chándal Darwin, Gorra Newton, Camiseta Doble hélice, Plumas Hipatia, Sudadera π, Camiseta E = mc² y Universitaria Nobel. Cinco estampados nuevos en el avatar 3D: el átomo, el radio de Curie (Ra, 88), la doble hélice, π y E=mc². Son **para siempre**: no caducan con la suscripción ni con la temporada. No se compran, no salen en cofres, no llevan acabado y no se venden.
- **Insignias** (decisión 0035): Becario de laboratorio (nivel 10), Doctorado (20) y Premio Nobel (30) en la pista gratuita; Mecenas de la ciencia (15) y ¡Eureka! (25) en la prémium.
- **Impulso:** experiencia del pase ×2 durante 24 o 48 horas, desde que se recoge. Solo acelera el pase, no el nivel de siempre.
- **Con la suscripción**, además, un 20 % más de experiencia en el pase.

### Qué se ha hecho para que enganche

- **Premio en el primer minuto:** el nivel 1 ya da faradios gratis, y quien se suscribe estrena una pieza en el momento.
- **La siguiente meta siempre a la vista:** la entrada de la portada enseña el nivel, la barra y cuántos premios esperan; en la pantalla, lo que falta para el siguiente nivel.
- **La pista prémium se ve entera,** con candado, al lado de la gratuita. Los premios de niveles ya alcanzados dicen «Te espera», y el botón de suscribirse dice cuántos son.
- **Recoger gusta:** «Recoger todo», y los premios a pantalla completa.
- **Las piezas se prueban** en el avatar de la cabecera antes de ganarlas.
- **La temporada tiene fecha de fin** y la cuenta atrás está a la vista.

### Lo que no se hace, a propósito

Juegan menores (lo recuerda la 0035), así que hay límites:

- **No se compran niveles** con dinero ni con faradios. Solo se sube jugando.
- **Nada de lo recogido caduca.** Lo que quede sin recoger de una temporada se puede recoger en la siguiente.
- **No hay castigo por faltar un día.** El pase no mira rachas.
- **Los 30 niveles se alcanzan jugando solo el reto del día y sus misiones casi todos los días** (unos 75 puntos al día dan para el nivel 23 en 45 días; con algún duelo se llega al 30).

### Código

- `lib/pase.mjs` (nuevo): la temporada, la tabla de premios y las cuentas (`passLevel`, `passGain`, `passClaim`, `passView`). El avance se guarda en `player_progress.stats.pass`, que ya existía como JSON: **no hay migración**.
- `lib/comunidad.mjs`: cada experiencia ganada suma al pase (en `withStats`); acciones nuevas de `/api/progreso`, **`pase`** (cómo va; también sin cuenta) y **`pase-recoger`** (un premio o todos). Los faradios se apuntan en el libro con el motivo `pase` y el premio como referencia.
- `lib/catalogo.mjs`: `PASS_PIECES`, las piezas del pase de cada cuerpo.
- `dist/pase.js` y `dist/pase.css` (nuevos): la pantalla, el fondo ilustrado de la temporada (un SVG dentro del propio archivo) y la entrada de la portada. No tienen reglas: pintan lo que dice el servidor.
- `dist/avatar.js` (piezas con `pase`), `dist/avatar3d.js` (estampados), `dist/medals.js` (5 insignias y sus iconos), `dist/progress.js` (el armario las reconoce) y `dist/index.html`.
- `tests/pase.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)); `tests/medallas.test.mjs` cuenta ahora 16 insignias.

## Alternativas descartadas

- **Cobrar el pase aparte de la suscripción.** Luis pide el mismo pago. Además, dos productos de pago son dos precios que explicar y dos cobros que mantener.
- **Una moneda propia del pase.** Con la experiencia que ya existe no hay nada nuevo que entender ni que equilibrar.
- **Vender niveles.** Es pagar por saltarse el juego, y juegan menores.
- **Piezas del pase solo mientras dure la suscripción** (como las de suscriptor de la 0076). Son premios ganados jugando: quitarlas al dejar de pagar sería un castigo.
- **Copiar las reglas en el navegador** para que funcione sin cuenta. Habría dos versiones que mantener iguales y el avance se podría inventar.
- **Perder lo no recogido al acabar la temporada.** Es la presión que la 0035 dice que no queremos.

## Consecuencias

- **La suscripción ahora da faradios,** en contra de lo que decían la 0055 y la 0076 («sería comprar moneda con dinero»). Son 1.060 en seis semanas y hay que ganarlos jugando, nivel a nivel; el tope de lo que se gana jugando es de 400 al día. Conviene que Luis y Álvaro lo revisen con el simulador de economía (0056).
- **El pase mete faradios y cofres nuevos en la economía** también para quien no paga: 620 faradios y 6 cofres por temporada. No pasan por el tope diario (como los cofres y el premio por nivel).
- **No se puede probar el cobro desde el pase** hasta que haya cuenta de Stripe. Sin ella, el pase dice que la pista prémium todavía no se puede contratar.
- **Cada temporada necesita su tabla de premios, sus piezas y su fondo.** La segunda tiene que estar lista antes del 1 de enero de 2027, o el pase desaparece de la portada ese día.
- **El aviso de premios pendientes de la temporada anterior** está hecho, pero no se ha visto en el navegador porque solo hay una temporada (lo cubre la prueba de Node).
- **Las piezas del pase usan formas que ya existían** (sudadera, camiseta, gorro…) con colores y estampados nuevos. No hay formas 3D nuevas.
