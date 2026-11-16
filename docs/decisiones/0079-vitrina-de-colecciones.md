# 0079. Vitrina de colecciones

- **Estado:** propuesta (código en la rama `feat/vitrina`; la migración `20261116102311_vitrinas` está **aplicada** desde el 2026-11-16)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la segunda y última entrega de la fase 6, después de las órdenes de compra ([0078](0078-ordenes-de-compra-y-lista-de-deseos.md)).

## Contexto

Los artículos de colección y las piezas con acabado son escasos, pero hasta ahora solo los veía su dueño (y quien se cruzara con él en un duelo, si llevaba la pieza puesta). La 0055 pide una «vitrina de colecciones»: un sitio donde enseñar lo que se tiene. Es lo que da sentido a coleccionar.

## Decisión

### Qué es

- Cada jugador con cuenta tiene una **vitrina** con:
  - sus **artículos de colección**, cada uno con su número de serie (también los que tiene anunciados, marcados «en venta»);
  - sus **piezas con acabado** (cromado, holográfico, dorado);
  - un resumen: cuántos artículos, de cuántas ediciones de las que han salido y cuántas piezas con acabado.
- **No enseña** el saldo, el resto del armario ni nada de la cuenta.

### Quién la ve

- **Por defecto, solo su dueño.** Para que la vean los demás hay que pulsar «Enseñar mi vitrina».
- Al enseñarla recibe un **enlace** para compartir. El enlace lleva un código al azar, no la cuenta.
- Se presenta con el nombre y el avatar que el jugador lleva en ese momento.
- Se puede **dejar de enseñar** cuando se quiera; el enlace se conserva por si se vuelve a enseñar.
- Para ver la vitrina de otro hace falta tener cuenta, como para el resto del mercado.

### Coleccionistas

- Una lista con los **20 jugadores** que enseñan su vitrina y más artículos de colección tienen. Al tocar uno se abre su vitrina.
- Solo salen quienes la enseñan y tienen al menos un artículo.

### Dónde está

En el mercado, pestaña **«Vitrinas»**: la propia arriba y la lista de coleccionistas debajo. Desde una vitrina, tocar un artículo abre su ficha en el mercado.

### Datos

- Tabla nueva `showcases`: si se enseña, el código del enlace, el nombre y el avatar. **Lo que contiene no se guarda**: se lee cada vez de `collectibles` y de `items`, así siempre está al día.
- Función `showcase_ranking` para la lista de coleccionistas.

### Código

- `lib/vitrina.mjs` (nuevo): las vitrinas del almacén en memoria y las acciones `vitrina`, `vitrina-publicar` y `coleccionistas` de `POST /api/progreso`. `lib/stores.mjs`: lo mismo contra Supabase. `lib/comunidad.mjs` solo lo conecta.
- `dist/market.js` y `dist/market.css`: la pestaña, la vitrina de otro jugador y el enlace `?vitrina=CÓDIGO`.
- `supabase/migrations/20261116102311_vitrinas.sql` y `tests/vitrina.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Que todas las vitrinas se vean por defecto.** Enseñar lo que alguien tiene sin que lo haya pedido no es una decisión que deba tomar el juego por él. Con el botón, la lista de coleccionistas empieza vacía, pero quien sale en ella ha querido salir.
- **Enlace con el nombre de usuario o el identificador de la cuenta.** El código al azar no dice nada de la cuenta y se puede cambiar el día que haga falta.
- **Guardar una copia de lo que hay en la vitrina.** Se quedaría vieja en cuanto se vende o se intercambia algo.
- **Enseñar todo el armario.** Lo que todo el mundo puede comprar en la tienda no es una colección.
- **Ordenar a los coleccionistas por el valor de lo que tienen.** Con pocas ventas, el «valor» sería casi inventado; el número de artículos no engaña.
- **Una pantalla aparte del mercado.** Las vitrinas llevan a las fichas de los artículos y están hechas de lo mismo.

## Consecuencias

- **La migración está aplicada** desde el 16 de noviembre (Luis lo confirmó).
- **Quien enseña su vitrina deja ver qué artículos tiene y cuáles vende**, y con eso otros jugadores pueden ofrecerle un intercambio por fuera del juego. Es lo que se busca.
- **El nombre de la vitrina es el del momento de enseñarla.** Si el jugador se cambia el nombre o el avatar, tiene que volver a pulsar el botón para que se actualice (apuntado en [mejoras](../mejoras/README.md)).
- **El servidor no comprueba lo que lleva puesto el avatar** con el que se presenta la vitrina, como en los duelos: es el mismo hueco ya apuntado en mejoras.
- **Con esto, el plan de la 0055 queda programado entero** (fases 0 a 6), salvo la colección de temporada, que depende de diseñar piezas.
