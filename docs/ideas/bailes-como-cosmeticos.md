# Bailes como cosméticos, y lo que enseñan Fortnite y Roblox

- **Estado:** abierta
- **Fecha:** 2026-11-14
- **Propuesta por:** Luis (investigación y redacción de Claude Code)

## Qué

Hacer de los bailes del avatar ([decisión 0049](../decisiones/0049-bailes-del-avatar.md)) un hueco más del armario, **«Baile de victoria»**. Cada jugador elige el baile con el que celebra cuando gana un duelo y lo ve su rival. Algunos bailes son gratis; otros se ganan con faradios, con misiones o por nivel, como el resto de las piezas. Hoy los 7 bailes salen al azar para todos.

## Lo que se ha visto en Fortnite y Roblox

Investigación con fuentes públicas (artículos jurídicos, estudios y prensa), sin abrir el código de los juegos. Las cifras de los propios juegos o de consultoras pagadas por ellos van marcadas como tales.

### Por qué la gente paga por algo que no da ventaja

- **Expresarse y ser alguien en el juego.** Es el motivo que más se repite en los estudios: Cleghorn y Griffiths (2015) sobre compras de objetos virtuales, y un estudio coreano de 2022 sobre ZEPETO y Roblox, donde el deseo de compra nace de «expresar y confirmar la propia imagen». El propio informe de Roblox de 2023 dice que el 56 % de la generación Z da más importancia a vestir a su avatar que a vestirse en la vida real. Es el dato del propio juego, así que probablemente exagera.
- **Estatus y pertenencia.** La ropa y los accesorios sirven a la vez para expresarse y como símbolo de estatus. En Fortnite, sin la skin o el baile de moda no se puede «ir conjuntado» con los amigos ni sumarse al baile viral.
- **Ventaja de juego, también en Roblox.** En una encuesta de Altman Solon, casi la mitad de los que gastan Robux lo hacen para jugar mejor y el 44 % para expresarse. En Faraday.gg no hay ventajas de pago, y así debe seguir ([idea de monetización](monetizacion-cosmeticos.md)).
- **El baile es un cosmético que se ve en acción.** Una skin se mira; un baile se **enseña al rival** en el momento de ganar. Es lo más social que hay en una tienda de cosméticos.

### Por qué siguen jugando

- **Lo social:** se juega con amigos y para enseñar cosas a los amigos.
- **Lo que rota:** la tienda de Fortnite cambia cada 24 horas y lo que se va puede no volver. Funciona muy bien, pero es **miedo a perderse algo (FOMO)**, y ya decidimos no hacer ofertas con cuenta atrás ([idea de monetización](monetizacion-cosmeticos.md)).
- **Lo viral:** cuando un streamer o un TikTok usa un baile, la gente lo busca en la tienda. Un baile de victoria que aparezca en la tarjeta para stories ([decisión 0032](../decisiones/0032-tarjeta-para-stories.md)) aprovecharía eso sin presionar.

### Qué es libre y qué no en los bailes

- **Libre:** los pasos de baile social y las rutinas sencillas. La Oficina de Copyright de EE. UU. no registró el «Floss» ni el «Carlton», y en 2022 un juez desestimó la demanda de un coreógrafo contra Epic.
- **No libre:** una coreografía larga y concreta (al creador del Floss le registraron una variante de 30 segundos), la animación de cada juego, la música y los nombres comerciales de los emotes. Además, algunos pleitos se retiraron solo porque al demandante aún le faltaba el registro, no porque el baile fuera libre.
- Las demandas también se basaron en el **derecho de imagen** (que el baile identifique a una persona). Por eso los bailes de la 0049 tienen nombres genéricos y no imitan a nadie concreto.

## Por qué

- Da a los duelos un remate social: ganas y enseñas **tu** baile.
- Es un cosmético que no cambia quién gana, en línea con la idea de monetización.
- Da a los faradios un uso que se ve más que una gorra.

## Dudas y riesgos

- Hace falta que el duelo envíe el baile elegido al rival. Hoy viaja el `look` (`lib/duelos.mjs`): habría que añadir un campo y que un cliente antiguo lo ignore.
- Hay que fijar precios y niveles con la [economía de faradios](ajustes-economia-faradios.md).
- Si algún día se vende por dinero, aplican las mismas dudas que en la idea de monetización (menores, pagos y cajas botín).
- Con «reducir movimiento» no se baila: quien lo tenga activado no verá el baile del rival.

## Fuentes

- Venable LLP (2020), [Gaming Emote Litigation](https://www.venable.com/insights/publications/2020/04/gaming-emote-litigation-battle-royale-ensues-over).
- Hodgson Russ, [Fortnite Crushes Choreographer's Copyright Claims](https://www.hodgsonruss.com/newsroom/publications/Fortnite-Crushes-Choreographers-Copyright-Claims) (caso Hanagami, 2022).
- Lewis Rice, [Dance Dance Litigation](https://www.lewisrice.com/publications/dance-dance-litigation-lawsuits-filed-over-the-use-of-dance-choreography-in-fortnite/).
- Cleghorn y Griffiths (2015), *Digital Education Review*, sobre la compra de objetos virtuales ([LearnTechLib](https://learntechlib.org/p/158533)).
- Estudio cualitativo sobre la compra de moda para avatares en ZEPETO y Roblox (2022, [KoreaScience](https://koreascience.or.kr/article/JAKO202226461381786.pdf)).
- Informe de Roblox sobre expresión digital, moda y belleza de 2023, citado en [FashionUnited](https://fashionunited.uk/news/fashion/roblox-report-digital-self-expression-continues-to-determine-metaverse-trends/2023111072525).
- Encuesta de Altman Solon sobre compras con Robux, citada en [Chain Store Age](https://chainstoreage.com/roblox-users-make-purchases-game-and-real-life).
- Beedie School of Business (SFU), [The avatar's new clothes](https://beedie.sfu.ca/ideas/?p=12996).
