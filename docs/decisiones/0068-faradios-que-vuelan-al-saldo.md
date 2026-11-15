# 0068. Los faradios recogidos vuelan hasta el saldo, con sonido de cobro

- **Estado:** propuesta (código en la rama `feat/faradios-vuelan-al-total`)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code

## Contexto

Al pulsar «Recoger» en una misión, el saldo de la esquina cambiaba de golpe y solo salía un aviso con «+20 ≈». El premio no se sentía. Los juegos de móvil (por ejemplo, el oro de Clash Royale al abrir cofres o cobrar recompensas) hacen lo contrario: el premio sale del botón como un puñado de monedas, se abre un instante y vuela en fila hasta el contador; cada moneda que llega suma, hace latir el contador y suena con un «tin» que sube de tono; el cobro acaba con un acorde. Ese conteo audible es lo que lo hace adictivo.

## Decisión

- Nuevo módulo `dist/coin-fly.js` (`CoinFly.fly`), reutilizable para cualquier cobro. Al recoger una misión:
  1. Salen de 5 a 14 monedas (más cuanto mayor es el premio) del botón pulsado y se abren en abanico.
  2. Tras una pausa corta, viajan una a una (55 ms entre ellas), en curva y acelerando, hasta la moneda del contador de faradios de la cabecera, encogiéndose un poco.
  3. Cada llegada suma su parte al número del contador, lo hace latir y suena una campanilla con un clic metálico, un paso más aguda que la anterior (escala pentatónica, para que no desafine aunque lleguen muchas seguidas).
  4. Con la última, el contador late más fuerte, suena un acorde ascendente con brillo y aparece «+N» bajo el contador.
- Los sonidos usan `tone`, `bell` y `noise` de `sound.js`, como los cofres y los duelos: sin archivos y con el mismo ajuste de silencio.
- Mientras vuelan, el contador enseña lo que van sumando aunque el perfil se redibuje (`coinShow` en `progress.js`). Un temporizador de respaldo asegura que acaba en el saldo real si la pestaña pasa a segundo plano.
- Con «reducir movimiento», no hay vuelo: el contador salta al saldo final con un latido y un tintineo.
- Funciona igual con y sin cuenta: con cuenta, el vuelo empieza cuando el servidor confirma la misión y devuelve el saldo.

## Alternativas descartadas

- **Archivos de audio** (monedas grabadas): más realistas, pero añaden peso y licencias; el juego genera todos sus sonidos con Web Audio.
- **Animar con CSS por clases:** las curvas de cada moneda son distintas y al azar; con la Web Animations API se calculan en JavaScript sin crear reglas CSS.

## Consecuencias

- De momento solo se usa al recoger misiones. Se puede extender a otros cobros (premio del reto, duelos, lote de cofres) llamando a `CoinFly.fly` con el botón de origen y el contador.
- Una capa `.coin-fly-layer` fija, por encima del perfil (`z-index: 200`) y sin recibir clics.
