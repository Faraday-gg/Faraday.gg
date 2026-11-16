# 0074. Mercado con pantalla propia, subastas con pujas e indicadores

- **Estado:** propuesta (código en la rama `feat/mercado`, montada sobre `feat/acabados`; la migración `20261116003548_mercado` está **aplicada** desde el 2026-11-16)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0073](0073-mercado-de-ediciones.md), del mismo día y en la misma rama. Lo que no se cambia aquí sigue como en la 0073 (qué se vende, comisión, tope de anuncios, quién puede vender).
- **Cambia de la [0055](0055-tokenomics-suscripcion-y-mercado.md):** añade subastas (la 0055 solo preveía anuncios a precio fijo y dejaba las órdenes de compra para la fase 6) y enseña el tiempo que le queda a cada subasta (la 0055 pedía no poner relojes en pantalla).

## Contexto

Luis probó la primera versión del mercado (0073) y pidió tres cosas:

1. **No se encontraba.** Era un recuadro al final de la pestaña Armario del perfil.
2. **No se sabía qué artículos se pueden comerciar.**
3. **Era demasiado básico:** casi sin indicadores ni información. Pidió tomar como referencia los mercados de FIFA Ultimate Team, Roblox y Steam, y añadir las pujas.

## Decisión

### Dónde está

- **Pantalla propia**, a pantalla completa, como el perfil o los duelos.
- Se entra desde la **portada** (botón «Mercado» junto a los duelos y las ligas), desde el **menú** y desde el **armario** (un recuadro arriba del todo).
- Al probarse una edición en el armario hay un botón «Ver en el mercado» que abre su ficha.

### Qué se puede comerciar

- Solo los **artículos de colección** (las ediciones numeradas), como en la 0073.
- En el armario llevan la etiqueta verde **«Comerciable»**. En el mercado, cada artículo la lleva también, y hay una nota que lo explica en la primera pestaña.

### Dos formas de vender, que se pueden combinar

| Forma | Cómo funciona |
|---|---|
| **Compra ya** | Precio fijo. Quien lo paga se la lleva al momento. Sin límite de tiempo. |
| **Subasta** | Puja de salida y duración (1 h, 6 h, 12 h, 1 día o 3 días). Se la lleva quien más haya pujado al acabar. |
| **Las dos** | Subasta con un precio de compra ya, que tiene que ser mayor que la puja de salida. |

### Las pujas

- **La puja mínima** es la de salida y, después, un **5 % más** que la puja actual (al menos 1 ≈).
- **Los faradios de la puja quedan retenidos.** Si alguien puja más, se devuelven enteros en el momento y el jugador recibe un aviso.
- Quien va ganando no puede volver a pujar en la misma subasta.
- Una puja que llega al precio de compra ya, compra.
- **Pujar en el último minuto alarga la subasta** hasta que quede un minuto, para que no gane quien puja en el último segundo.
- **Con pujas, el vendedor ya no puede retirar el anuncio.**
- Al acabar: con pujas, la unidad pasa al ganador y el vendedor recibe la puja menos el 10 %, que se destruye. Sin pujas, el anuncio caduca y la unidad vuelve al armario.
- Las subastas terminadas **se cierran solas la próxima vez que alguien abre el mercado**. Hasta entonces la unidad sigue en depósito.

### Lo que enseña

- **Arriba, del mercado entero:** anuncios activos y cuántos son subastas, ventas de las últimas 24 h, volumen de 7 días y comisión destruida en 7 días.
- **Explorar:** los artículos en tarjetas (precio más bajo, cuántos en venta, última venta con su variación y una gráfica pequeña) y todos los anuncios, con buscador, filtro (todo, compra ya, subastas) y orden (más baratos, más caros, terminan antes, con más pujas, más recientes).
- **Ficha de un artículo:** nueve indicadores (precio más bajo, puja más alta, última venta y variación, precio medio de 7 días, ventas y volumen de 7 días, en venta, máximo y mínimo históricos, dueños y unidades sin emitir), la gráfica del historial de precios, los anuncios, el formulario para vender y las últimas ventas con su número de serie.
- **Mis anuncios:** los activos, los artículos que se pueden vender y el historial (vendido, caducado, retirado).
- **Mis pujas:** las que están en marcha, con «Vas ganando» o «Te han superado».
- **Actividad:** las últimas ventas de todo el mercado.
- **Avisos**, una vez cada uno: has vendido, has ganado una subasta, te han superado una puja, tu subasta caducó.

Pujar y comprar ya piden confirmar en un cuadro que dice lo que cuesta y lo que quedará de saldo.

### Datos

- `listings` cambia: precio de compra ya (`buy_now`), puja de salida (`start_bid`), puja más alta y de quién, número de pujas, final de la subasta, precio final y cómo se vendió.
- Tabla nueva `bids`: una fila por puja.
- Funciones de la base de datos: `market_list`, `market_cancel`, `market_buy`, `market_bid`, `market_settle`, `market_owners` y `market_pay` (interna).
- En el libro contable, además de `mercado-compra` y `mercado-venta`: `mercado-puja` (los faradios retenidos) y `mercado-puja-devuelta`. Quien gana una subasta no tiene otro apunte: ya pagó con la puja.
- Los indicadores se calculan en el servidor (`marketStats`, en `lib/mercado.mjs`) con las últimas 300 ventas.

### Código

- `lib/mercado.mjs`: reglas, indicadores, el mercado del almacén en memoria y las acciones `mercado`, `vender`, `retirar`, `comprar-anuncio` y `pujar` de `POST /api/progreso`. `lib/stores.mjs`: lo mismo contra Supabase. `lib/comunidad.mjs` solo lo conecta.
- `dist/market.js` y `dist/market.css` (nuevos): la pantalla. `dist/index.html`: la pantalla y las entradas. `dist/progress.js`: el recuadro del armario, la etiqueta «Comerciable» y lo que usa `market.js` (`Progress.cloud`, `Progress.ask` y `Progress.syncItems`).
- `tests/mercado.test.mjs`.

## Alternativas descartadas

- **Copiar el aspecto de FIFA, Roblox o Steam.** Se toman sus funciones (subastas con compra ya, ficha con indicadores y gráfica, historial de ventas), con el diseño de Faraday.
- **Órdenes de compra** («pago hasta X por cualquier unidad»), como en Steam. Luis pidió pujas; las órdenes de compra siguen previstas para la fase 6.
- **Devolver la puja al acabar la subasta en vez de al ser superada.** Dejaría faradios retenidos sin motivo.
- **Cerrar las subastas con una tarea programada.** Haría falta un servicio más; cerrarlas al abrir el mercado es exacto en las cuentas (nadie puede pujar ni comprar pasada la hora) y solo retrasa el aviso. Queda en [mejoras](../mejoras/README.md).
- **Subastas sin alargar en el último minuto.** Premian a quien puja en el último segundo con un programa.
- **Dejar el mercado dentro del perfil.** Es lo que Luis no encontraba.

## Consecuencias

- **La migración está aplicada** desde el 16 de noviembre (Luis lo confirmó). Como la primera versión, la de la 0073, no llegó a aplicarse, es un solo archivo con el esquema completo.
- **Hay relojes en pantalla** («termina en 2 h 4 min»), solo en las subastas. Es un cambio respecto a la 0055, que los evitaba en ediciones y temporadas para no meter prisa.
- **Los faradios retenidos en pujas no están en ningún saldo** mientras dura la subasta: el total de saldos baja al pujar y sube al devolverse o al cobrarlos el vendedor. Para cuadrar la economía hay que contar los apuntes `mercado-puja`.
- **Pujar permite pasar faradios entre cuentas** igual que comprar, perdiendo el 10 %.
- **El tablón entero y las últimas 300 ventas viajan en una respuesta**, y los indicadores salen de esas ventas. Vale para empezar; con mucho movimiento habrá que calcularlos en la base de datos.
- **Con dos ediciones de muestra el mercado empieza casi vacío.** Los indicadores y la gráfica no tendrán datos hasta que haya ventas.
- Quedan de la fase 4: los intercambios privados y decidir si los acabados se venden.
