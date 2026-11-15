# 0058. El servidor calcula y paga los faradios del reto del día y del archivo

- **Estado:** propuesta (código en la rama `feat/premios-reto-servidor`; sin migración nueva)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) (fase 1) y la [0057](0057-libro-contable-de-faradios.md), de la que es la segunda entrega. **Cambia el reparto de entregas de la 0057** (abajo).

## Contexto

Con el libro contable de la 0057 cada movimiento queda apuntado, pero el navegador sigue diciendo cuánto gana. Esta entrega es la primera en la que el servidor calcula un premio por su cuenta.

Se empieza por el reto del día y el archivo porque el servidor ya guarda todo lo que hace falta: las respuestas (`answers`) y la distancia media del reto jugado el mismo día (`daily_results`, la de las ligas).

## Decisión

- **Con cuenta, los faradios por completar una jornada los calcula el servidor** (`lib/premios.mjs`), con las mismas cifras que tenía el navegador:

  | Qué | Faradios |
  |---|---|
  | Completar el reto de hoy | 20 |
  | Extra por precisión (distancia media menor de 1,5× / 2× / 3×) | 15 / 10 / 5 |
  | Extra por racha | 2 por día seguido, hasta 7 días |
  | Completar un reto del archivo | 5 |

- **Cómo sabe el servidor qué es cada cosa:**
  - Es **reto del día** si esa fecha está en `daily_results`, que solo se apunta cuando las tres preguntas se responden el mismo día (hora de Madrid).
  - Es **archivo** si el jugador tiene las tres respuestas, pero las dio otro día.
  - La **racha** son los días seguidos que hay en `daily_results` hasta esa fecha.
- **El navegador pide el premio, no lo suma.** Al completar una jornada, `dist/progress.js` llama a `POST /api/progreso` con `action: 'premio'` y la fecha. El servidor comprueba, paga y devuelve el saldo. Si falla la red, o el servidor todavía no ha recibido la última respuesta, el navegador lo vuelve a pedir en el siguiente guardado o al volver a entrar (hasta 5 veces).
- **Cada jornada se paga una sola vez**: el apunte lleva la fecha como referencia y `wallet_move` no lo repite.
- **El navegador ya no puede declarar los motivos `reto` y `archivo`.** Si un navegador antiguo los manda, se apuntan como `sin-desglose`.
- **Sin cuenta, todo sigue igual**, en el navegador.
- La experiencia, la batería, la racha que se enseña y los cofres de racha siguen en el navegador.

### Las entregas de la fase 1, corregidas

La 0057 metía las misiones y el premio por nivel en esta entrega. No caben:

- hay misiones de duelos («Juega un duelo», «Gana 3 duelos»), y los duelos son la entrega siguiente;
- el nivel sale de la experiencia, y la mayor parte la dan los duelos.

| Entrega | Qué calcula el servidor | Motivos que deja de declarar el navegador |
|---|---|---|
| 1. Libro contable (hecha, 0057) | Nada: apunta | Ninguno |
| **2. Reto del día y archivo** (esta) | El premio por completar una jornada | `reto`, `archivo` |
| 3. Duelos, apuestas, misiones y nivel | Los premios de los duelos, la apuesta en bote, las misiones y la experiencia | `duelos`, `apuestas`, `misiones`, `nivel` |
| 4. Cofres, tienda y pistas | El sorteo, las compras y el inventario pieza a pieza | `cofres`, `cofres-compra`, `tienda`, `pistas`, `referidos` |
| 5. Cierre | Migra saldos y piezas; deja de aceptar ganancias declaradas | Todos |

> **Nota (2026-11-15):** la [0059](0059-premios-de-los-duelos-en-el-servidor.md) parte la entrega 3 en tres (duelos, apuestas en bote, misiones y nivel) y corrige un fallo de esta entrega: el cobro de un premio podía cruzarse con un guardado y contarse dos veces en el navegador.

### Código

- `lib/premios.mjs` (nuevo): las cifras, `todayPrize`, `streakAt` y `createPrizes`.
- `lib/api.mjs`: conecta los premios con las respuestas y con los resultados diarios de las ligas.
- `lib/comunidad.mjs`: la acción `premio` de `/api/progreso` y la lista `REASONS` sin `reto` ni `archivo`.
- `dist/progress.js`: con cuenta, pide el premio (`claim`, `collect`) en vez de sumarlo. Al recargar la página ya no se pierde lo que quedó pendiente de apuntar o de cobrar.
- `tests/premios.test.mjs` (nuevo, añadido a la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Pagar dentro de `POST /api/answers`**, al llegar la tercera respuesta. Ahorra una llamada, pero esa ruta la usan también los jugadores sin cuenta y no sabe quién tiene sesión. Si el pago fallara, no habría forma de reintentarlo.
- **Que el navegador siga sumando y el servidor solo compruebe después.** Deja el saldo a merced del navegador, que es lo que se quiere quitar.
- **Mover también las misiones y el nivel ahora.** Ver arriba.
- **Calcular la racha con la que dice el navegador.** Se puede falsear; `daily_results` no.

## Consecuencias

- **El aviso puede no coincidir con lo pagado.** El «+37 ≈» del aviso lo calcula el navegador y los faradios, el servidor. Solo difieren si la racha del navegador no es la del servidor (por ejemplo, tras jugar unos días sin cuenta).
- **El saldo tarda uno o dos segundos en subir** tras completar el reto, lo que tarda la llamada.
- **Días jugados antes de tener cuenta.** Al entrar, las respuestas de los últimos 30 días pasan a la cuenta. Sus faradios ya van en el saldo inicial, pero un navegador manipulado podría pedir además el premio del servidor por esos días. Está acotado (una vez por día realmente jugado) y desaparece en la entrega 5, cuando el saldo inicial deje de aceptarse tal cual.
- **Depende de las ligas.** La racha sale de `daily_results`. Si apuntar el resultado falla al responder, el servidor lo calcula y lo apunta al pedir el premio, solo si es el mismo día.
- **Sin migración nueva**, pero necesita las dos pendientes de la 0057 (`20261114120000_preguntas_comunidad` y `20261115120000_libro_contable`). Sin ellas no hay progreso en la cuenta y todo sigue en el navegador.
- El resto del saldo se sigue pudiendo falsear hasta la entrega 5.
