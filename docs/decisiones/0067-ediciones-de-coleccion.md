# 0067. Ediciones de colección: piezas numeradas de tirada cerrada

- **Estado:** propuesta (código en la rama `feat/ediciones-de-coleccion`, montada sobre `feat/cifras-economia-nueva`; la migración `20261115171046_ediciones` está **aplicada el 15 de noviembre de 2026**)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la primera entrega de la fase 3 («escasez»).

## Contexto

La 0055 separa dos clases de artículo: el catálogo permanente, que no se vende entre jugadores, y los artículos de colección, numerados y de tirada cerrada, que son los únicos que entrarán al mercado. Hasta ahora no existía ninguno.

Además, el simulador ([0056](0056-cifras-de-la-economia-con-simulador.md), [0066](0066-cifras-de-la-economia-nueva.md)) dice que la moneda no tiene salida sin ellos: son el gasto principal de la economía nueva, unos 57.900 ≈ al año por jugador diario con una edición a la semana.

## Decisión

### Qué es una edición

- Una pieza del avatar con **un número fijo de unidades** (500 en las dos primeras), cada una con su **número de serie**: «n.º 17 de 500».
- Se compra con faradios, **una por cuenta**, **desde el nivel 10**, con el correo de la cuenta comprobado y a partir de su día de salida.
- **No sale en cofres ni se vende en la tienda normal.** Cuando se agota, no hay más.
- Tiene una pieza para cada cuerpo; quien compra la edición tiene las dos.
- No hay relojes ni cuentas atrás en pantalla: una edición que aún no ha salido simplemente no se enseña.

### Las dos primeras

| N.º | Pieza | Unidades | Precio | Sale el |
|---|---|---|---|---|
| 1 | Sudadera Voltio | 500 | 1.200 ≈ | 15 de noviembre de 2026 |
| 2 | Universitaria Amperio | 500 | 1.200 ≈ | 22 de noviembre de 2026 |

**Son de muestra**: usan formas, colores y estampados que ya existían en el catálogo. Sirven para probar el sistema entero; las ediciones de verdad necesitan diseño propio (y ninguna puede llevar marcas reales, [0026](0026-marcas-reales-en-la-tienda.md)).

### Cómo se compra

1. En el armario, la pieza aparece con «Edición · 1.200 ≈». Al tocarla se prueba en el avatar y se ve cuántas quedan.
2. Al comprar, el servidor comprueba la cuenta, el nivel y que no la haya comprado ya; cobra; pide el siguiente número de serie y apunta la unidad.
3. El navegador enseña «¡tuya! N.º 17 de 500» y se la pone.

- **Dos compras a la vez nunca reciben el mismo número** ni se pasan de la tirada: el número lo da la base de datos en una sola sentencia (`edition_next`).
- **No se cobra dos veces:** el cobro lleva la edición como referencia en el libro.
- Si la edición se agota entre la comprobación y el cobro, se devuelve lo cobrado.

### Datos

- Las ediciones se definen en `dist/avatar.js` (`EDITIONS` y las piezas con `edition`), como el resto del catálogo. El servidor las lee de ahí (`lib/catalogo.mjs`). Sacar una edición nueva es añadir su entrada y su pieza.
- **Cada unidad es una fila** en la tabla `collectibles` (edición, número de serie, dueño y quién la compró al salir). Es lo que hará falta para venderla o intercambiarla.

### Código

- `dist/avatar.js`: `EDITIONS`, las piezas y que no se enseñen antes de salir. `lib/catalogo.mjs`: `EDITIONS`.
- `supabase/migrations/20261115171046_ediciones.sql`: `collectibles`, `edition_counters` y `edition_next`.
- `lib/comunidad.mjs`: acciones `ediciones` y `comprar-edicion`; `inventario` devuelve también las unidades. `lib/stores.mjs`: lo mismo contra Supabase.
- `dist/progress.js`: la pieza en el armario, la compra y el número de serie.
- `tests/ediciones.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Definir las ediciones en la base de datos.** Permitiría sacarlas sin desplegar, pero la pieza hay que dibujarla en el catálogo igualmente, y así entran por PR como el resto del contenido.
- **Una pantalla aparte para las ediciones.** Más vistosa, pero hoy son dos piezas: en el armario se ven junto al resto y se prueban igual. Se puede hacer cuando haya más.
- **Guardar solo un contador por jugador** («tiene la edición 1»). No permite venderla ni saber qué número tiene cada uno.
- **Dejarlas salir en cofres.** La tirada dejaría de depender de una compra y el número de unidades sería imprevisible.
- **Venderlas también sin cuenta.** Sin cuenta no hay servidor que numere, y el mercado va a exigir cuenta.

## Consecuencias

- **La migración** `20261115171046_ediciones` **está aplicada** desde el 15 de noviembre de 2026 (el archivo se renombró con la versión que registró Supabase).
- **Es un compromiso de contenido.** El simulador cuenta con una edición a la semana; con dos piezas de muestra el efecto en la economía es pequeño.
- **Con pocos jugadores no se agotará ninguna.** 500 unidades es mucho hoy; la tirada de cada edición se elige al definirla.
- **«Una por cuenta» no es «una por persona»**, como ya recogía la 0055.
- **El nivel 10 lo dice ahora el servidor**, que lleva la experiencia desde la [0061](0061-experiencia-y-misiones-en-el-servidor.md).
- **Lo que lleva puesto un jugador no se comprueba al enseñarlo a otros** (duelos, ligas): con el navegador manipulado, alguien podría aparecer con una edición que no tiene. No la tiene en el servidor ni podrá venderla. Queda apuntado en [mejoras](../mejoras/README.md).
- Quedan de la fase 3: las colecciones de temporada, los acabados y la fundición.
