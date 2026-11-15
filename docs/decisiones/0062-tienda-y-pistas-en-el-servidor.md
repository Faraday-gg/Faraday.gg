# 0062. El servidor cobra la tienda y las pistas, y empieza el inventario

- **Estado:** propuesta (código en la rama `feat/tienda-y-pistas-servidor`, montada sobre `feat/misiones-y-nivel-servidor`; la migración `20261115140000_inventario` está **sin aplicar**)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la primera parte de la entrega 4 de la fase 1 ([0061](0061-experiencia-y-misiones-en-el-servidor.md)), que aquí **se parte en dos**.

## Contexto

La entrega 4 juntaba cofres, tienda y pistas. La tienda y las pistas son un cobro sencillo; los cofres necesitan llevar al servidor cuándo se gana cada cofre (misiones, batería, nivel, racha, referidos) y el sorteo. Se separan.

Hasta ahora, al comprar, el navegador restaba el precio y lo declaraba. Con el navegador manipulado se podía comprar por menos, o apuntarse la pieza sin pagar.

## Decisión

- **Con cuenta, la compra la hace el servidor** (`POST /api/progreso`, `action: 'comprar'`): busca la pieza en su catálogo, cobra **su** precio y la apunta en el inventario. El navegador solo dice qué pieza quiere.
- **El catálogo del servidor es el del navegador.** `lib/catalogo.mjs` carga `dist/avatar.js` tal cual, sin copiar precios, así que no pueden desajustarse. En Vercel ese archivo viaja con la función (`vercel.json`, `includeFiles`). Solo se venden las piezas de pago: las de nivel, de «Casi casi» y del Circuito no.
- **Inventario:** tabla `items`, una fila por pieza y jugador, con de dónde salió. De momento solo entran las compradas con cuenta.
- **No se cobra dos veces la misma pieza:** el cobro lleva la pieza como referencia en el libro.
- **Las pistas** (`action: 'pista'`) cuestan 100 ≈ y se cobran una vez por pregunta, con la pregunta como referencia.
- **`action: 'inventario'`** devuelve las piezas del jugador.
- **El navegador ya no puede declarar los motivos `tienda` y `pistas`.**
- Sin cuenta, todo sigue igual.

### Las entregas de la fase 1

| Entrega | Estado |
|---|---|
| 1. Libro contable | Hecha (0057) |
| 2. Reto del día y archivo | Hecha (0058) |
| 3a. Duelos · 3b. Apuestas en bote · 3c. Misiones y nivel | Hechas (0059, 0060, 0061) |
| **4a. Tienda y pistas** | Esta |
| 4b. Cofres: cuándo se ganan, la compra, el sorteo y sus piezas al inventario; referidos | Pendiente |
| 5. Cierre: migrar saldos y piezas y dejar de aceptar ganancias declaradas | Pendiente |

Tras esta entrega, el navegador solo puede declarar: `bienvenida`, `cofres`, `cofres-compra`, `referidos` y `otros`.

### Código

- `lib/catalogo.mjs` (nuevo): `PIECES` y `HINT_COST`.
- `supabase/migrations/20261115140000_inventario.sql`: tabla `items`.
- `lib/comunidad.mjs`: acciones `comprar`, `pista` e `inventario`, y el inventario del almacén local. `lib/stores.mjs`: lo mismo contra Supabase.
- `vercel.json`: `dist/avatar.js` entre los archivos de la función.
- `dist/progress.js`: con cuenta, comprar pregunta al servidor; `Progress.pay` para las pistas; `serverAsk` reúne las llamadas que cambian el saldo. `dist/pistas.js`: espera la respuesta del servidor.
- `tests/tienda.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Copiar los precios al servidor.** Dos listas de casi 400 piezas se desajustan al primer cambio.
- **Una función de base de datos que cobre e inserte la pieza a la vez.** Más SQL sin poder probarlo. Con la pieza como referencia del cobro, si el apunte en el inventario falla, repetir la compra no vuelve a cobrar y termina de apuntarla.
- **Usar el libro como inventario.** Las piezas que salen de un cofre no mueven faradios y el libro no admite apuntes de cero.
- **Subir ya al inventario las piezas que el jugador tenía.** Es parte del cierre (entrega 5), junto con el saldo.
- **Hacer también los cofres.** Ver el contexto.

## Consecuencias

- **El armario sigue saliendo del navegador.** Lo que el jugador ve y se pone lo decide la lista de su navegador; el inventario del servidor solo registra las compras con cuenta. Hasta la entrega 5 se puede seguir añadiendo piezas a mano en el navegador; lo que ya no se puede es pagar menos o no pagar en una compra normal.
- **Comprar tarda uno o dos segundos**, lo que tarda la llamada; el botón se desactiva mientras tanto.
- **Sin conexión no se puede comprar ni usar pistas con cuenta.** Antes sí, y se sincronizaba después.
- **Depende de que `dist/avatar.js` esté en la función de Vercel.** Si falta, comprar responde «no disponible» y el resto sigue.
- **Cuatro migraciones pendientes, en orden:** `20261114120000_preguntas_comunidad`, `20261115120000_libro_contable`, `20261115130000_experiencia_y_misiones` y `20261115140000_inventario`. Ninguna se ha ejecutado contra un Postgres real.
- Hay que aceptar antes la PR de la entrega 3c: esta rama parte de la suya.
