# 0082. Duelos 1vs1vs1: partidas de tres

- **Estado:** propuesta (código en la rama `feat/duelo-1vs1vs1`; **sin migración**). Las reglas son una propuesta del agente: Luis solo dijo «1vs1vs1, partidas de 3», así que conviene que las revise antes de fusionar.
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0023](0023-duelos-1vs1.md) (duelos), la [0034](0034-dano-progresivo-en-duelos.md) (daño progresivo), la [0040](0040-chat-en-los-duelos.md) (chat), la [0042](0042-reconectar-a-la-partida.md) (reconectar), la [0044](0044-apuestas-en-duelos.md) y la [0060](0060-apuestas-en-bote.md) (apuestas) y la [0048](0048-calculo-y-sin-repetir-en-duelos.md) (sin repetir).

## Contexto

Un duelo hoy es de dos. Luis pidió, como idea suelta, «1vs1vs1, partidas de 3». Se añade como un modo más del duelo (`size: 3` en el estado guardado), sin tocar el 1vs1.

La tabla `duels` guarda el estado entero en una columna JSON (`state`) con la lista de jugadores, así que **no hace falta migración**: un duelo de tres es el mismo JSON con tres jugadores y un campo `size: 3`. Los duelos de dos no llevan el campo y se comportan exactamente como antes.

## Decisión

Las reglas son las del 1vs1 aplicadas a tres, con los mínimos cambios que hacen falta para que sea justo.

### Cómo se juega

- Los tres reciben la **misma pregunta a la vez**, con las mismas condiciones (6.000 de vida, 3 minutos por pregunta, 10 rondas como máximo, multiplicador de daño de la 0034).
- Cuando el primero responde, a los demás les quedan como mucho **30 segundos** (igual que hoy).
- Los puntos de cada respuesta son los de siempre (0–5.000 por distancia logarítmica).

### Cómo se reparte el daño

En cada ronda, **cada jugador pierde vida según lo que le falta para igualar al mejor de la ronda**:

`daño = (puntos del mejor − tus puntos) × multiplicador de la ronda`

- El mejor de la ronda no pierde nada; si dos empatan arriba, ninguno de los dos pierde.
- Con dos jugadores vivos es exactamente la fórmula del 1vs1, así que el duelo se parece al de siempre cuando quedan dos.
- Puede perder vida más de uno a la vez (el segundo y el tercero). Es el mayor cambio de ritmo: de media las partidas de tres son algo más cortas.
- Si nadie responde, todos puntúan 0 y nadie pierde vida (como hoy).

### Quién gana

- Quien llega a **0 de vida queda eliminado**; sigue viendo la partida pero ya no responde. Siempre queda al menos uno con vida (el mejor de la ronda no pierde).
- Gana el **último en pie**. Si pasan las 10 rondas, gana quien tiene **más vida**; si hay empate arriba, empatan esos jugadores (el tercero pierde).
- Puestos finales: primero el ganador; después los que siguen vivos por vida; después los eliminados, el que cayó más tarde mejor. Dos eliminados en la misma ronda comparten puesto.

### Abandono y desconexión

- **Abandonar** (botón de salir o cerrar el duelo) equivale a quedar eliminado con 0 de vida en ese momento: la partida **continúa entre los otros dos**. Si abandonan dos, gana el que queda. El que abandona no cobra premio ni experiencia de resultado, y pierde su parte del bote (como en el 1vs1: abandonar es perder).
- **Desconectarse** sin salir: igual que hoy, no hay detección de ausencia; quien no responde puntúa 0 en la ronda y los demás le quitan vida. Reconectar (0042) funciona igual: el duelo sigue y se vuelve a él.
- Mientras se espera el tercer jugador, quien se va (que no sea el creador) simplemente libera su sitio; si se va el creador, el duelo se cancela.

### Cómo se entra

- **Retar a amigos / código:** botón nuevo «Duelo de tres». Se crea con código y enlace; empieza cuando entran los dos que faltan.
- **Partida rápida:** busca solo duelos de tres en espera (los de dos y los de tres no se mezclan). Si nadie hay, se crea uno y se espera.
- **Sin Faraday-bot:** el bot solo juega 1vs1. «Practicar con el bot» no sale en los de tres.
- **Revancha:** el primero que la pide crea el nuevo duelo de tres; los otros dos se unen con «Aceptar revancha».
- **Sin repetir (0048):** se evitan las preguntas de los últimos 25 duelos de los tres jugadores.

### Clasificatorias

**No hay clasificatorias de tres.** El Elo (0043) mide a dos jugadores y repartirlo entre tres cambiaría el sistema. Un duelo de tres nunca es clasificatorio: `mode: ranked` se rechaza si se pide con tres.

### Premios, experiencia y misiones

- **Faradios:** gana el primero (15 ≈), quien empata arriba cobra lo del empate (8 ≈), el resto cobra lo de una derrota (5 ≈). Mismo tope diario que el 1vs1 (los tres primeros duelos del día al 100 %, después al 25 %) y mismos motivos en el libro contable (`duelos`), así que cuentan para el tope de ganancias diarias.
- **Experiencia y misiones:** igual que un duelo normal. «Jugar un duelo» cuenta con cualquier duelo de tres terminado; «Gana un duelo» solo si se gana (puesto 1 sin empate); las victorias de la semana, igual. Abandonar no cuenta.
- **Tope de 5 duelos al día del plan gratuito (0076):** un duelo de tres **cuenta como un duelo** (se comprueba al crear, buscar, unirse o pedir revancha, como siempre).

### Apuestas en bote (0060)

- **Hay bote si los tres apuestan**; cada uno pone la **más baja de las tres apuestas**. El bote es la suma. Si alguno no apuesta o no llega a poner su parte, el duelo va sin bote para todos (se devuelve lo puesto).
- **Gana el bote quien gana el duelo**, menos la comisión del 10 % del bote, que se destruye. Si empatan dos arriba, se reparten el bote (menos la comisión). Si empatan los tres, cada uno recupera lo suyo.
- Abandonar es perder el bote. Los demás topes de la 0060 (5 apuestas al día, etc.) siguen igual.
- El selector de apuesta del navegador explica «Bote entre los tres» cuando el duelo es de tres.

### Qué ve cada jugador

- **Marcador:** los tres avatares con nombre, nivel, medalla, apuesta y barra de vida; el tuyo marcado. Un eliminado se ve atenuado y tachado.
- **Presentación VS:** los tres, uno al lado de otro.
- **Pregunta:** una insignia ✓ por cada jugador que ya ha respondido y «X y Y ya han respondido».
- **Resultado de la ronda:** tres columnas con respuesta, puntos y daño recibido; destaca al mejor.
- **Final:** el puesto (1.º, 2.º o 3.º), la lista ordenada de los tres con su vida, y las rondas con los puntos de cada uno.
- **Chat (0040):** el mismo, para los tres; cada mensaje lleva el nombre de quien lo escribe. Las reacciones y frases son las mismas y el límite de ritmo es por jugador.
- **Reconectar (0042):** el aviso sigue siendo uno; dice «con A y B».

### Código

- `lib/duelos.mjs`: `size` en el estado, reparto de daño, eliminados, abandono y puestos para tres; `buscar`/`crear`/`revancha` con `size: 3`; vista con `size`, `damages`, `places`.
- `lib/premios.mjs`, `lib/apuestas.mjs`, `lib/comunidad.mjs`: premio y bote para tres.
- `dist/duel.js`, `dist/duel.css`/`styles.css`, `dist/bets-rules.js`, `dist/bets.js`, `dist/duel-chat.js`, `dist/reconectar.js`: pantallas de tres.
- `tests/duelos.test.mjs`, `tests/apuestas.test.mjs`, `tests/premios.test.mjs`: pruebas del modo.

## Alternativas descartadas

- **Dos vidas por pregunta (cada uno pelea solo contra el que tiene a la izquierda):** daría combates cruzados difíciles de leer en pantalla.
- **Que solo el peor pierda vida:** deja a los otros dos sin tensión y alarga mucho la partida.
- **Daño repartido a partes iguales entre los dos peores:** más complejo de explicar y no equivale al 1vs1 cuando quedan dos.
- **Clasificatoria de tres con Elo multijugador:** cambiaría el sistema de rangos (0043); si se quiere, es otra decisión.
- **Bote con reparto 60/30/10 entre los tres puestos:** más justo para el segundo, pero cambia la comisión y la pantalla de la 0060; se deja para después si el modo gusta.
- **Rellenar con Faraday-bot el sitio que falta:** el bot ya existe para practicar en solitario, y en tres mezclaría premios del bot con premios de personas.

## Consecuencias

- Sin migración: el estado ya es JSON. Un duelo de tres en la tabla es indistinguible a nivel de esquema de uno de dos (`size: 3` dentro de `state`).
- El daño total por ronda es mayor que en un 1vs1 (pueden perder vida dos jugadores a la vez); las partidas son algo más cortas. Se revisa con los primeros duelos reales.
- Preguntas abiertas para Luis: el premio del segundo puesto (hoy igual que el tercero), la clasificatoria de tres y si el bote debe repartirse entre dos puestos.
