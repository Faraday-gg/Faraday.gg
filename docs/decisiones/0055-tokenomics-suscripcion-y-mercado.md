# 0055. Economía de faradios, suscripción y mercado de artículos entre jugadores

- **Estado:** aceptada (solo el diseño y el plan por fases; **no hay código, migraciones ni pagos** en esta PR)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code. Álvaro no ha participado: conviene que la confirme al revisar la PR.
- **Cambia a:**
  - la [0024](0024-avatar-faradios-y-misiones.md): habrá ingresos por suscripción y artículos de tirada cerrada con calendario; el progreso y las compras pasan al servidor;
  - la [0027](0027-cofres.md) y la [0036](0036-seis-cofres.md): menos cofres gratis al día y sorteo en el servidor;
  - la [0038](0038-circuito-de-amigos.md): los premios de referidos quedan vinculados a la cuenta;
  - la [0044](0044-apuestas-en-duelos.md): las apuestas dejan de ser contra la banca;
  - la [0052](0052-preguntas-de-la-comunidad.md): el servidor deja de aceptar ganancias declaradas por el navegador.
- **Recoge** las ideas [ajustes-economia-faradios.md](../ideas/ajustes-economia-faradios.md) y [monetizacion-cosmeticos.md](../ideas/monetizacion-cosmeticos.md), que siguen abiertas para el detalle.

## Contexto

Luis quiere un mercado donde los jugadores se vendan artículos entre sí, como el de Roblox o el de la comunidad de Steam, y antes ordenar la economía para que el faradio cueste conseguirlo y sirva para algo. Al revisar las decisiones y el código salió esto (las cifras diarias son estimaciones a partir de las tablas de la 0024, la 0027 y la 0036):

- **La moneda pesa poco frente a los cofres.** Un jugador diario gana unos 150 ≈ directos y recibe unos 475 ≈ en valor de cofres gratis (dos Chispa al día y el Rayo semanal): tres cuartas partes de lo que recibe no pasan por su monedero.
- **El catálogo se agota en unos 100 días.** Cada cuerpo ve unos 65.000 ≈ en piezas y el jugador recibe unos 625 ≈ de valor al día. Después solo quedan pistas y votos donde gastar.
- **Las apuestas emiten moneda.** Cada jugador apuesta contra la banca: dos cuentas propias pueden fabricar 750 ≈ al día dejando ganar siempre a la misma.
- **El servidor se fía del navegador.** Acepta hasta 1.500 ≈ de ganancia diaria declarada por cada cuenta, y las piezas compradas van en un JSON que escribe el cliente. Con un mercado, cada cuenta falsa fabricaría moneda y artículos.
- **No hay escasez.** Todas las piezas tienen existencias infinitas a precio fijo; la rareza es solo un tramo de precio. Venderlas entre jugadores no tiene sentido.
- **Los premios de referidos** (un cofre Rayo por amigo) serían vendibles.

## Decisión

### Principios

| Tema | Decisión |
|---|---|
| Moneda | Un solo faradio. Lo lleva el servidor en un libro contable: cada movimiento tiene origen y destino. **No se compra ni se retira con dinero.** |
| Ganancias | Las calcula el servidor a partir de lo que ya conoce (respuestas, duelos, referidos, preguntas de la comunidad). El navegador no declara ganancias. |
| Tope diario de faradios ganados | El mismo para todos, paguen o no. |
| Dos clases de artículo | **Catálogo permanente:** vinculado a la cuenta, no se vende ni se intercambia. **Artículos de colección:** numerados y de tirada cerrada; son los únicos que entran al mercado. |
| Marcas reales | Las piezas de la [0026](0026-marcas-reales-en-la-tienda.md) nunca son de colección y **se retiran antes de cobrar la suscripción**. |
| Cuenta | Obligatoria para el mercado, los intercambios y los artículos de colección. Sin cuenta se sigue jugando como hoy. |
| Varias cuentas por persona | Permitidas. Luis lo prefiere: más jugadores, más anuncios y más actividad. |
| Equilibrio | Cada fuente de faradios tiene un sitio donde gastarlos. Objetivo: que el gasto absorba entre el 80 y el 95 % de lo emitido, comprobado con un simulador. |

### Suscripción

| | Plan gratuito | Suscriptor |
|---|---|---|
| Reto del día | Sin límite | Sin límite |
| Archivo | Sin límite | Sin límite |
| Duelos | **5 al día** | Ilimitados |
| Anuncios | Sí | No |
| Cosméticos de suscriptor | No | Sí, mientras pague |
| Anuncios activos en el mercado | **3** | Sin límite |
| Faradios ganados al día | Mismo tope | Mismo tope |

- Los cosméticos de suscriptor no se venden ni se intercambian, y dejan de poder llevarse al dejar de pagar.
- La suscripción no da faradios. Si los diera, sería comprar moneda con dinero y habría que retirar los cofres comprables y las apuestas (0027 y 0044).

### De dónde sale la escasez

| Fuente | Cómo funciona |
|---|---|
| Ediciones numeradas | Tirada fija (por ejemplo 500), una por cuenta, con número de serie visible (n.º 17 de 500). Comprarla exige cuenta verificada y nivel 10. |
| Colecciones de temporada | Unas 20 piezas por temporada. Al acabar se retiran y solo se consiguen en el mercado. |
| Acabados | Versiones cromada, holográfica o dorada de piezas que ya existen, con poca probabilidad en cofres. |
| Mérito | Piezas numeradas para ganadores de clasificatorias y ligas y para los autores de la pregunta del lunes. |
| Fundición | Quemar 5 artículos para obtener 1 de la rareza siguiente, o reciclarlos por un 20 % de su precio de emisión. Da un valor mínimo a todo. |

Las ediciones y las temporadas tienen fecha. Se hacen con calendario anunciado y **sin relojes en pantalla**; lo retirado sigue disponible en el mercado.

### El mercado

Un tablón de anuncios a precio fijo en el que el servidor hace de intermediario:

1. El vendedor pulsa «Vender» en su armario y escribe un precio. El artículo sale del armario y queda en depósito; no puede llevarlo puesto mientras está anunciado y puede retirar el anuncio cuando quiera.
2. El comprador ve la ficha del artículo: cuántos existen, cuántos hay en venta, los anuncios de más barato a más caro con su número de serie, la gráfica de las últimas ventas y el avatar con la pieza puesta.
3. Al comprar, el servidor hace una sola operación que se cumple entera o no se hace: cobra al comprador, paga al vendedor el 90 %, **destruye el 10 % de comisión** y pasa el artículo al comprador.
4. El vendedor recibe un aviso la próxima vez que entra. No hace falta que coincidan conectados.

| Regla | Valor |
|---|---|
| Comisión | 10 % de cada venta, destruida |
| Precio | Libre |
| Espera para revender | Ninguna |
| Anuncios activos | 3 en el plan gratuito, sin límite para suscriptores |
| Para vender | Cuenta con correo verificado y nivel 10 |

### Intercambios privados

- Desde el primer día, entre dos cuentas cualesquiera, también del mismo dueño.
- **Solo mueven artículos de colección, nunca faradios.** Quien quiera cobrar en faradios vende en el mercado; así la comisión sigue retirando moneda.
- Se hacen en una pantalla donde los dos ponen sus artículos, los dos ven lo que reciben y los dos confirman. El servidor lo ejecuta entero o no lo hace: nadie entrega primero.

### Cambios en la economía (valores de partida, a validar con el simulador)

| Qué | Hoy | Después |
|---|---|---|
| Peso de la moneda en lo que recibe el jugador | 25 % | Al menos 50 %: un cofre Chispa gratis al día en vez de dos |
| Apuestas | Contra la banca | Bote entre los dos jugadores, con un 10 % destruido |
| Premios de referidos y cofres ganados | Como cualquier pieza | Siempre vinculados |
| Gasto recurrente | Pistas y votos | Además protector de racha (150 ≈), repetir misión, ediciones, fundición y efectos de entrada en los duelos |

### Fases

| Fase | Contenido | Resultado |
|---|---|---|
| 0. Medir y simular | Medir emisión y gasto; simulador de tres perfiles de jugador a 180 días (`tests/economia.test.mjs`, como hoy se prueba el valor de los cofres) | Cifras validadas |
| 1. Economía en el servidor | Libro contable, inventario por unidad, premios y sorteo de cofres en el servidor, migración de saldos con tope | No se puede falsear saldo ni piezas |
| 2. Economía nueva | La tabla anterior | El faradio cuesta y sirve |
| 3. Escasez | Números de serie, ediciones, primera temporada, acabados y fundición, entre 4 y 6 semanas antes del mercado | Hay oferta repartida entre jugadores |
| 4. Mercado e intercambios | Anuncios, depósito, compra en una operación, historial de precios, intercambios privados | Mercado abierto |
| 5. Suscripción | Proveedor de pagos, límite de duelos, anuncios reales, cosméticos de suscriptor | Ingresos |
| 6. Mercado, segunda versión | Órdenes de compra, lista de deseos, vitrina de colecciones | Temporadas regulares |

La fase 5 no depende de la 3 ni de la 4 y se puede adelantar, siempre después de la 1.

## Alternativas descartadas

- **Vender faradios o dejar retirarlos por dinero.** Convertiría los cofres al azar y las apuestas en juego con dinero, con menores, y haría rentable el fraude.
- **Dos monedas** (una ganada y otra de pago). Más difícil de entender y no hace falta mientras el dinero entre solo por la suscripción.
- **Meter en el mercado el catálogo actual.** No hay escasez: cualquiera lo compra en la tienda.
- **Espera de 72 horas para revender, precio limitado a una banda cercana a las últimas ventas y tope de 10 anuncios para todos.** Eran la propuesta inicial contra cuentas múltiples y especuladores. Luis las descartó: quiere el mercado libre y no le importa que alguien abra varias cuentas.
- **Sin intercambios privados al principio.** Luis los considera imprescindibles en un juego con mercado.
- **Intercambios privados con faradios.** Dejarían el mercado sin uso y la comisión sin efecto.
- **Limitar también el reto del día o el archivo en el plan gratuito.** El reto es lo que hace volver cada día; Luis limitó solo los duelos.
- **Abrir el mercado sobre el progreso en el navegador.** Saldo y piezas se pueden falsear.

## Consecuencias

- **«Una por cuenta» no es «una por persona».** Con varias cuentas e intercambios libres, una persona puede juntar varias unidades de una edición. El freno que queda es exigir cuenta verificada y nivel 10 para comprarla.
- **Traspasos de faradios entre cuentas propias.** Con precio libre, una cuenta puede comprar a otra un artículo a un precio inflado. Cuesta el 10 % de comisión; no se limita más.
- **Riesgo con menores.** Mercado, cofres al azar y apuestas juntos se acercan a lo que regulan la ley española de menores en entornos digitales y la *Digital Fairness Act*. La protección es que el faradio no tiene valor en dinero. Al cobrar la suscripción hay que revisarlo con un abogado, junto con pagos, facturación, impuestos, política de privacidad y borrado de cuenta (pendientes en [mejoras](../mejoras/README.md)).
- **Liquidez.** Con pocos jugadores el mercado queda vacío. Conviene no abrir la fase 4 por debajo de unas 2.000 cuentas activas a la semana; las fases 0 a 3 valen sin mercado.
- **Un solo entorno de Supabase** ([0001](0001-supabase-un-solo-entorno.md)). Probar un libro contable contra producción es arriesgado: conviene crear antes la base de datos de preprod.
- **Soporte.** Hoy no hay herramientas de administración para deshacer una operación por error o fraude; hacen falta antes de la fase 4.
- **Jugadores actuales.** Notarán el recorte de cofres gratis y el límite de 5 duelos. La migración de saldos y piezas al servidor necesita un tope y una regla clara para las piezas ya compradas.
- **Trabajo grande.** La fase 1 es lo que la 0052 descartó por coste («calcular todo el saldo en el servidor») y ahora es obligatoria. Cada fase tendrá su propia decisión con el detalle, sus migraciones (con confirmación de Luis) y sus pruebas.
- Las cifras de esta decisión son valores de partida. Las fija la fase 0.
