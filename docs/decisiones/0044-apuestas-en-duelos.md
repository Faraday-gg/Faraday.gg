# 0044. Apuestas de faradios en los duelos 1 vs 1

- **Estado:** propuesta (código en la rama `feat/apuestas-duelos`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Relacionada con:** [0023](0023-duelos-1vs1.md) (duelos), [0024](0024-avatar-faradios-y-misiones.md) (faradios), [0027](0027-cofres.md) y [0036](0036-seis-cofres.md) (economía y riesgo con menores).

## Contexto

Luis pidió poder apostar faradios (≈) en cada duelo 1 vs 1, con tres niveles que se desbloquean al llegar al nivel 10. Antes de decidir la mecánica se miró dónde viven los faradios:

- **Solo en el navegador** (`localStorage`, clave `casi-casi:progreso`, [0024](0024-avatar-faradios-y-misiones.md)). La cuenta opcional ([0022](0022-inicio-de-sesion-desde-el-servidor.md)) guarda las respuestas diarias, no los faradios. El servidor no sabe cuántos tiene nadie.
- Lo que se gana hoy: un duelo da 15 ≈ ganado, 8 empatado y 5 perdido (los tres primeros del día); un día normal de juego, 100–150 ≈; subir de nivel, 30 ≈ y un cofre. Lo que cuesta: piezas de 40 a 2.000 ≈, cofres de 120 ≈ (Chispa) a 2.500 ≈ (Faraday).
- El nivel 10 pide 4.500 XP: varias semanas de juego diario.

## Decisión

### Mecánica: cada uno contra la banca

Cada jugador apuesta lo suyo contra la «banca», no contra su rival:

| Resultado | Qué pasa con la apuesta |
|---|---|
| Gana | Recupera la apuesta y la banca le da otro tanto (+apuesta) |
| Pierde | La pierde (−apuesta) |
| Abandona | Igual que perder |
| Empate | La recupera (±0) |
| Su rival abandona | Gana |

Se elige esta y no el bote común (los dos ponen lo mismo y el ganador se lo lleva) porque **el servidor no conoce los saldos**: un bote común obligaría a guardar los faradios en el servidor o a fiarse de lo que diga cada navegador sobre el del otro. Con la banca cada navegador solo mueve sus propios faradios, como ya hacen las pistas ([0039](0039-pistas.md)) y los cofres. Además, cada uno puede apostar lo que quiera (o nada) sin ponerse de acuerdo con el rival.

### Niveles y cantidades

| Apuesta | Faradios | Se desbloquea | En la ficha |
|---|---|---|---|
| **Chispazo** | 25 ≈ | Nivel 10 | Un rayo |
| **Calambre** | 60 ≈ | Nivel 12 | Dos rayos |
| **Alto voltaje** | 150 ≈ | Nivel 15 | Tres rayos |

- **Escalonadas** (10, 12 y 15): la primera llega en el 10, como pidió Luis, y las más fuertes cuando ya se tiene rodaje y saldo. Así el nivel 10 no abre de golpe la posibilidad de perder 150 ≈ por duelo.
- **Cantidades:** Chispazo es menos que dos duelos ganados; Calambre, la mitad de un cofre Chispa; Alto voltaje, lo que da un día de juego. Ninguna rompe la tienda: lo más que se puede perder en un día (5 × 150 = 750 ≈) no llega a un cofre Tormenta (1.100 ≈).
- **Tope diario: 5 duelos con apuesta al día** (hora de Madrid). Limita la pérdida y el farmeo con dos navegadores propios. `DAILY_CAP = 0` en `dist/bets-rules.js` desactiva las apuestas.
- El premio normal del duelo (XP, faradios, batería) no cambia: la apuesta va aparte.
- Por debajo del nivel 10 el selector se ve con candado y el texto «Se desbloquea en el nivel 10»; cada ficha dice su nivel. Las partidas clasificatorias que se preparan en otra rama usan el mismo umbral (nivel 10): conviene presentarlas juntas como «lo que se abre en el nivel 10».

### Contra trampas evidentes

- **Se cobra al empezar**, cuando el duelo pasa a «en juego» (pantalla VS), no al terminar. Abandonar o cerrar la pestaña no salva la apuesta.
- **Un apunte por duelo** en el registro (`localStorage`, clave `casi-casi:apuestas`): no se puede apostar dos veces en el mismo duelo ni cobrar dos veces el mismo resultado. Un apunte liquidado no vuelve a pagar.
- **Recuperación:** si se cierra la página con una apuesta abierta, al volver se pregunta al servidor cómo acabó el duelo y se liquida (si ya no existe, se da por perdida).
- **Solo lo que se tiene:** si el saldo no llega, la ficha se ve desactivada («No te llega»); si al empezar el duelo ya no llega, se juega sin apuesta y se avisa.
- **Contra Faraday-bot no se apuesta:** el servidor anula la apuesta en los duelos con el bot. Si no, practicar con un rival predecible sería una fuente de faradios.
- **El servidor valida el nivel:** solo guarda la apuesta si el nivel que manda el jugador llega (`lib/apuestas.mjs`) y la enseña al rival junto al nombre. Los importes se leen siempre de la tabla del código, no de lo guardado.

### Interfaz

- En el portal del duelo, debajo del perfil: cuatro fichas (Sin apuesta, Chispazo, Calambre, Alto voltaje) con sus rayos, la cantidad y lo que se gana; el saldo y las apuestas que quedan hoy. En el móvil se ponen en dos filas de dos.
- Durante el duelo, una ficha con el rayo y la cifra junto al nombre de cada jugador (marcador y pantalla VS).
- En la pantalla final, «+60 ≈» o «−25 ≈» en grande, la explicación (doblas, la pierdes, la recuperas, abandonar cuenta como perder) y el saldo nuevo. Debajo se puede cambiar la apuesta para la revancha o el nuevo rival.

### Código

- `dist/bets-rules.js`: tabla de niveles, desbloqueo, comprobación de saldo y tope, cobro y liquidación. Sin pantalla, se prueba con Node.
- `dist/bets.js` y `dist/bets.css`: selector, ficha, resultado, registro y recuperación.
- `lib/apuestas.mjs`: validación en el servidor y la regla del bot.
- Cambios pequeños en `lib/duelos.mjs` (el perfil guarda `bet` y la vista lo devuelve), `dist/duel.js` (cinco llamadas a `Bets`) y `dist/index.html` (scripts y hoja de estilos).
- `tests/apuestas.test.mjs`.
- **Sin migración:** la apuesta va dentro del `state` (jsonb) de la tabla `duels`, que ya existe.

## Alternativas descartadas

- **Bote común entre los dos jugadores.** Necesita que el servidor guarde los saldos o se fíe del navegador del rival. Además obliga a que los dos apuesten lo mismo. Se puede reconsiderar cuando los faradios pasen al servidor con las cuentas.
- **Liquidar en el servidor.** Sin saldos en el servidor no hay nada que liquidar allí; el servidor solo dice quién ganó.
- **Cobrar al terminar.** Bastaría con cerrar la pestaña al ir perdiendo para no pagar.
- **Apostar contra el bot.** Ver arriba.
- **Las tres apuestas en el nivel 10.** Más sencillo, pero abre de golpe la apuesta más alta a jugadores con poco saldo.

## Consecuencias

- **Es una apuesta**, aunque con moneda de juego que no se compra con dinero. Con menores jugando, el riesgo de la [0027](0027-cofres.md) crece: el tope diario y el nivel 10 lo limitan. Si llegan quejas o antes de vender faradios, lo primero es poner `DAILY_CAP = 0`.
- **Esperanza cero entre iguales:** entre dos jugadores igual de buenos, la banca no gana ni pierde de media. Un buen jugador sí sacará faradios; el tope diario lo acota a 750 ≈ al día.
- **Se puede hacer trampa** editando `localStorage`, como con el resto del progreso. También dos navegadores propios pueden jugar entre sí y dejar ganar a uno: el tope diario lo limita.
- Si al empezar el duelo el saldo ya no llega (algo raro: se comprobó al elegir), el rival verá una apuesta que en realidad no se cobró.
- La recuperación necesita que el duelo siga en la tabla `duels`; si algún día se limpian los duelos viejos, una apuesta abierta muy antigua se dará por perdida.
