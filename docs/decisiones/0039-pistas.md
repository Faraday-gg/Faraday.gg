# 0039. Pistas: una por pregunta, con faradios o con un anuncio

- **Estado:** propuesta (código en la PR de `feat/pistas`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

## Contexto

Luis pidió poder pedir **una pista en cada pregunta**, pagando muchos puntos o viendo un anuncio. De los anuncios, de momento solo la interfaz: se integrarán de verdad más adelante.

Limitaciones:

- los «puntos» del juego son los faradios (≈), que viven en el navegador ([0024](0024-avatar-faradios-y-misiones.md)). Un jugador diario gana unos 100–150 al día, y el cofre más barato (Chispa) cuesta 120;
- hay 21 preguntas piloto, el archivo y la jornada diaria generada con OpenAI ([0017](0017-jornada-diaria-generada-con-openai.md)): escribir una pista a mano para cada una no escala;
- todas las preguntas traen ya la respuesta en el navegador y casi todas un razonamiento (`reasoning.heading` y `steps`), que el generador exige.

## Decisión

- **Qué dice la pista.** Sale de lo que ya trae la pregunta, sin contenido nuevo:
  1. **Entre qué potencias de 10 está la respuesta**: «La respuesta está entre 10.000 y 100.000 toallas». Las cifras grandes van en palabras («entre 1.000 millones y 10.000 millones de croquetas»).
  2. **Por dónde empezar**: el título del razonamiento («Primero la plaza, luego la toalla»), si lo hay. No se enseñan los pasos, que ya traen cifras.
- **Dónde.** Una por pregunta en el reto del día y en el archivo. **No en los duelos**: son a contrarreloj y contra otra persona.
- **Cómo se pide.** Botón con una bombilla junto al de la calculadora. Abre una ventana con dos opciones:
  - **Usar 100 ≈.** Si no llegan, el botón sale desactivado y dice cuántos faltan.
  - **Ver un anuncio.** Un anuncio con recompensa: solo hay pista si se ve entero. Si se cierra antes, no hay pista.
- **El anuncio, de momento, es simulado** (`dist/ads.js`): una ventana «Publicidad» con un hueco rayado («Aquí irá el anuncio»), una barra y una cuenta atrás de 15 s, y el botón «Ver la pista» al acabar. La interfaz avisa de que es de prueba. Quien lo usa llama a `Ads.rewarded()`, que devuelve una promesa con `true` (visto entero) o `false` (cerrado o fallido). **Para poner anuncios reales solo hay que cambiar `ads.js`.**
- **Al desbloquearla** la pista aparece bajo el título sin borrar lo que se haya escrito, y se recuerda en el navegador (`casi-casi:pistas`): al volver a la pregunta sigue ahí. En el resultado, junto a la unidad, pone «con pista».
- `progress.js` gana `Progress.spend(cantidad)` para gastar faradios fuera de la tienda. El evento `faraday:answer` lleva `hint: true` si la pregunta tenía pista, y al desbloquearla se lanza `faraday:hint`.

## Alternativas descartadas

- **Escribir una pista por pregunta** (campo `hint` en el contenido): mejores pistas, pero obliga a rellenar todo el archivo y a cambiar el generador. Se puede añadir más adelante: si la pregunta trae su propia pista, se enseñaría esa.
- **Enseñar el primer paso del razonamiento**: casi siempre trae el dato clave («unos 50.000 m²») y resuelve media pregunta.
- **Varias pistas por pregunta, cada una más cara**: Luis pidió una. Se puede ampliar.
- **Quitar puntos del resultado al usar pista**: ya se paga por ella; penalizar dos veces la haría inútil.
- **Guardar la pista en el servidor**: no hace falta para que funcione y obligaría a una migración. Los faradios ya se guardan en el navegador.

## Consecuencias

- La pista es generosa: saber el orden de magnitud deja la respuesta a menos de 10×. Por eso cuesta 100 ≈, casi lo que da un día de juego.
- **Lo que cuenta igual con o sin pista:** las misiones, el «¡Casi casi!», las medallas, la distribución de respuestas, las ligas y la tarjeta para stories. Solo el resultado propio dice «con pista». Si se ve que la pista desequilibra las ligas o las medallas, se puede usar `hint` del evento `faraday:answer` para excluirlas, o mandarlo al servidor.
- Los anuncios reales necesitarán: un proveedor (y su script, que hoy no existe), consentimiento de cookies y publicidad, límite de anuncios al día y revisar el riesgo con menores que ya señala la [0027](0027-cofres.md). Habrá que documentarlo en una decisión nueva.
- Como el resto del progreso, todo esto se puede falsear tocando `localStorage`.
