# 0078. Órdenes de compra, «vender ya» y lista de deseos

- **Estado:** propuesta (código en la rama `feat/ordenes-de-compra`; la migración `20261116101427_ordenes_y_deseos` está **aplicada** desde el 2026-11-16)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la primera entrega de la fase 6 («mercado, segunda versión»), sobre el mercado de las [0073](0073-mercado-de-ediciones.md) y [0074](0074-mercado-con-pujas-e-indicadores.md).

## Contexto

La fase 6 de la 0055 pide tres cosas: órdenes de compra, lista de deseos y vitrina de colecciones. Hasta ahora, para comprar hacía falta que alguien tuviera un anuncio puesto en ese momento. Con pocos jugadores, comprador y vendedor casi nunca coinciden.

## Decisión

### Órdenes de compra

- Una orden dice: **«pago hasta X ≈ por cualquier unidad de este artículo»**. No elige número de serie.
- **Los faradios quedan retenidos** mientras la orden está abierta, y vuelven enteros si se cancela.
- **Si ya hay un anuncio con «compra ya» a ese precio o menos**, no se abre orden: se compra el más barato al momento, al precio del anuncio.
- Cada cuenta puede tener **5 órdenes abiertas**. No caducan; se cancelan cuando se quiera.
- Solo pide tener cuenta, como comprar.
- En la ficha de cada artículo se ven los **niveles de precio** (a cuánto hay órdenes y cuántas a cada precio), sin decir de quién son.

### Vender ya

- Quien tiene una unidad y ve una orden de compra de otro jugador puede **venderla al momento** a ese precio, sin poner anuncio: «Vender ya por 1.500 ≈».
- Se cumple la **orden más alta**; si hay varias al mismo precio, la más antigua.
- El vendedor cobra el precio menos el **10 %**, que se destruye. Los requisitos son los de vender: correo comprobado y nivel 10.
- No se puede vender ya una unidad que está anunciada: antes hay que retirar el anuncio.
- Nadie se vende a sí mismo: las órdenes propias no cuentan.
- La venta queda en el historial y en los indicadores como una más, marcada «orden». Quien puso la orden recibe el aviso «Se ha cumplido tu orden de compra».

### Lista de deseos

- En la ficha de cada artículo hay un botón **«Añadir a deseados»**.
- En «Explorar», el filtro **«♥ Deseados»** deja solo esos artículos y sus anuncios.
- Cada artículo enseña **en cuántas listas de deseos está**: es una medida del interés que hay por él.
- No avisa cuando aparece un anuncio; para eso está la orden de compra.

### Dónde se ve

- Ficha del artículo: dos indicadores nuevos («Orden más alta» y «La quieren»), el panel «Órdenes de compra» y, en «Vender», el aviso de vender ya.
- La pestaña «Mis pujas» pasa a llamarse **«Pujas y órdenes»** y lista también las órdenes propias.

### Datos

- Tablas nuevas `buy_orders` y `wishlist`. Funciones `market_order`, `market_order_cancel`, `market_sell_now` y `wishlist_counts`.
- `listings.sold_by` acepta ahora `orden`: una venta por orden se apunta en `listings` como vendida, para el historial.
- En el libro contable: `mercado-orden` (los faradios retenidos, referencia = la orden), `mercado-orden-devuelta` y `mercado-venta` con la referencia `orden-<n.º>`.

### Código

- `lib/mercado.mjs`: las órdenes y los deseos en el almacén en memoria, los indicadores y las acciones `ordenar`, `cancelar-orden`, `vender-ya` y `desear` de `POST /api/progreso`. `lib/stores.mjs`: lo mismo contra Supabase.
- `dist/market.js` y `dist/market.css`: la pantalla.
- `supabase/migrations/20261116101427_ordenes_y_deseos.sql` y `tests/ordenes.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Cumplir las órdenes sola al poner un anuncio.** El vendedor podría querer esperar a un precio mejor; con «vender ya» decide él.
- **Órdenes por un número de serie concreto.** Casi nunca se cumplirían. Para una unidad concreta están los anuncios y las pujas.
- **Órdenes que caducan.** Obligaría a otro cierre automático; los faradios retenidos ya son motivo para cancelarlas.
- **Avisos de la lista de deseos.** Hoy no hay forma de avisar fuera del juego, y dentro ya está la orden de compra.
- **Enseñar quién ha puesto cada orden.** Como en los anuncios, no hace falta para operar.
- **La vitrina de colecciones en esta entrega.** Es otra pantalla (lo que tiene cada jugador, a la vista de los demás); va aparte.

## Consecuencias

- **La migración está aplicada** desde el 16 de noviembre (Luis lo confirmó).
- **Más faradios retenidos fuera de los saldos:** a los de las pujas se suman los de las órdenes abiertas. Para cuadrar la economía hay que contar `mercado-orden`.
- **Las órdenes dan un precio de referencia aunque no haya anuncios**, y dejan vender al momento: es lo que más ayuda a un mercado con pocos jugadores.
- **«Vender ya» también sirve para pasar faradios entre cuentas** (orden alta desde una, venta desde otra), perdiendo el 10 %, como comprar y pujar.
- **El tope de 5 órdenes es para todas las cuentas**, también con suscripción.
- Queda de la fase 6 la **vitrina de colecciones**.
