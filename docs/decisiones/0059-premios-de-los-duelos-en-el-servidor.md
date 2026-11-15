# 0059. El servidor calcula y paga los faradios de los duelos

- **Estado:** propuesta (código en la rama `feat/premios-duelos-servidor`; sin migración nueva)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) (fase 1). Es la primera parte de la entrega 3 de la [0058](0058-premios-del-reto-en-el-servidor.md), que aquí **se parte en tres**.

## Contexto

La entrega 3 juntaba duelos, apuestas, misiones y nivel. Son tres trabajos distintos:

- los **faradios del duelo** solo necesitan leer el duelo ya guardado;
- las **apuestas en bote** cambian las reglas de la [0044](0044-apuestas-en-duelos.md), el servidor de duelos y la interfaz;
- las **misiones y el nivel** necesitan que el servidor lleve la experiencia, que hoy no conoce.

Esta decisión cubre lo primero.

## Decisión

- **Con cuenta, los faradios de un duelo los calcula el servidor** (`lib/premios.mjs`) leyendo el duelo guardado en `duels`: quién ganó, si el rival era Faraday-bot y si alguien abandonó. Cifras, las de siempre:

  | Resultado | Faradios |
  |---|---|
  | Ganado / empatado / perdido | 15 / 8 / 5 |
  | A partir del cuarto premio del día | el 25 % |
  | Contra Faraday-bot | solo el primero del día |
  | Abandonar | 0 (si abandona el rival, cuenta como ganado) |

- **El tope diario sale del libro contable**: el servidor cuenta los apuntes `duelos` y `duelos-bot` que el jugador tiene ese día. No hace falta ninguna tabla ni columna nueva.
- **El navegador pide el premio** al terminar el duelo (`POST /api/progreso`, `action: 'premio'`, con `duel`), igual que con el reto. Un duelo se paga una sola vez: el apunte lleva el id del duelo como referencia.
- **El navegador ya no puede declarar el motivo `duelos`.**
- La experiencia, la batería y las apuestas siguen en el navegador. Sin cuenta, todo sigue igual.

### Fallo corregido

Al probarlo en el navegador, el saldo local quedó 5 ≈ por encima del del servidor. Si el servidor pagaba un premio mientras viajaba un guardado del progreso, el navegador contaba ese premio dos veces y lo declaraba como ganancia en el guardado siguiente. Afectaba también a los premios del reto de la 0058. Ahora el cobro de premios y el guardado **nunca se solapan** (`dist/progress.js`): uno espera a que termine el otro.

### Las entregas de la fase 1, otra vez

| Entrega | Qué calcula el servidor | Estado |
|---|---|---|
| 1. Libro contable | Nada: apunta | Hecha (0057) |
| 2. Reto del día y archivo | El premio por completar una jornada | Hecha (0058) |
| **3a. Duelos** | Los faradios del duelo | Esta |
| 3b. Apuestas en bote | La apuesta entre los dos jugadores, con el 10 % destruido | Pendiente |
| 3c. Misiones y nivel | La experiencia, las misiones y el premio por nivel | Pendiente |
| 4. Cofres, tienda y pistas | El sorteo, las compras y el inventario | Pendiente |
| 5. Cierre | Migra saldos y piezas; deja de aceptar ganancias declaradas | Pendiente |

### Código

- `lib/premios.mjs`: `DUEL`, `duelCoins` y `createDuelPrizes`.
- `lib/api.mjs`: conecta el premio con el almacén de duelos.
- `lib/comunidad.mjs`: `premio` con `duel`, `ledgerCount` y `REASONS` sin `duelos`. `lib/stores.mjs`: `ledgerCount` contra Supabase.
- `dist/duel.js`: con cuenta, pide el premio. `dist/progress.js`: `Progress.claim` y el cobro sin solaparse con el guardado.
- `tests/premios.test.mjs`: resultados, tope diario, bot, abandono y duelos sin terminar o ajenos.

## Alternativas descartadas

- **Pagar al cerrar el duelo, dentro de `lib/duelos.mjs`.** El duelo no sabe qué jugador tiene cuenta, y un fallo al pagar no se podría reintentar.
- **Contar los duelos del día recorriendo la tabla `duels`.** No tiene índice por jugador ([mejoras](../mejoras/README.md)); el libro ya lo dice.
- **Hacer la entrega 3 entera.** Ver el contexto.

## Consecuencias

- **Una diferencia con el navegador:** allí, repetir contra el bot gasta uno de los tres premios enteros del día aunque no se cobre. En el servidor solo cuentan los duelos cobrados, así que quien practica con el bot conserva sus tres premios enteros. Es un poco más generoso.
- **El aviso del final del duelo** («+15 ≈») lo sigue calculando el navegador, con su propia cuenta de duelos del día. Puede no coincidir con lo pagado si se ha jugado desde dos dispositivos.
- **Sin migración nueva**, pero siguen pendientes las dos de la 0057. Sin ellas nada de esto se activa en producción.
- El duelo tiene que seguir en la tabla `duels` cuando se pide el premio; hoy no se borran.
- Las apuestas siguen siendo contra la banca y declaradas por el navegador hasta la entrega 3b.
