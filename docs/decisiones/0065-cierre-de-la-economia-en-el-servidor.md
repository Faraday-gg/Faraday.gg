# 0065. Cierre de la fase 1: el navegador ya no puede declarar ganancias

- **Estado:** propuesta (código en la rama `feat/cierre-economia-servidor`; sin migración nueva)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code. La regla de lo que se acepta la primera vez la propuso Claude Code y **Luis la confirmó el 15 de noviembre de 2026**, después de fusionar la PR.
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la entrega 5, la última de la fase 1 («economía en el servidor»).
- **Cambia a:** la [0052](0052-preguntas-de-la-comunidad.md) (tope de 1.500 ≈ al día y de 5.000 ≈ la primera vez), la [0061](0061-experiencia-y-misiones-en-el-servidor.md) (experiencia inicial declarada) y la [0063](0063-cofres-en-el-servidor.md) (cofres y piezas iniciales declarados).

## Contexto

Tras las entregas 1 a 4c, el servidor calcula todo lo que gana un jugador con cuenta. Quedaban dos puertas abiertas:

- el servidor seguía aceptando **hasta 1.500 ≈ al día** que el navegador dijera haber ganado, sin motivo;
- la **primera vez** que un jugador subía su progreso, el servidor se fiaba de lo que declaraba: hasta 5.000 ≈, 45.000 de experiencia, 30 cofres de cada tipo y todas las piezas que dijera tener.

Con un mercado, cada cuenta nueva podía llegar diciendo que ya lo tenía todo.

Lo que hace posible cerrarlo bien: al crear la cuenta, esta adopta el identificador anónimo que el jugador ya tenía en ese dispositivo ([0022](0022-inicio-de-sesion-desde-el-servidor.md)). Así que el servidor **ya conoce su historia**: en `daily_results` están los días que completó el reto del día, y ahí solo se apunta el mismo día, así que no se pueden inventar ni rellenar después.

## Decisión

### Después de la primera subida, el navegador no suma nada

El tope diario de ganancias declaradas pasa de 1.500 a **0**. Si el navegador manda un saldo mayor que el del servidor, el servidor no lo acepta y lo deja apuntado en el libro (`sin-desglose` y su `tope`), que sirve para ver quién lo intenta. Gastar sí se acepta: solo puede bajar el saldo propio.

### La primera subida se limita por los días jugados de verdad

Con `D` = días en que el jugador completó el reto del día (según `daily_results`):

| Qué | Se acepta hasta |
|---|---|
| Faradios | 100 + 300 × D |
| Experiencia | 400 × D (y nunca más de 45.000) |
| Piezas | Las que declare, en su orden, mientras su precio sume 300 + 700 × D como mucho |
| Cofres sin abrir | 2 + D en total, empezando por los más baratos (y nunca más de 30 de un tipo) |
| Racha | D |

- **Una cuenta nueva que no ha jugado** trae la bienvenida (100 ≈), dos cofres y piezas por 300 ≈, declare lo que declare.
- **Quien lleva tiempo jugando sin cuenta** conserva lo suyo: las cifras por día están por encima de lo que da jugar a diario con las reglas de hoy (unos 220 ≈ y 350 de experiencia, según el simulador de la [0056](0056-cifras-de-la-economia-con-simulador.md)).
- **Quien declara menos de lo que le toca** se queda con lo que declara.

### Lo jugado antes no se cobra dos veces

El servidor apunta el día en que empezó a llevar el progreso de cada jugador. Los retos del día y los duelos anteriores a ese día no se pueden cobrar: ya van en lo que el jugador trajo. Cierra el hueco que dejó abierto la [0058](0058-premios-del-reto-en-el-servidor.md).

### El navegador pinta lo que dice el servidor

Con cuenta, al entrar se copian del servidor el saldo, la experiencia, los cofres y **el armario** (el inventario). Cambiar a mano los datos guardados en el navegador ya no sirve: al recargar vuelve lo del servidor. Se acaban las «dos cuentas de experiencia» de la 0061.

Sin cuenta, todo sigue igual, en el navegador.

### Código

- `lib/comunidad.mjs`: `RULES.dailyGain` a 0, `FIRST` y `firstBudget`, los topes al iniciar el progreso y la fecha `since`. `lib/cofres.mjs`: topes de cofres y racha declarados. `lib/premios.mjs`: el premio del duelo dice cuándo se creó.
- `lib/api.mjs`: cuenta los días jugados en `daily_results`.
- `dist/progress.js`: copia del servidor la experiencia y el inventario.
- `tests/cierre.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)). Las demás pruebas fijan 200 días jugados para que el tope no las afecte.

## Alternativas descartadas

- **No aceptar nada la primera vez.** Lo más seguro, pero quien ha jugado semanas sin cuenta lo perdería todo al registrarse y dejaría de tener motivo para hacerlo.
- **Topes fijos y bajos para todos** (por ejemplo 500 ≈). Injusto con quien ha jugado mucho y regalo para quien no ha jugado nada.
- **Aceptarlo todo hasta una fecha y cerrar después.** Sencillo, pero hasta esa fecha cualquier cuenta nueva puede declarar lo que quiera.
- **Contar los días por las respuestas guardadas.** Las respuestas del archivo se pueden mandar de golpe para 30 días atrás; `daily_results` no.
- **Reconstruir el saldo exacto repitiendo en el servidor todo lo jugado.** Sería lo justo, pero las misiones, los cofres y las compras de antes no dejaron rastro en el servidor.

## Consecuencias

- **Con esta entrega, el saldo, la experiencia, los cofres y las piezas de quien tiene cuenta ya no se pueden falsear desde el navegador.** Es lo que la 0055 pedía antes del mercado.
- **Lo que no llegue al servidor se pierde.** Antes, si una llamada fallaba, el navegador conservaba lo ganado y lo subía después. Ahora los premios se piden hasta cinco veces y luego se abandonan.
- **Quien haya acumulado mucho sin jugar el reto del día** (solo duelos o archivo) trae poco: esos días no cuentan. Es raro, pero puede pasar.
- **Varios dispositivos sin cuenta:** solo cuenta la historia del dispositivo donde se crea la cuenta.
- **Quedan declaradas dos cosas menores:** lo que el jugador lleva puesto (`look`) y las medallas. No mueven faradios; el armario ya solo enseña como propias las piezas del inventario.
- **La regla de los días se puede ajustar** cambiando `FIRST` en `lib/comunidad.mjs`; `tests/cierre.test.mjs` fija el comportamiento.
- Sin migración nueva. **Sigue sin probarse el conjunto en una Preview con una cuenta real** ([mejoras](../mejoras/README.md)).
