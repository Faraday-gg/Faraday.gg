# 0076. La suscripción, sin el cobro: plan, tope de duelos y ventajas

- **Estado:** propuesta (código en la rama `feat/suscripcion`; la migración `20261116150000_suscripciones` está **sin aplicar**)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Sigue en:** la [0077](0077-cobro-con-stripe.md), el cobro con Stripe. La tabla `subscriptions` gana allí la columna `customer`.
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la primera entrega de la fase 5.

## Contexto

La 0055 define dos planes. El gratuito tiene el reto del día y el archivo sin límite, **5 duelos al día**, publicidad y 3 anuncios activos en el mercado. La suscripción da duelos ilimitados, quita la publicidad, deja anunciar sin tope y da cosméticos que solo se pueden llevar mientras se paga. No da faradios.

Para cobrar hace falta un proveedor de pagos, y elegirlo es una decisión de Luis que aún no está tomada (cuenta, precio, impuestos). Pero todo lo demás no depende de él.

## Decisión

Se hace **todo lo que da la suscripción, sin el cobro**. Quién la tiene es una fila en una tabla; cuando haya proveedor de pagos, su aviso de pago escribirá esa fila y no habrá que tocar nada más.

### Quién tiene la suscripción

- Tabla nueva `subscriptions`: un jugador y la fecha hasta la que vale. Está en vigor mientras esa fecha no haya pasado; al caducar no hay que borrar nada.
- **Hoy no se puede contratar.** Solo existe si alguien escribe la fila a mano en Supabase (para probar, o para regalarla).
- Va con la cuenta. Sin cuenta se juega siempre con el plan gratuito.

### Qué cambia con el plan gratuito

- **5 duelos al día** (día de Madrid), con cuenta o sin ella. Cuenta cada duelo que llega a empezar, también contra Faraday-bot y las revanchas; uno creado que nadie acepta no cuenta.
- El tope se mira al **empezar** un duelo (crear, buscar rival, entrar con código, revancha). El que ya está en marcha se termina.
- Al llegar al tope, el juego dice: «Hoy ya has jugado tus 5 duelos. Mañana tienes otros 5; con la suscripción son ilimitados».
- El reto del día y el archivo no cambian.

### Qué da la suscripción

| Ventaja | Cómo |
|---|---|
| Duelos sin límite | El tope no se aplica. |
| Sin publicidad | La pista que hoy pide ver un anuncio se da sin anuncio. |
| Anuncios sin tope en el mercado | En vez de 3 activos. Si la suscripción caduca, los que ya estaban puestos siguen, pero no caben más. |
| Piezas de suscriptor | Piezas del armario que solo se pueden llevar con la suscripción activa. Al caducar, el avatar vuelve a la pieza por defecto. |

- Las piezas de suscriptor no se compran, no salen en cofres, no llevan acabado y no se venden ni se intercambian.
- **Hay una de muestra** («Sudadera de suscriptor», una por cuerpo), con una forma y un estampado que ya existían. Las de verdad necesitan diseño.
- En el perfil hay un recuadro con el plan: «Plan gratuito» y lo que daría la suscripción, o «Suscripción activa hasta el…».

### Código

- `lib/suscripcion.mjs` (nuevo): `PLAN`, las suscripciones del almacén en memoria y `createPlan`. `lib/stores.mjs`: lo mismo contra Supabase, y `played` en el almacén de duelos.
- `lib/duelos.mjs`: el tope (`allowance`) y la acción `limite`, que dice cuántos duelos lleva hoy el jugador. `lib/api.mjs` lo conecta; `duelLimit: null` lo desactiva en las pruebas que juegan muchos duelos seguidos.
- `lib/mercado.mjs`: sin tope de anuncios con la suscripción. `lib/comunidad.mjs`: `estado` devuelve `plus`, `plusUntil` y `freeDuels`.
- `dist/avatar.js` (piezas con `plus`), `dist/progress.js` (el plan, el recuadro del perfil y `Progress.plus()`), `dist/ads.js`, `dist/market.js` y `dist/styles.css`.
- `supabase/migrations/20261116150000_suscripciones.sql` y `tests/suscripcion.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Esperar al proveedor de pagos para hacerlo todo junto.** El tope de duelos y las ventajas se pueden probar ya, y son la mayor parte del trabajo.
- **Guardar el plan en el progreso del jugador** (`player_progress`). Esa fila la escribe el navegador en parte; el plan tiene que estar donde solo escriba el servidor.
- **Contar los duelos solo a quien tiene cuenta.** Bastaría con no entrar para jugar sin tope.
- **Contar también los duelos que no llegan a empezar.** Castigaría a quien espera rival y no lo encuentra.
- **Que la suscripción dé faradios.** Sería comprar moneda con dinero (0055).
- **Quitar los anuncios puestos de más al caducar.** Sería retirar ventas en marcha por un impago.

## Consecuencias

- **Hace falta aplicar la migración** (con la confirmación de Luis). Sin ella nadie tiene suscripción y todo lo demás funciona; **el tope de 5 duelos se aplica igualmente**, porque no depende de esa tabla.
- **El tope de 5 duelos empieza a valer para todos en cuanto esto llegue a producción**, antes de que se pueda pagar por quitarlo. Conviene decidir si se activa ya o se espera al cobro; hoy no hay un interruptor en producción (apuntado en [mejoras](../mejoras/README.md)).
- **El tope se puede saltar borrando los datos del navegador** si se juega sin cuenta: es otro jugador nuevo. Es el mismo límite que tiene todo lo que se guarda sin cuenta.
- **La publicidad de hoy es simulada** (0039): quitarla no cambia ingresos todavía.
- **Falta lo que de verdad es la fase 5:** elegir proveedor de pagos, el precio, la pantalla de contratar y el aviso de pago que escribe en `subscriptions`. Y diseñar las piezas de suscriptor.
