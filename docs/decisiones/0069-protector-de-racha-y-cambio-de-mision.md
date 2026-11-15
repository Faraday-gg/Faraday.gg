# 0069. Protector de racha, cambio de misión y una sola racha

- **Estado:** propuesta (código en la rama `feat/sumideros-racha-y-misiones`; no necesita migración)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) (fase 2) y aplica las dos cifras de la [0056](0056-cifras-de-la-economia-con-simulador.md) que quedaban pendientes en la [0066](0066-cifras-de-la-economia-nueva.md).

## Contexto

La economía nueva necesita gastos pequeños y frecuentes, además de las ediciones de colección. La 0056 fijó dos: proteger la racha (150 ≈) y cambiar una misión (30 ≈). Eran funciones nuevas con su interfaz y se dejaron para esta entrega.

Además, al revisar el libro contable de la primera cuenta real (15 de noviembre) apareció una incoherencia: el servidor llevaba dos rachas distintas. El premio del reto contaba los días seguidos apuntados en `daily_results` (cuatro) y los cofres de racha usaban un contador aparte, que había empezado ese día en 1.

## Decisión

### Una sola racha

- La racha sale de los días que el servidor tiene apuntados (`daily_results`), tanto para el premio del reto como para los cofres de racha.
- El contador de los cofres (`stats.streak`) se mantiene, porque puede ser más largo que los 7 días que mira el premio, pero **nunca va por detrás** de los días apuntados. Si da un salto, se entregan los cofres de los hitos que se cruzan.

### Protector de racha (150 ≈)

- **Cuándo se ofrece:** ayer no se jugó el reto, hoy todavía tampoco, y la racha que acababa anteayer era de **3 días o más**.
- **Qué hace:** cobra 150 ≈ y apunta ayer como día protegido. Ese día hace de puente: la racha no se rompe, pero el día no suma.
- **Límites:** solo se puede proteger un día (con dos días sin jugar la racha se pierde) y solo antes de jugar el reto de hoy.
- **Dónde se ve:** un aviso al entrar («Ayer no jugaste: tu racha de 5 días está a punto de perderse») y un botón en el perfil, bajo el nivel.
- Con cuenta lo decide y lo cobra el servidor (motivo `protector`, referencia = el día protegido: una vez por día). Sin cuenta, lo hace el navegador con su racha y su saldo.

### Cambiar una misión (30 ≈)

- En cada misión sin completar hay un enlace «Cambiar». El primer toque pide confirmar («Confirmar · 30 ≈») y el segundo cobra.
- La misión nueva se sortea entre las que el jugador no tiene. Con cuenta la sortea el servidor.
- **No se puede cambiar:** la del reto de hoy, una completada o recogida, ni una que ya salió de un cambio (una vez por casilla).
- **La nueva nunca sale completada**, ni puede ser una que ya se cambió ese día.
- Valen las del día y las de la semana. De las semanales hay cuatro y salen tres, así que solo se puede cambiar una.
- Con cuenta: motivo `cambio-mision`, referencia `<día o lunes>:<misión>`. Si el cambio falla después de cobrar, se devuelve (`cambio-devuelto`).

### Código

- `lib/premios.mjs`: `SHIELD`, `STREAK_WINDOW` y `streakAt` con días protegidos; el premio devuelve también la racha.
- `lib/cofres.mjs`: `streakDay` recibe la racha apuntada como mínimo.
- `lib/misiones.mjs`: `SWAP_PRICE`, `dayIds`, `weekIds`, `swapOptions` y `swapMission`.
- `lib/comunidad.mjs`: acciones `proteger-racha` y `cambiar-mision` de `POST /api/progreso`; `estado` devuelve `shield` cuando hay algo que proteger. `lib/api.mjs` le pasa los resultados diarios.
- `dist/progress.js` y `dist/styles.css`: el aviso, el botón del perfil y el enlace «Cambiar».
- `tests/sumideros.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).
- Datos: no hay migración. Los días protegidos (`shields`) y los cambios (`day.swap`, `week.swap`) van en `player_progress.stats`.

## Alternativas descartadas

- **Comprar el protector por adelantado** y que se gaste solo al faltar un día. Es lo habitual en otros juegos, pero obliga a tener inventario de protectores y cobra por algo que quizá no se use. Pagar al volver es más simple y el jugador ve qué salva.
- **Que el día protegido sume a la racha.** Sería comprar un día de racha y adelantaría los cofres de los hitos.
- **Permitir protegerla después de jugar el reto de hoy.** El premio de hoy ya se habría pagado con racha 1 y habría que recalcularlo.
- **Proteger más de un día seguido.** Convertiría la racha en algo que se compra.
- **Cambiar la misión todas las veces que se quiera.** Permitiría buscar la más fácil pagando; una vez por casilla lo limita a dos al día.
- **Dejar la racha de los cofres como contador independiente.** Es lo que causó la incoherencia.

## Consecuencias

- **El simulador ya contaba con estos dos gastos**; sus cifras no cambian. Un jugador diario gasta en ellos poco: son gastos de comodidad, no la salida principal de la moneda.
- **Quien tenía la racha de los cofres por detrás la recupera** la próxima vez que cobre el reto, con los cofres de los hitos que cruce. Puede repetir un cofre Imán a quien ya lo recibió en otro dispositivo antes de tener cuenta; es poco y a favor del jugador.
- **La racha que pinta el navegador sigue siendo la suya** (`state.streak`); solo se corrige al proteger. Unificarla también en pantalla queda apuntado en [mejoras](../mejoras/README.md).
- **Sin cuenta no hay servidor que compruebe nada**, como en el resto de la economía sin cuenta.
- De la fase 2 no queda nada pendiente. Siguen la fase 3 (temporadas, acabados y fundición) y la fase 4 (mercado e intercambios).
