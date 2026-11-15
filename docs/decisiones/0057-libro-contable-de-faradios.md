# 0057. Libro contable de faradios y reparto de la fase 1 en entregas

- **Estado:** propuesta (código en la rama `feat/libro-contable-faradios`; la migración `20261115162701_libro_contable` está **aplicada el 15 de noviembre de 2026**, en una versión que no borra las funciones antiguas: ver la [bitácora](../bitacora/2026-11.md))
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) (fase 1, «economía en el servidor»).
- **Modifica:** el progreso en la cuenta de la [0052](0052-preguntas-de-la-comunidad.md): el servidor sigue aceptando lo que declara el navegador, pero ahora lo apunta con su motivo.

## Contexto

La fase 1 de la 0055 pide que el saldo, los premios, los cofres y las piezas los lleve el servidor. Es mucho trabajo y no cabe en una sola PR.

Lo que hay hoy (0052): con cuenta, el navegador manda al servidor cuánto ha cambiado su saldo y el servidor lo suma, con un tope de 1.500 ≈ al día. El servidor guarda **un número**, sin saber de dónde viene ni en qué se gastó. La migración de la 0052 **todavía no está aplicada** en Supabase, así que en producción ni siquiera eso funciona.

La [0056](0056-cifras-de-la-economia-con-simulador.md) dejó pendiente medir la economía con jugadores reales, que necesita ese registro.

## Decisión

### La fase 1 se hace en cinco entregas, cada una con su PR

| Entrega | Qué pasa a calcular el servidor | Qué motivos deja de declarar el navegador |
|---|---|---|
| **1. Libro contable** (esta) | Nada nuevo: apunta cada movimiento con su motivo | Ninguno |
| 2. Reto del día, archivo, racha y misiones | Los premios, a partir de `answers` y `daily_results` | `reto`, `archivo`, `misiones`, `nivel` |
| 3. Duelos y apuestas | Los premios y la apuesta en bote, al cerrar el duelo en `duels` | `duelos`, `apuestas` |
| 4. Cofres, tienda y pistas | El sorteo, la compra y un inventario con una fila por pieza | `cofres`, `cofres-compra`, `tienda`, `pistas`, `referidos` |
| 5. Cierre | Migra saldos y piezas con tope; el servidor deja de aceptar ganancias declaradas | Todos |

> **Nota (2026-11-15):** la [0058](0058-premios-del-reto-en-el-servidor.md) corrige este reparto: las misiones y el premio por nivel pasan de la entrega 2 a la 3, con los duelos.

Cada entrega quita motivos de la lista que el navegador puede declarar. Cuando la lista queda vacía, el saldo ya no se puede falsear.

### Esta entrega: el libro

- **Tabla `ledger`:** un apunte por cada cambio de saldo, con la cantidad, el motivo, quién lo dice (`servidor` o `navegador`), una referencia opcional, el saldo que queda y el día de Madrid. No se modifica ni se borra. El saldo de un jugador es siempre la suma de sus apuntes.
- **El navegador desglosa.** Todo cambio de saldo en `dist/progress.js` pasa por una sola función, `move(cantidad, motivo)`. Con cuenta, el desglose viaja con cada guardado. Motivos: `bienvenida`, `reto`, `archivo`, `duelos`, `nivel`, `misiones`, `cofres`, `cofres-compra`, `tienda`, `pistas`, `apuestas`, `referidos` y `otros`.
- **El servidor no se fía del desglose para el saldo.** El saldo cambia como antes (cambio total, con tope diario). El desglose solo decide cómo se apunta:
  - lo que no venga desglosado, o venga con un motivo desconocido, se apunta como `sin-desglose`;
  - lo que el tope diario o el saldo mínimo recortan se apunta como `tope`;
  - la primera subida de un jugador se apunta como `saldo-inicial`.
- **Lo que cobra o paga el servidor** (proponer, votar, premio al autor) se apunta con origen `servidor` y la propuesta como referencia.
- **Un mismo premio no se paga dos veces.** `wallet_move` no repite un apunte con el mismo jugador, motivo y referencia. Antes, el premio al autor se podía pagar dos veces si la generación del lunes se repetía.
- **Vista `ledger_daily`:** faradios emitidos y gastados por día, motivo y origen. Es la medición que pedía la fase 0.
- **`POST /api/progreso` con `action: 'movimientos'`** devuelve los 50 últimos apuntes del jugador. No hay pantalla todavía; sirve para soporte y para un futuro historial.

### Código

- `supabase/migrations/20261115162701_libro_contable.sql`: tabla, vista y funciones. Sustituye `progress_credit` por `wallet_move` y vuelve a crear `progress_save`, `community_propose` y `community_vote` para que apunten.
- `lib/comunidad.mjs`: `REASONS`, el desglose en la ruta del progreso y el libro en el almacén local. `lib/stores.mjs`: lo mismo contra Supabase.
- `dist/progress.js`: `move()`. `dist/duel.js`, `dist/bets.js` y `dist/pistas.js` dicen su motivo al ganar o gastar.
- `tests/comunidad.test.mjs`: los apuntes suman el saldo, el tope queda apuntado, el desglose se respeta y el premio al autor no se repite.

## Alternativas descartadas

- **Pasar todos los premios al servidor de una vez.** Es el objetivo, pero toca el reto, los duelos, los cofres y la tienda a la vez: una PR imposible de revisar y de probar.
- **Empezar por los premios del reto y dejar el libro para después.** Sin libro no se puede comprobar que el servidor y el navegador dan lo mismo, ni medir nada.
- **Guardar solo totales por día y motivo.** Ocupa menos, pero no permite deshacer un movimiento concreto ni dar al jugador su historial, que hará falta con el mercado.
- **Que el saldo se calcule sumando el libro en cada lectura.** Más puro, pero más lento; se guarda el saldo y el libro lo explica.
- **Editar la migración de la 0052**, que aún no está aplicada. Se añade otra: es la norma del proyecto y deja claro qué cambia.

## Consecuencias

- **El saldo se sigue pudiendo falsear** hasta la entrega 5: el navegador declara lo que gana, con el tope de 1.500 ≈ al día. Esta entrega solo lo deja apuntado.
- **Hay que aplicar dos migraciones, en orden:** `20261115162316_preguntas_comunidad` y `20261115162701_libro_contable`. Con solo la primera, guardar el progreso y el premio al autor fallan (503). Necesitan la confirmación de Luis.
- **La migración no se ha ejecutado contra un Postgres real.** No hay base de datos local ni de preprod. La lógica está probada en el almacén local (`tests/comunidad.test.mjs`), que hace lo mismo en JavaScript; el SQL hay que revisarlo y probarlo al aplicarlo.
- **La tabla crece** unos pocos apuntes por jugador y guardado. Con muchos jugadores habrá que agrupar o archivar los apuntes antiguos del navegador.
- **Sin cuenta no hay libro.** Los jugadores sin cuenta siguen con todo en su navegador, como decide la 0055.
- Los motivos del navegador son una declaración, no una prueba: `ledger_daily` sirve para ver la forma de la economía, no para auditar a un jugador.
