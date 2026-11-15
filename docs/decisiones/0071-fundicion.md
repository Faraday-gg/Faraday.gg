# 0071. Fundición: reciclar piezas y fundir cinco por una mejor

- **Estado:** propuesta (código en la rama `feat/fundicion`; no necesita migración)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la segunda entrega de la fase 3 («escasez»), después de las ediciones de colección ([0067](0067-ediciones-de-coleccion.md)).

## Contexto

La 0055 pide una fundición: «quemar 5 artículos para obtener 1 de la rareza siguiente, o reciclarlos por un 20 % de su precio de emisión», para que cualquier pieza tenga un valor mínimo. Hasta ahora una pieza que no gustaba se quedaba en el armario para siempre, y quien abría muchos cofres acumulaba comunes sin uso.

## Decisión

### Qué se puede fundir

- Las piezas del catálogo que se compra: las que salen de la tienda y de los cofres.
- **No** las de nivel, las de «Casi casi», las del Circuito ni las ediciones de colección.
- **No** las que se llevan puestas (tampoco las del último conjunto guardado del otro cuerpo).

### Reciclar

- Destruye las piezas elegidas (hasta 30 de una vez) y devuelve el **20 % del precio** de cada una, redondeado.
- Ejemplos: una común de 60 ≈ devuelve 12; una rara de 260, 52; una legendaria de 1.400, 280.

### Fundir

- Destruye **5 piezas de la misma rareza** y da **una pieza al azar de la rareza siguiente** que el jugador no tenga, de su cuerpo.
- Las legendarias no se funden: no hay rareza siguiente.
- Si ya se tienen todas las de la rareza siguiente, no se puede fundir (y no se pierde nada).
- No cuesta faradios.

### Lo que pasa con las piezas destruidas

Salen del armario y vuelven a ser piezas «por conseguir»: se pueden comprar otra vez y pueden volver a salir en cofres.

### Dónde está

En la pestaña **Cofres** del perfil, debajo de los cofres: un recuadro «Fundición» que abre la lista de piezas. Se eligen tocándolas; abajo quedan los dos botones («Reciclar · +64 ≈» y «Fundir 5 → 1 especial»). El primer toque pide confirmar.

### Con cuenta y sin cuenta

- **Con cuenta** lo hace el servidor: acciones `reciclar` y `fundir` de `POST /api/progreso`. Comprueba que las piezas son del jugador, las quita del inventario y después paga (motivo `reciclaje`) o sortea y apunta la pieza nueva (origen `fundicion`).
- **Sin cuenta** lo hace el navegador con su armario y su saldo, como el resto de la economía sin cuenta.

### Código

- `lib/catalogo.mjs`: `FOUNDRY`, `RARITY_ORDER` y `recycleValue`.
- `lib/comunidad.mjs`: las dos acciones y `removeItems` en el almacén en memoria. `lib/stores.mjs`: `removeItems` contra Supabase (un `DELETE` en `items` que devuelve lo quitado).
- `dist/progress.js` y `dist/styles.css`: la pantalla.
- `tests/fundicion.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).
- Datos: no hay migración.

## Alternativas descartadas

- **Incluir las ediciones de colección.** La 0055 dice que la fundición da un valor mínimo «a todo», pero destruir una unidad numerada es irreversible y cambia la tirada. Se decide cuando exista el mercado.
- **Que la pieza destruida no pueda volver a salir.** Dejaría el catálogo incompleto para siempre a quien recicla, y obligaría a guardar una lista de piezas vetadas por jugador.
- **Elegir la pieza que sale al fundir.** Sería una tienda con otro precio; el azar es lo que la distingue.
- **Una pestaña propia en el perfil.** Ya hay cuatro y en el móvil no cabe otra.
- **Contar el reciclaje en el tope diario de ganancias.** El tope es para lo que se gana jugando; reciclar exige destruir algo que costó cinco veces más.

## Consecuencias

- **El reciclaje emite faradios**, pero siempre menos de lo que costó la pieza: comprar y reciclar pierde el 80 %. Comprar cofres para reciclar lo que traen también sale a pérdida.
- **Hay un efecto pequeño con los cofres:** una pieza reciclada vuelve a poder salir, y reciclarla da algo más que el lote que el cofre daría en su lugar (por ejemplo, 280 ≈ por una legendaria de 1.400 frente a un lote de 200). Solo afecta a quien ya tiene una rareza entera y está limitado por los cofres que consigue. El simulador no lo modela todavía; queda en [mejoras](../mejoras/README.md).
- **Las medallas que cuentan piezas** (por ejemplo «Fondo de armario») miran las que se tienen ahora: reciclar puede dejar una medalla ya conseguida por encima de lo que se tiene, pero no se pierde.
- **El servidor no comprueba si la pieza está puesta**: lo impide la pantalla. Con el navegador manipulado se puede fundir una pieza puesta y seguir llevándola; es el mismo hueco ya apuntado en mejoras (el servidor no verifica lo que lleva el avatar).
- Quedan de la fase 3: las colecciones de temporada y los acabados. Las dos necesitan piezas nuevas dibujadas.
