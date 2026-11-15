# 0060. Con cuenta, las apuestas son un bote entre los dos jugadores que lleva el servidor

- **Estado:** propuesta (código en la rama `feat/apuestas-en-bote`; sin migración nueva)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Cambia a:** la [0044](0044-apuestas-en-duelos.md): con cuenta, la apuesta deja de ser contra la banca. Sin cuenta sigue como en la 0044.
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) y la [0056](0056-cifras-de-la-economia-con-simulador.md) (apuestas en bote con un 10 % destruido). Es la entrega 3b de la fase 1 ([0059](0059-premios-de-los-duelos-en-el-servidor.md)).

## Contexto

En la 0044 cada jugador apostaba contra la «banca» porque el servidor no conocía los saldos. Eso crea faradios: quien gana recibe otro tanto de la nada, y dos cuentas propias pueden fabricar 750 ≈ al día dejando ganar siempre a la misma. El simulador de la 0056 lo mide: es parte de los 1.014 ≈ diarios que emite un jugador intenso.

Desde la [0057](0057-libro-contable-de-faradios.md) el servidor lleva el saldo de quien tiene cuenta, así que ya se puede hacer el bote que la 0044 descartó.

## Decisión

### Reglas del bote (con cuenta)

| Qué | Cómo |
|---|---|
| Cuánto se juega | **La apuesta más baja de las dos.** Si uno elige Calambre (60 ≈) y el otro Chispazo (25 ≈), cada uno pone 25 ≈. |
| Cuándo hay bote | Solo si los dos apuestan, los dos tienen cuenta y saldo, y el rival no es Faraday-bot. |
| Quien gana | Se lleva el bote menos un **10 %, que se destruye**. Con 25 ≈ cada uno: recibe 45 ≈ (gana 20). |
| Quien pierde o abandona | Pierde lo que puso. |
| Empate | Cada uno recupera lo suyo, sin comisión. |
| El rival no llegó a poner su parte | Se devuelve lo puesto. |
| Tope | 5 duelos con apuesta al día, contados en el libro contable. |
| Niveles | Los de la 0044: Chispazo en el 10, Calambre en el 12 y Alto voltaje en el 15. |

Las apuestas ya no crean faradios: lo que gana uno lo pierde el otro, y la comisión sale de la economía.

### Cómo lo hace el servidor

- **Cobra al empezar.** Cuando el duelo arranca, el navegador de cada jugador llama a `POST /api/progreso` con `action: 'apostar'`. El servidor lee el duelo guardado, calcula lo que pone cada uno y lo cobra con un apunte `apuesta` cuya referencia es el duelo.
- **Solo durante la primera pregunta.** Resuelta la primera ronda ya no se puede entrar en el bote: así nadie espera a ver cómo va el duelo para decidir si pone su parte.
- **Paga al terminar.** `action: 'cobrar-apuesta'` mira quién ganó y si los dos pusieron su parte, y paga con un apunte `apuesta-premio` (quien gana) o `apuesta-devuelta` (empate, o rival que no puso).
- Las dos llamadas se pueden repetir: ni se cobra ni se paga dos veces.
- **El navegador ya no puede declarar el motivo `apuestas`.**

### En la interfaz

- El selector explica el bote («se juega la apuesta más baja de las dos…») y cada ficha dice «Hasta +20» en vez de «Ganas +25».
- La ficha junto al nombre enseña lo que hay de verdad en el bote, no lo que eligió cada uno. Si el rival no apuesta, no sale.
- Al empezar: «Al bote: −25 ≈. Si ganas, te llevas 45 ≈.» Al terminar, lo ganado o perdido con su explicación.
- Si se cierra la página a mitad de duelo, al volver se liquida sola, como antes.

### Código

- `lib/apuestas.mjs`: `BET_AMOUNTS`, `BET_RAKE`, `BET_CAP`, `betStake`, `betOpen`, `betResult` y `betPayout`.
- `lib/comunidad.mjs`: las acciones `apostar` y `cobrar-apuesta`, y `move` y `ledgerHas` en el almacén local. `lib/stores.mjs`: lo mismo contra Supabase (`wallet_move`).
- `dist/bets-rules.js`: `RAKE`, `shared` y `pot`. `dist/bets.js`: el camino con cuenta (`trackServer`, `settleServer`) y los textos.
- `tests/apuestas.test.mjs` (reglas) y `tests/premios.test.mjs` (el bote entero por la API).

## Alternativas descartadas

- **Exigir que los dos apuesten lo mismo.** Obligaría a ponerse de acuerdo o a emparejar por apuesta, y casi nunca habría bote. Jugar la más baja no necesita nada de eso.
- **Cobrar y pagar dentro del servidor de duelos.** El duelo no sabe quién tiene cuenta; con llamadas aparte, un fallo se puede reintentar.
- **Quitar las apuestas a quien no tiene cuenta.** Sus faradios no salen de su navegador ni llegarán al mercado; no hace daño dejarlas como estaban.
- **Comisión también en el empate.** Castiga un resultado en el que nadie gana.
- **Dejar entrar en el bote durante todo el duelo.** Permitiría poner la parte solo cuando se va ganando.

## Consecuencias

- **Sigue siendo una apuesta**, ahora entre jugadores. El riesgo con menores de la 0044 y la [0027](0027-cofres.md) no cambia; `DAILY_CAP = 0` en `dist/bets-rules.js` sigue quitando el selector.
- **Con dos cuentas propias ya no se fabrican faradios**: se pasan de una a otra y se pierde el 10 %.
- **Menos botes de los que parece.** Hace falta que los dos apuesten y tengan cuenta. Si el rival no apuesta, el duelo va sin apuesta y no se dice por qué.
- **El nivel lo sigue declarando el navegador** hasta la entrega 3c: alguien con el navegador manipulado puede apostar antes del nivel 10. No puede apostar faradios que no tiene.
- **Cuenta contra jugador sin cuenta:** no hay bote. El jugador sin cuenta sigue viendo su apuesta contra la banca.
- Si un jugador entra tarde (recarga la página pasada la primera pregunta), no pone su parte y al otro se le devuelve la suya.
- **Sin migración nueva**, pero siguen pendientes las dos de la 0057.
