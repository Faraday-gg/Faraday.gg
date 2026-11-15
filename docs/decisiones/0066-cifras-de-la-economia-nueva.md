# 0066. Primeras cifras de la economía nueva: misiones del día, lote por pieza repetida y tope diario

- **Estado:** propuesta (código en la rama `feat/cifras-economia-nueva`; sin migración)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) (fase 2) y aplica tres de las cifras de la [0056](0056-cifras-de-la-economia-con-simulador.md).
- **Cambia a:** la [0027](0027-cofres.md) y la [0036](0036-seis-cofres.md) (el lote por pieza repetida y el cofre de las misiones del día) y la [0024](0024-avatar-faradios-y-misiones.md) (no había tope diario).

## Contexto

El simulador de la 0056 midió que, con las reglas de antes, un jugador diario emitía 390 ≈ al día, completaba el catálogo hacia el día 103 y acababa el año con 115.000 ≈ sin gastar. Propuso ocho cifras. Con la fase 1 terminada (el servidor calcula lo que gana quien tiene cuenta), ya se pueden aplicar.

Se aplican ahora las tres que son solo cambiar un número. El protector de racha y repetir misión son funciones nuevas con su interfaz, y van en la entrega siguiente. Las ediciones de colección y la comisión del mercado son las fases 3 y 4.

## Decisión

| Qué | Antes | Ahora |
|---|---|---|
| Recoger las tres misiones del día | Un cofre Chispa | **40 ≈** |
| Pieza de cofre de una rareza que ya se tiene entera | Lote de 40 / 90 / 180 / 380 / 800 ≈ | **10 / 25 / 45 / 95 / 200 ≈** (la cuarta parte) |
| Faradios ganados jugando en un día | Sin límite | **400 ≈ como mucho** |

- **El tope cuenta** lo que se gana por el reto del día, el archivo, los duelos y las misiones. **No cuenta** los lotes de los cofres, el premio por nivel, los premios del Circuito, las apuestas ni la bienvenida.
- Con el tope alcanzado se paga lo que quepa, o nada. **El reto, el duelo o la misión cuentan igual** para la experiencia, las misiones, la batería y la racha.
- Las tres misiones de la semana siguen dando un cofre Rayo.
- Vale para todos: con cuenta lo aplica el servidor (`lib/misiones.mjs`, `lib/comunidad.mjs`) y sin cuenta, el navegador (`dist/progress.js`). Las cifras están en los dos sitios y `tests/tope-diario.test.mjs` comprueba que coinciden.

### Lo que da el simulador

Un año, 40 jugadores por perfil. «Con todo» es la economía nueva completa de la 0056, con ediciones, protector y mercado, que todavía no existen.

| Jugador diario | Antes | Ahora (esta entrega) | Con todo |
|---|---|---|---|
| Faradios emitidos al día | 394 | 239 | 222 |
| Completa el catálogo | Día 103 | Día 120 | Día 255 |
| Gasta de lo que gana, últimos 60 días | 2 % | 3 % | 91 % |
| Saldo al acabar el año | 116.597 ≈ | 59.445 ≈ | 3.704 ≈ |

**Esta entrega reduce la emisión un 40 %, pero no da en qué gastar.** El jugador diario sigue completando el catálogo en cuatro meses y después acumula. Lo que hace que la moneda sirva son las ediciones de colección de la fase 3.

### Código

- `dist/chests.js`: `FALLBACK`. `dist/progress.js`: `REWARD.daySet`, `REWARD.dayCap`, `underCap` y los textos de las misiones y de los cofres.
- `lib/misiones.mjs`: `DAY_SET`, `DAILY_CAP` y `CAPPED`. `lib/comunidad.mjs`: `earn`, que paga hasta el tope; la jornada cobrada cuenta una vez aunque no se pague. `lib/stores.mjs`: `ledgerSum`.
- `scripts/simular-economia.mjs`: `HOY` pasa a ser las reglas de antes (se conservan para comparar) y `PROPUESTA`, la economía nueva.
- `tests/tope-diario.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Esperar a tener las ediciones para cambiar las cifras.** Cuanto antes baje la emisión, menos faradios sobrantes habrá cuando se abra el mercado.
- **Meter el premio por nivel en el tope.** Cada nivel se cruza una sola vez: si ese día no cabe, se perdería para siempre.
- **Que el tope recorte también la experiencia y la batería.** Castigaría seguir jugando; el tope es solo de moneda.
- **Quitar del todo el lote por pieza repetida.** Abrir un cofre y no recibir nada es peor que recibir poco.

## Consecuencias

- **Un jugador diario normal no llega al tope.** Gana unos 135 ≈ al día jugando; el tope lo notan quienes juegan muchos duelos y recogen todas las misiones el mismo día.
- **Quien ya tiene el catálogo completo recibe mucho menos de los cofres.** Es lo que se buscaba, pero lo notará.
- **Un cofre gratis menos al día** para quien completaba las tres misiones.
- **Un premio aplazado no esquiva el tope:** si se cobra otro día, cuenta en el tope de ese día.
- La regla «comprar un cofre sale mejor que comprar en la tienda» (0036) no cambia: el valor de un cofre se calcula con las piezas, no con el lote por repetida.
- **Sin migración.** Sigue sin probarse el conjunto en una Preview con una cuenta real.
