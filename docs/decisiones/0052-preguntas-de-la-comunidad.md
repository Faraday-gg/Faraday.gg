# 0052 — Preguntas de la comunidad y progreso en la cuenta

- **Fecha:** 2026-11-14
- **Quién:** Luis, con Claude Code
- **Estado:** propuesta (rama `feat/preguntas-comunidad`; la migración `20261114120000_preguntas_comunidad` está **sin aplicar**)
- **Modifica:** la generación diaria de la [decisión 0017](0017-jornada-diaria-generada-con-openai.md) (los lunes), los faradios de la [0024](0024-avatar-faradios-y-misiones.md) (con cuenta, también en el servidor) y la cuenta de la [0022](0022-inicio-de-sesion-desde-el-servidor.md)

## Contexto
Luis quiere que los jugadores propongan preguntas, que se voten y que cada lunes salgan en el reto diario las 3 mejores de la semana. La IA busca la respuesta y explica cómo se llega a ella, para que todo el mundo lo vea al responder. Pidió además:

- Que los votos se paguen con **faradios**, para sacar moneda de la economía y frenar a los bots.
- **Moderación automática**, sin revisión a mano.
- Que la pregunta salga con el **nombre y el avatar** de su autor.
- Que solo voten las personas **con cuenta** y que los faradios se guarden **en su cuenta, no solo en su ordenador**.

Hasta ahora los faradios solo vivían en el `localStorage` del navegador: el servidor no conocía el saldo de nadie, así que no podía cobrar un voto (cualquiera podía escribirse 99.999 ≈ desde la consola).

## Decisión

### Rondas
- La ronda R es el **lunes en que se publican** sus ganadoras. Admite propuestas y votos del **domingo R−8 al sábado R−2** (hora de Madrid).
- El **domingo R−1 a las 00:01** el cron que ya genera la jornada de mañana (`pg_cron` y el de Vercel como respaldo) crea la jornada del lunes con las más votadas de la ronda R. Desde ese domingo ya está abierta la ronda R+7.
- Se cierra el sábado y no el domingo para no tener que añadir otro cron: la jornada de cada día se genera la noche anterior.

### Reglas (`RULES` en `lib/comunidad.mjs`)
| Qué | Cuánto |
|---|---|
| Proponer | 50 ≈ |
| Votar | 10 ≈ por voto, una vez por pregunta, nunca la propia |
| Propuestas por jugador y ronda | 3 |
| Premio al autor si su pregunta sale | 200 ≈ |
| Votos mínimos para salir | 1 |

- Las propuestas que no salen **no devuelven** los faradios: es la salida de moneda que se buscaba.
- La pantalla está en el menú: «Preguntas de la comunidad». Sin cuenta se ven las propuestas, pero para proponer o votar se pide entrar.

### Moderación automática
- Al proponer, `gpt-5-mini` (sin búsqueda web; se cambia con `OPENAI_MODERATION_MODEL`) rechaza lo ofensivo, lo sexual o violento, las tragedias, la política partidista, los datos personales, la publicidad y lo que no tiene **una sola cifra comprobable**. Si la rechaza, **no se cobra** y el jugador ve el motivo. Si la acepta, solo corrige la ortografía.
- Antes se hacen comprobaciones básicas, sin IA: longitud, que no lleve enlaces y que empiece por «¿» y acabe en «?».
- Sin `OPENAI_API_KEY` (servidor local y Preview) solo se hacen las comprobaciones básicas.

### Resolución con IA
- Se mandan las 6 más votadas a OpenAI con búsqueda web, en una sola llamada. Para cada una devuelve una pregunta completa del juego: cifra, fuentes, `math`, cálculo por pasos (`calc`) y razonamiento. Es lo que el jugador ve después de responder en «Cómo se calcula», igual que en las jornadas generadas.
- Cada pregunta pasa la misma validación que las de la IA (`validateQuestion` de `lib/generar.mjs`) y la comprobación de que sus fuentes existen. Si una no se puede resolver, se pasa a la siguiente más votada.
- Si salen menos de 3, se completa con las preguntas del banco editorial de esa fecha. Si no queda ninguna, ese lunes se genera la jornada de siempre.
- Cada pregunta lleva `author` (nombre y piezas del avatar, guardados al proponer) y `community` (votos). El reto los enseña encima de la pregunta y en el resultado.
- Al guardar la jornada, cada propuesta se marca como `publicada` y el autor recibe su premio en el saldo de la cuenta.

### Progreso en la cuenta (faradios en el servidor)
- Con sesión iniciada, `dist/progress.js` sube el progreso entero (nivel, avatar, misiones, cofres, medallas…) a `POST /api/progreso` cada vez que cambia, con un segundo y medio de espera para agrupar cambios. En otro dispositivo se recupera al entrar. Se guarda **en los dos sitios**: el navegador sigue funcionando sin conexión.
- **El saldo lo lleva el servidor** (columna `coins` de `player_progress`). El navegador no manda su saldo, sino **cuánto ha cambiado** desde la última confirmación. Lo que se gasta (tienda, pistas, apuestas, cofres) siempre se resta. Lo que se gana se acepta hasta **1.500 ≈ por día** (un jugador diario gana 100–150). La primera vez que se sube, como mucho 5.000 ≈.
- Votar y proponer cobran en la base de datos (funciones `community_vote` y `community_propose`). Así el mismo saldo no se puede gastar dos veces con dos peticiones a la vez. El navegador aplica después el saldo que devuelve el servidor.
- **Qué manda al entrar:** si la cuenta ya tiene progreso y en ese navegador había otra cuenta (o ninguna), o si el de la cuenta es más reciente, manda el de la cuenta. Si no, se sube el del navegador.
- **Al cerrar sesión**, el navegador empieza de cero (sin regalo de bienvenida), como ya pasaba con las respuestas. El progreso queda en la cuenta.

## Alternativas descartadas
- **Votos gratis con tope semanal.** Más sencillo, pero Luis prefirió los faradios para regular la economía.
- **Exigir cuenta sin guardar los faradios en el servidor.** La cuenta frena las cuentas en masa, pero el navegador podía inventarse el saldo.
- **Calcular todo el saldo en el servidor** a partir de lo que se gana (respuestas, duelos, misiones, cofres…). Sería lo más seguro, pero obliga a pasar al servidor toda la economía, que hoy está en el navegador. Es mucho trabajo; el tope diario cubre el caso de los bots.
- **Revisar a mano las 3 ganadoras.** Luis prefirió que fuera automático.
- **Cerrar la votación el domingo y generar el lunes a las 00:01.** Habría que crear la jornada del mismo día con gente ya jugando, y añadir otro cron.
- **Una pregunta de la comunidad al día de lunes a miércoles.** Luis eligió el lunes entero.

## Consecuencias
- Hay que **aplicar la migración** `20261114120000_preguntas_comunidad` en Supabase (producción, único entorno) antes de fusionar en `main`. Sin ella, `/api/comunidad` y `/api/progreso` responden 503 y el resto del juego sigue funcionando.
- La moderación usa la misma `OPENAI_API_KEY`. Cada propuesta es una llamada pequeña a `gpt-5-mini`, y cada domingo hay una llamada grande con búsqueda web.
- El tope de 1.500 ≈ al día puede quedarse corto en un día excepcional (subir varios niveles y abrir cofres legendarios). Lo que pase del tope no se pierde en el navegador, pero el servidor no lo acepta. Revisar con datos reales.
- Quien entra en una cuenta nueva en un navegador donde ya se cerró otra sesión empieza con 0 ≈ (no hay segundo regalo de bienvenida).
- Los jugadores sin cuenta siguen igual, con todo en su navegador.
- Las preguntas de los jugadores son contenido público: el filtro de la IA puede equivocarse. Si se cuela algo, se puede marcar la propuesta como `descartada` en Supabase antes del domingo.
