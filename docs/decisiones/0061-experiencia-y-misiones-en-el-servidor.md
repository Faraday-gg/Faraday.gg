# 0061. El servidor lleva la experiencia, el nivel y las misiones

- **Estado:** propuesta (código en la rama `feat/misiones-y-nivel-servidor`, montada sobre `feat/apuestas-en-bote`; la migración `20261115130000_experiencia_y_misiones` está **sin aplicar**)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la entrega 3c de la fase 1 ([0059](0059-premios-de-los-duelos-en-el-servidor.md)).

## Contexto

Tras las entregas 2, 3a y 3b, el servidor paga el reto, el archivo, los duelos y las apuestas. Quedaban dos cosas que el navegador seguía declarando: los faradios de las **misiones** y el premio por **subir de nivel**.

Para pagarlas, el servidor tiene que saber cosas que hasta ahora no guardaba: cuánta experiencia tiene el jugador y cómo van sus misiones de hoy y de la semana.

## Decisión

- **El servidor lleva la experiencia de quien tiene cuenta** (`player_progress.xp`) con las mismas reglas que el navegador (`lib/misiones.mjs`). Se entera de tres cosas, y de ahí sale todo:

  | Qué ocurre | Cuándo se entera el servidor | Experiencia |
  |---|---|---|
  | Una respuesta | Al guardarla (`POST /api/answers`) | 5 |
  | Una jornada completada | Al cobrar su premio (0058) | 30 la de hoy, 10 la del archivo |
  | Un duelo terminado | Al cobrar su premio (0059) | La de `dist/duel.js`: victoria, primera del día, racha, rondas, tope diario y bot |
  | Una misión recogida | Al recogerla | 10 |

- **Premio por nivel:** al cruzar un nivel, el servidor paga 30 ≈ con un apunte `nivel` y la referencia `nivel-N`. Cada nivel se paga una vez.
- **Misiones:** el servidor lleva los contadores del día y de la semana (`player_progress.stats`) y sortea las misiones con la misma función que el navegador, así que son las mismas. Recoger una (`POST /api/progreso`, `action: 'mision'`) comprueba que está completa, la paga (15 a 80 ≈, apunte `misiones`) y no deja recogerla dos veces.
- **`action: 'estado'`** devuelve la experiencia, el nivel y cómo van las misiones según el servidor.
- **El navegador ya no puede declarar los motivos `misiones` y `nivel`.**
- **La primera vez** se parte de la experiencia que declara el navegador, con un tope de 45.000 XP (nivel 30). Los niveles que ya tenía no se pagan otra vez: van en su saldo inicial.
- **El navegador sigue pintando** la barra de nivel y las misiones con su propia cuenta, y dando los cofres (el de nivel y el de completar las tres misiones). Eso pasa al servidor en la entrega 4.
- Sin cuenta, todo sigue igual.

### Las entregas de la fase 1

| Entrega | Estado |
|---|---|
| 1. Libro contable | Hecha (0057) |
| 2. Reto del día y archivo | Hecha (0058) |
| 3a. Duelos | Hecha (0059) |
| 3b. Apuestas en bote | Hecha (0060) |
| **3c. Misiones y nivel** | Esta |
| 4. Cofres, tienda y pistas | Pendiente |
| 5. Cierre: migrar saldos y piezas y dejar de aceptar ganancias declaradas | Pendiente |

Tras esta entrega, el navegador solo puede declarar: `bienvenida`, `cofres`, `cofres-compra`, `tienda`, `pistas`, `referidos` y `otros`.

### Código

- `lib/misiones.mjs` (nuevo): reglas de experiencia, nivel y misiones, sin almacén.
- `supabase/migrations/20261115130000_experiencia_y_misiones.sql`: columnas `xp`, `stats` y `stats_version` en `player_progress`.
- `lib/comunidad.mjs`: `withStats`, las acciones `estado` y `mision`, y la experiencia al cobrar jornadas y duelos. `lib/stores.mjs`: `stats` y `saveStats`. `lib/api.mjs`: avisa de cada respuesta. `lib/premios.mjs`: el premio del duelo dice también el resultado y las rondas.
- `dist/progress.js`: con cuenta, «Recoger» pregunta al servidor y el premio por nivel no se suma en el navegador.
- `tests/misiones.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Sacar la experiencia del libro contable.** El libro solo apunta faradios; la experiencia de un duelo depende de las rondas y de la racha, que no están ahí.
- **Contar las respuestas al cobrar la jornada**, sin tocar `/api/answers`. Ahorra una lectura por respuesta, pero una misión como «Queda a menos de 2×» se completa con la primera respuesta y el jugador la querría recoger antes de acabar el reto.
- **Que la experiencia del servidor sustituya a la del navegador en pantalla.** Los cofres de nivel los da el navegador al ver subir su propia experiencia; cambiarla desde fuera los descuadraría. Se hará con la entrega 4.
- **Una función de base de datos para sumar experiencia.** El servidor ya usa en los duelos el guardado con versión (solo guarda si nadie cambió la fila), y evita escribir más SQL sin poder probarlo.

## Consecuencias

- **Una lectura más por respuesta.** `POST /api/answers` consulta si el jugador tiene cuenta, también para quien juega sin ella. Si falla, la respuesta se guarda igual.
- **Dos cuentas de experiencia.** La del navegador (lo que se ve) y la del servidor (lo que paga). Usan las mismas reglas, pero pueden separarse: si se juega con dos dispositivos, o si se respondió antes de entrar en la cuenta. Entonces el nivel que se ve y el que paga el servidor no coinciden, o «Recoger» responde que la misión aún no está completa. Se unifican en la entrega 4.
- **El nivel para apostar** (0060) sigue saliendo del que dice el navegador; el servidor ya tiene el suyo y se puede usar en la entrega 4.
- **Tres migraciones pendientes, en orden:** `20261114120000_preguntas_comunidad`, `20261115120000_libro_contable` y `20261115130000_experiencia_y_misiones`. Sin la tercera, los premios de jornadas y duelos se siguen pagando, pero no hay experiencia ni misiones en el servidor (y recoger una misión con cuenta falla).
- **El SQL no se ha ejecutado contra un Postgres real**, como el de la 0057.
- Hay que aceptar antes la PR de la entrega 3b: esta rama parte de la suya.
