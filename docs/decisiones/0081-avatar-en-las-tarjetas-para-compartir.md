# 0081. El avatar en las tarjetas para compartir, y una tarjeta para los duelos

- **Estado:** propuesta (código en la rama `feat/avatar-en-tarjetas`; sin migración)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0032](0032-tarjeta-para-stories.md) (tarjeta para stories) y la [0023](0023-duelos-1vs1.md) (duelos).
- **Número:** la 0080 está reservada para las piezas que solo se ganan (rama `feat/piezas-que-se-ganan`, PR 121).

## Contexto

Luis quiere que el avatar sirva para presumir, pensando en streamers e influencers. Un cosmético vale lo que vale su público, y el avatar casi no salía de la app: la tarjeta para stories del reto no lo llevaba, y al terminar un duelo «Compartir resultado» solo copiaba una frase. Es el segundo paso de la idea «El avatar como escaparate» (llega con la PR 121).

## Decisión

### El avatar, en la tarjeta del reto

La tarjeta de la 0032 lleva ahora el avatar del jugador, de cuerpo entero y tal como va vestido, abajo a la izquierda. Las marcas, la distancia media y «Juega en faraday.gg» se desplazan a la derecha. Lo demás no cambia: la cifra real sigue tapada.

### Tarjeta nueva para los duelos

«Compartir resultado», al terminar un duelo, abre la misma vista previa con una imagen de 1080 × 1920:

- El resultado en grande («¡VICTORIA!», «EMPATE» o «DERROTA») y contra quién.
- El avatar del jugador, grande, sobre un foco claro, con su nombre en una placa.
- Lo que se presume: el nivel, el rango (si el duelo fue clasificatorio y ya tiene rango, con su color) y la medalla destacada.
- Las rondas ganadas y perdidas, y la llamada: «¿Me ganas? faraday.gg» si ganó.
- Fondo dorado con rayos si ganó; cian si empató; coral si perdió.

El texto que la acompaña dice el resultado, el rival, las rondas, el rango y la medalla, y lleva el enlace del Circuito del jugador, como la tarjeta del reto.

### Código

- `dist/avatar3d.js`: `Avatar3D.shot(look, encuadre, ancho)` devuelve una foto fija del avatar en un lienzo (reutiliza las que ya se hacían para el marcador y la tienda).
- `dist/share-card.js`: el avatar en `draw`, y `drawDuel`, `duelText` y `openDuel`. La vista previa es la misma; al cerrarla, el foco vuelve al botón que la abrió.
- `dist/duel.js`: «Compartir resultado» abre la tarjeta; si `share-card.js` no ha cargado, comparte la frase de antes.
- `tests/tarjetas.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)): el resumen y los textos.

## Alternativas descartadas

- **Un clip de vídeo con el avatar bailando.** Es lo que mejor funcionaría en stories y TikTok, pero grabar el lienzo 3D a vídeo no va igual en todos los móviles (Safari) y los bailes aún no se eligen ([idea](../ideas/bailes-como-cosmeticos.md)). Queda para después.
- **El avatar en la cabecera, pequeño.** Cabe sin mover nada, pero a ese tamaño no se distingue la ropa, que es lo que se quiere enseñar.
- **El avatar del rival en la tarjeta de duelo.** Daría más contexto, pero enseña el avatar de otra persona en una imagen pública sin que lo haya decidido.
- **Enseñar la vida restante en vez de las rondas.** Las rondas se entienden sin conocer el juego.
- **Generar la imagen en el servidor.** Como en la 0032: pediría dependencias y el 3D ya está en el navegador.

## Consecuencias

- Si el 3D no ha cargado o el navegador no puede con él, las dos tarjetas salen sin avatar: la del reto, como antes; la de duelo, con el símbolo ≈ en su lugar.
- La foto del avatar mide como mucho 640 × 960 y en la tarjeta de duelo se amplía un poco: se ve bien, pero no es nítida al máximo.
- **El rango solo sale si el duelo fue clasificatorio**, porque es cuando el duelo lo trae. Tras un duelo normal no se enseña.
- La tarjeta enseña el nombre del rival tal como lo escribió.
- Sin probar en un iPhone ni en un Android reales, igual que la 0032.
- El dibujo no tiene pruebas automáticas: se ha mirado a mano en el navegador.
