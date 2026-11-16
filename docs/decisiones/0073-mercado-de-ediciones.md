# 0073. Mercado: anuncios a precio fijo de ediciones de colección

- **Estado:** propuesta (código en la rama `feat/mercado`, montada sobre `feat/acabados`; la migración `20261116130000_mercado` está **sin aplicar**)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Ampliada por:** la [0074](0074-mercado-con-pujas-e-indicadores.md), el mismo día: pantalla propia, subastas con pujas e indicadores. La pantalla y los datos que se describen aquí son los de la primera versión.
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la primera entrega de la fase 4 («mercado e intercambios»).

## Contexto

La 0055 define el mercado: un tablón de anuncios a precio fijo en el que el servidor hace de intermediario, con un 10 % de comisión destruida, precio libre, sin espera para revender y tres anuncios activos en el plan gratuito. Ya existe qué vender: las unidades numeradas de las ediciones de colección ([0067](0067-ediciones-de-coleccion.md)).

## Decisión

### Qué se vende

Solo las **unidades numeradas de las ediciones de colección**. El catálogo normal no entra (cualquiera lo compra en la tienda) y los acabados ([0072](0072-acabados.md)) tampoco todavía: no tienen número de serie.

### Reglas

| Regla | Valor |
|---|---|
| Comisión | 10 % de cada venta, redondeada hacia arriba, **destruida** |
| Precio | Libre, de 1 a 1.000.000 ≈, sin decimales |
| Espera para revender | Ninguna |
| Anuncios activos | 3 por cuenta (sin tope para suscriptores, cuando exista la suscripción) |
| Para vender | Cuenta con el correo comprobado y nivel 10 |
| Para comprar | Cuenta. Sin nivel mínimo |

### Cómo funciona

1. **Anunciar.** En el mercado, en «Tus unidades», se escribe un precio y se pulsa «Anunciar». La pantalla dice cuánto se recibiría tras la comisión. La unidad queda **en depósito**: sigue siendo del vendedor, pero sale de su armario y no puede llevarla puesta.
2. **Retirar.** El vendedor puede retirar el anuncio cuando quiera; la unidad vuelve a su armario.
3. **Comprar.** El tablón enseña cada edición con cuántas hay emitidas, cuántas en venta, la última venta, una gráfica de las últimas ventas y los anuncios del más barato al más caro con su número de serie. Comprar pide confirmar.
4. **La compra es una sola operación** que se cumple entera o no se hace: cobra al comprador, paga al vendedor el 90 %, destruye el 10 % y cambia el dueño de la unidad.
5. **Aviso al vendedor.** La próxima vez que entra ve «Has vendido Sudadera Voltio n.º 3 por 1.500 ≈: recibes 1.350 ≈». No hace falta que coincidan conectados.

- Nadie ve de quién es un anuncio; solo si es suyo.
- «Una por cuenta» vale para comprar la edición al salir. En el mercado se pueden comprar más unidades.

### Datos

- Tabla nueva `listings` (un anuncio: unidad, vendedor, precio, estado, comprador, comisión y si el vendedor ya vio el aviso).
- Tres funciones de la base de datos: `market_list`, `market_cancel` y `market_buy`. La compra bloquea el anuncio, los dos saldos y la unidad, así que dos compras a la vez no pueden llevarse la misma unidad ni dejar un saldo en negativo.
- En el libro contable: `mercado-compra` (lo que paga el comprador) y `mercado-venta` (lo que recibe el vendedor), con el anuncio como referencia. La comisión no se apunta a nadie: es la diferencia, y queda en `listings.fee`.

### Código

- `supabase/migrations/20261116130000_mercado.sql`.
- `lib/mercado.mjs`: las cifras y la comisión. `lib/comunidad.mjs`: acciones `mercado`, `vender`, `retirar` y `comprar-anuncio` de `POST /api/progreso`, y el mercado del almacén en memoria. `lib/stores.mjs`: lo mismo contra Supabase.
- `inventario` y `ediciones` ya no cuentan las unidades anunciadas como del armario.
- `dist/progress.js` y `dist/styles.css`: la pantalla, dentro de la pestaña Armario.
- `tests/mercado.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Subastas u órdenes de compra.** Más complejas; las órdenes de compra están previstas para la fase 6.
- **Mover la unidad a una cuenta «depósito» al anunciarla.** Obliga a devolverla al retirar y complica saber de quién es. Basta con que el servidor no la enseñe en el armario mientras tenga un anuncio activo.
- **Apuntar la comisión en el libro como un tercer movimiento.** El libro es por jugador y la comisión no es de nadie.
- **Enseñar quién vende.** No hace falta para comprar y evitaría que dos cuentas se busquen para pasarse faradios… aunque eso sigue siendo posible poniendo un precio raro; es el coste (un 10 %) de la decisión de Luis de dejar el mercado libre.
- **Nivel mínimo también para comprar.** La 0055 solo lo pide para vender.
- **Una pestaña propia en el perfil.** No cabe otra en el móvil; va dentro de Armario, como la fundición va dentro de Cofres.

## Consecuencias

- **Hace falta aplicar la migración** (con la confirmación de Luis). Sin ella, el armario sigue funcionando y el mercado dice que no está disponible.
- **El mercado permite pasar faradios entre cuentas** (anunciar algo a un precio alto y comprarlo desde otra cuenta), perdiendo el 10 %. Es coherente con la 0055: Luis aceptó las cuentas múltiples. Conviene vigilarlo en `ledger_daily` (`mercado-compra` y `mercado-venta`).
- **Con dos ediciones de muestra y casi ningún jugador de nivel 10, el mercado empieza vacío.** Necesita ediciones de verdad y jugadores.
- **El tablón entero viaja en una respuesta** (hasta 1.000 anuncios). Vale para empezar; con muchos anuncios habrá que paginar por edición.
- **El tope de 3 anuncios es para todas las cuentas** hasta que exista la suscripción (fase 5).
- Quedan de la fase 4: los intercambios privados (solo artículos, sin faradios) y decidir si los acabados se venden.
