# 0056. Cifras de partida de la economía nueva, fijadas con un simulador

- **Estado:** propuesta (código en la rama `feat/simulador-economia`; **no cambia el juego**: solo añade el simulador y su prueba)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md) (fase 0, «medir y simular»). Sustituye los valores de partida de su tabla «Cambios en la economía» por los de aquí.

> **Nota (2026-11-15):** la [0066](0066-cifras-de-la-economia-nueva.md) aplica en el juego tres de estas cifras (misiones del día, lote por pieza repetida y tope diario). En el simulador, `HOY` son ahora las reglas de antes.

## Contexto

La 0055 dejó las cifras de la economía nueva como valores de partida, a validar antes de programar nada. Su diagnóstico de la economía de hoy salía de sumar a mano las tablas de otras decisiones. Hacía falta comprobarlo y tener una forma de probar cifras nuevas sin tocar el juego.

No hay datos reales que medir: el progreso vive en el navegador y el servidor no registra de dónde sale ni adónde va cada faradio.

## Decisión

### El simulador

`scripts/simular-economia.mjs` juega jugadores de mentira día a día con las reglas del juego y cuenta lo que se emite, lo que se gasta y cuándo se agota el catálogo.

- Usa **los cofres y el catálogo de verdad** (`dist/chests.js`, `dist/avatar.js`). Los premios de `dist/progress.js` y `dist/duel.js` están copiados, porque esos archivos necesitan la página; la prueba avisa si dejan de coincidir.
- Tres perfiles:

  | Perfil | Reto del día | Archivo | Duelos | En qué gasta |
  |---|---|---|---|---|
  | Ocasional | 6 de cada 10 días | No | No | Elige una pieza de la tienda y ahorra |
  | Diario | 9 de cada 10 días | Uno cada tres días | 2 al día, gana la mitad | Igual |
  | Intenso | Todos los días | Uno al día | 5 al día con apuesta, gana el 60 % | Compra el cofre más rentable |

- Dos juegos de reglas: `HOY` y `PROPUESTA`. Para probar otra cifra se cambia en `PROPUESTA` y se ejecuta `node scripts/simular-economia.mjs 365`.
- `tests/economia.test.mjs` comprueba que las cuentas cuadran, el diagnóstico de hoy y que la propuesta cumple sus objetivos. Se añade a la lista de comprobaciones de [AGENTS.md](../../AGENTS.md).

### Lo que sale con las reglas de hoy (un año, 40 jugadores por perfil)

| | Ocasional | Diario | Intenso |
|---|---|---|---|
| Faradios emitidos al día | 62 | 390 | 1.014 |
| Completa el catálogo | No (92 %) | Día 103 | Día 79 |
| Gasta de lo que gana, últimos 60 días | 94 % | 2 % | 31 % |
| Saldo al acabar el año | 611 | 115.097 | 225.029 |

- **El catálogo dura unos 100 días** a un jugador diario, como estimaba la 0055.
- **Después la moneda no sirve.** El jugador diario acaba el año con 115.000 ≈ sin gastar.
- **La emisión directa cuadra con la 0055:** estimaba 150 ≈ al día y salen unos 135 en los primeros seis meses, más unos 70 en lotes de faradios de los cofres. Las misiones son la mayor fuente directa (71 ≈ al día).
- **Lo que no vio la 0055:** al completar el catálogo, cada pieza que saldría en un cofre se paga en faradios (40 a 800 ≈). Es la mayor fuente de moneda del juego a partir del cuarto mes: 69.000 ≈ en un año para el jugador diario.
- **El jugador ocasional está bien servido:** gasta casi todo lo que gana y no agota el catálogo.

### Cifras de la propuesta

| Qué | Hoy | Propuesta |
|---|---|---|
| Completar las 3 misiones del día | Cofre Chispa | 40 ≈ |
| Pieza de cofre de una rareza ya completa | Lote de 40 a 800 ≈ | El 25 % de ese lote |
| Apuestas | Contra la banca | Bote entre los dos, 10 % destruido |
| Tope de faradios ganados al día (sin contar cofres) | No hay | 400 ≈ |
| Edición de colección | No hay | Una a la semana, 1.200 ≈, desde el nivel 10 |
| Protector de racha | No hay | 150 ≈, con 3 días de racha o más |
| Repetir una misión | No hay | 30 ≈ |
| Comisión del mercado | No hay | 10 %, desde el nivel 10 |

### Lo que sale con la propuesta

| | Ocasional | Diario | Intenso |
|---|---|---|---|
| Faradios emitidos al día | 61 | 221 | 330 |
| Peso de la moneda en lo que recibe | 34 % | 57 % | 70 % |
| Completa el catálogo | No (73 %) | Día 255 | Día 208 |
| Gasta de lo que gana, últimos 60 días | 99 % | 92 % | 94 % |
| Saldo al acabar el año | 510 | 3.521 | 46.409 |

Objetivos que exige la prueba:

- la moneda pesa al menos la mitad de lo que recibe el jugador diario;
- pasado el año, el jugador diario gasta entre el 80 y el 95 % de lo que gana, y el intenso al menos el 80 %;
- el catálogo permanente dura al menos el doble que hoy;
- el jugador intenso gana más que el diario, pero menos del doble;
- las apuestas no crean faradios.

El saldo del jugador intenso (46.409 ≈) sale casi entero de ganar el 60 % de sus apuestas: son faradios de otros jugadores, no emitidos.

## Alternativas descartadas

- **Hoja de cálculo.** No puede sortear cofres con el catálogo real ni seguir las piezas que faltan, que es lo que decide cuándo se agota.
- **Medir a los jugadores reales primero.** Hace falta que el servidor registre cada movimiento de faradios: es la fase 1 de la 0055. Y hoy apenas hay jugadores.
- **Cargar `dist/progress.js` en el simulador** en vez de copiar sus cifras. Necesita la página (`$`, `localStorage`, eventos). Separar sus reglas de su pantalla es trabajo de la fase 1.
- **Una edición cada dos semanas a 900 ≈** (primer valor probado). El jugador diario seguía acumulando: gastaba el 34 % al final.
- **Mantener entero el lote por pieza repetida.** Con él no hay forma de que el gasto alcance a la emisión una vez completo el catálogo.

## Consecuencias

- **Las ediciones son el gasto principal** de la economía nueva: 57.900 ≈ al año para un jugador diario, frente a 10.300 ≈ en la tienda. Si no sale una edición cada semana que la gente quiera, la moneda vuelve a sobrar. Es un compromiso de producción de contenido: unas 52 piezas de colección al año.
- **El jugador ocasional no llega a las ediciones** (gana 61 ≈ al día y cuestan 1.200). Para él son el mercado y el catálogo permanente.
- **Son perfiles supuestos, no jugadores reales.** Cuántos duelos se juegan, cuánto se acierta y en qué se gasta son hipótesis. Cuando el servidor lleve el libro contable (fase 1), hay que comparar la emisión y el gasto reales con estas tablas y corregir los perfiles.
- **Lo que el simulador no cuenta:** premios de referidos y del autor de una pregunta (son puntuales), duelos contra el bot, empates, abandonos, medallas, la suscripción y los precios del mercado. La comisión del mercado se calcula sobre un volumen semanal supuesto (300 ≈ el jugador diario, 1.200 ≈ el intenso).
- El simulador no toca el juego, Supabase ni ningún servicio.
