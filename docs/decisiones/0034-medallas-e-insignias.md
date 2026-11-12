# 0034. Medallas e insignias en el perfil

- **Estado:** propuesta (código en la rama `feat/medallas-perfil`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0024](0024-avatar-faradios-y-misiones.md) (perfil, niveles, racha y misiones), la [0023](0023-duelos-1vs1.md) y la [0031](0031-ligas-de-amigos.md) (la medalla destacada se ve en los duelos y en las ligas).

## Contexto

Luis quiere dar más peso al perfil de cada jugador y que el juego sea más social: logros que apetezca conseguir, que se vean bien en el perfil y que se sientan importantes. Ya se medían muchas cosas (racha, retos, «Casi casi», nivel, duelos, cofres, misiones, ligas), pero ninguna dejaba huella: al pasar el día no quedaba nada que enseñar.

Limitaciones: el progreso vive en `localStorage` (sin cuentas obligatorias), no hay dependencias ni imágenes nuevas, juegan menores y Supabase tiene un solo entorno.

## Decisión

### Catálogo: 59 logros

**12 medallas con cuatro niveles** (bronce, plata, oro y diamante). Cada nivel es un logro.

| Medalla | Qué mide | Bronce | Plata | Oro | Diamante |
|---|---|---|---|---|---|
| Corriente continua | Días seguidos con el reto del día (mejor racha) | 3 | 7 | 30 | 100 |
| Circuito cerrado | Retos completados, de hoy o del archivo | 5 | 25 | 100 | 365 |
| Pulso fino | «Casi casi» (menos de 1,1×) | 1 | 10 | 50 | 200 |
| Buen ojo | Respuestas a menos de 2× | 10 | 50 | 250 | 1.000 |
| Día redondo | Retos con media por debajo de 1,5× | 1 | 5 | 25 | 100 |
| Duelista | Duelos ganados a personas | 1 | 10 | 50 | 200 |
| Imparable | Duelos ganados seguidos a personas | 2 | 3 | 5 | 10 |
| Alto voltaje | Nivel | 5 | 10 | 20 | 35 |
| Fondo de armario | Piezas compradas o salidas de cofres | 3 | 15 | 50 | 120 |
| Cazatormentas | Cofres abiertos | 1 | 10 | 50 | 150 |
| Manos a la obra | Misiones recogidas | 5 | 30 | 100 | 300 |
| Campeón de liga | Semanas ganadas en ligas de dos o más personas | 1 | 3 | 10 | 25 |

**11 insignias**, que se consiguen una vez: Primera chispa (primer reto), En el clavo (menos de 1,01×), Triplete (las tres respuestas de un reto a menos de 2×), Madrugador (reto de hoy entre las 5:00 y las 8:00), Arqueólogo (10 retos del archivo), Intacto (ganar un duelo a una persona sin perder vida), En equipo (crear una liga o unirse a una), Legendario (tener una pieza legendaria), De punta en blanco (llevar algo en cabeza, gafas, cuello y extra a la vez), Semana redonda (las tres misiones de una semana) y Pionero (completar un reto en 2026).

### Cómo se ven

- **Dibujo en CSS, sin imágenes** (`dist/medals.css`): la medalla es un disco de metal con cinta y el icono grabado; la insignia, una chapa hexagonal azul noche con el canto dorado. Sin conseguir se ve la silueta apagada.
- **Vitrina** en la tarjeta del perfil, bajo el nivel: las tres mejores y «N / 59».
- **Pestaña «Medallas»** (la cuarta del perfil): resumen, medallas con su nivel, puntos de nivel y barra hacia el siguiente, e insignias. Al tocar una se abre su ficha: qué pide cada nivel, cuándo se consiguió y el botón para destacarla.
- **Al conseguir una**: un aviso arriba que no tapa la partida, con sonido. Al abrir el perfil (o tocar el aviso), una **ceremonia a pantalla completa**: rayos, la medalla en grande, nombre, nivel y cómo se consiguió. De cada medalla solo se enseña el nivel más alto y, como mucho, las cinco mejores.
- **Medalla destacada**: la que el jugador elige (o, si no elige, la más difícil y reciente) se ve junto a su nombre en el marcador y la presentación de los duelos y en la clasificación de las ligas.

### Cómo funciona

- `dist/medals.js` tiene el catálogo, la regla (`Medals.earned(cifras)`), el dibujo, el aviso y la ceremonia. No guarda nada: se prueba con Node (`tests/medallas.test.mjs`).
- `dist/progress.js` lleva las cifras. Unas salen del progreso que ya había (racha, retos, «Casi casi», nivel, piezas, look) y otras son contadores nuevos en `state.stats`. Lo conseguido se guarda en `state.medals` (`got` con la fecha, `fresh` sin ver y `pin`), en la misma clave `casi-casi:progreso`. Se comprueba tras cada cambio del progreso.
- `duel.js` añade `bot` y `flawless` al evento `faraday:duel`. `ligas.js` avisa con el evento nuevo `faraday:liga` al entrar en una liga y al recibir el resumen del lunes con semanas ganadas.
- La destacada viaja como un campo más del avatar (`badge`). En el servidor solo cambia la lista de campos aceptados (`AVATAR_SLOTS` en `lib/duelos.mjs`, que también usa `lib/ligas.mjs`). **No hay migración**: en Supabase el avatar ya es `jsonb`.
- **Quien ya jugaba** recibe al entrar lo que se puede saber de su progreso: racha actual, retos, «Casi casi», nivel, piezas y duelos ganados. Lo que no se contaba antes (respuestas a menos de 2×, cofres abiertos, misiones recogidas…) empieza en cero.

## Qué buscamos y qué evitamos

Lo que anima: metas a corto plazo siempre a la vista (el siguiente nivel con su barra), algo que enseñar a los demás (vitrina y destacada) y un momento de celebración.

Lo que no hacemos, porque juegan menores: nada caduca ni se pierde, no hay cuentas atrás, ninguna pide jugar de noche (se descartó «Noctámbulo») y las medallas de duelos solo cuentan contra personas, para que no se consigan repitiendo contra el bot.

## Alternativas descartadas

- **Dar faradios o cofres por cada medalla.** La economía ya es generosa y está sin medir con datos ([idea](../ideas/ajustes-economia-faradios.md)). El premio es la medalla; se puede añadir después.
- **Guardar las medallas en el servidor y un perfil público con enlace.** Sin cuentas obligatorias no hay a quién asociarlas y pediría tablas nuevas. Queda para cuando el progreso pase al servidor.
- **Imágenes o iconos de una librería.** Peso, licencias y un estilo ajeno. El dibujo en CSS con iconos propios de unos pocos trazos sigue la paleta de la web.
- **Insignias secretas.** Se ven todas desde el primer día: saber qué falta es lo que anima a ir a por ello.
- **Enseñar toda la vitrina a los demás.** De momento viaja una sola, que cabe junto al nombre.

## Consecuencias

- **Se puede hacer trampa**, como con los faradios y las piezas: quien edite su `localStorage` se pone las medallas que quiera, y el servidor no comprueba que la destacada sea suya. Vale mientras no haya nada en juego; se revisa cuando el progreso pase al servidor.
- Las medallas no viajan entre dispositivos ni con la cuenta, igual que el resto del progreso.
- **Pionero** solo se puede conseguir en 2026. Es la única con fecha: premia a los primeros jugadores, pero quien llegue después no podrá tenerla. Si no convence, se quita del catálogo sin tocar nada más.
- «Campeón de liga» se apunta con el resumen del lunes, que se pide una vez por semana y navegador: si esa semana se abre la app en otro dispositivo, la victoria no se cuenta en el primero.
- Los umbrales están puestos a ojo. Hay que mirarlos con datos reales, sobre todo los de diamante.
- `progress.js` y el reparto de `duel.js` siguen sin pruebas automáticas; la regla de las medallas sí la tiene.
