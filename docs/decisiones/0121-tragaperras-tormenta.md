# 0121. Tragaperras «Tormenta»: rejilla con caídas, esferas y tiradas gratis

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-23
- **Quién:** Luis, con Claude

## Contexto

La tragaperras del Salón ([decisión 0116](0116-salon-casino-de-prueba.md)) eran tres rodillos con un símbolo cada uno: tres iguales o los dos primeros. Luis quiere que se parezca a las máquinas de vídeo de los casinos de hoy, con animaciones y sonido que enganchen, y pone de referencia las de rejilla con premios «en cualquier sitio», caídas y multiplicadores.

## Decisión

- **Juego propio, «Tormenta»**, con tema de electricidad (el de Faraday). Se toma la mecánica del género, no el nombre, los personajes ni los dibujos de ningún juego existente: los símbolos están dibujados para este proyecto en `dist/casino-slots.js`.
- **Rejilla de 6 columnas por 5 filas, sin líneas.** Un símbolo paga si sale 8 veces o más, esté donde esté, con tres tramos de premio (8–9, 10–11, 12 o más). Hay cinco gemas y cuatro símbolos altos (imán, bombilla, bobina y corona).
- **Caídas.** Los símbolos premiados desaparecen, los de arriba caen, entran otros y se vuelve a pagar mientras haya premio.
- **Esferas con multiplicador** (×2 a ×100). Al acabar las caídas, si la tirada tiene premio, se suman y lo multiplican. Sin premio no hacen nada.
- **Tiradas gratis.** Con 4 chispas o más se ganan 10. En ellas hay más esferas y el multiplicador se acumula de una tirada a la siguiente. Con 3 chispas durante las gratis se ganan 5 más, hasta 30.
- **Premio máximo:** 500 veces la apuesta, el mismo tope que el crash.
- **Retorno:** alrededor del 92 %, como la tragaperras anterior. No sale de una fórmula: se mide con una simulación de 300.000 jugadas en `tests/casino.test.mjs`, que falla si se sale del 88–96 %. Las tiradas gratis salen de media una vez cada 240 jugadas.
- **Fichas y límites de la 0116:** de 5 a 100 faradios de prueba por jugada y 500 de pérdida diaria. La jugada se resuelve y se cobra al pulsar; la pantalla solo la reproduce.
- **Animación y sonido.** Los símbolos caen por columnas con rebote, los premiados laten y estallan, las esferas descargan una a una en el multiplicador, el premio sube contando y los premios de 10 veces la apuesta o más tienen su pantalla con lluvia de monedas. El sonido se genera con `dist/sound.js` (sin archivos): golpe de cada columna, campanillas que suben de tono con cada caída, trueno al multiplicar y fanfarria en los premios grandes.
- **Las reglas están en `STORM`** (`dist/casino-rules.js`) y la pantalla en `dist/casino-slots.js`. Desaparecen `SYMBOLS`, `PAIR`, `pull`, `slots` y `slotsReturn`.

## Lo que no se ha hecho a propósito

Luis pidió que enganche. Se ha hecho con ritmo, respuesta inmediata y premios vistosos, pero dejando fuera lo que en las máquinas reales empuja a perder el control, aunque aquí se juegue con faradios de prueba:

- **No hay giro automático.** Cada jugada es una pulsación.
- **No se celebra un premio menor que la apuesta.** Si vuelven 4 de 10, se dice así («Vuelven 4 de 10») y no suena fanfarria.
- **No se fabrican «casi premios».** La rejilla que se ve es la que ha salido. La pausa de tensión antes de las últimas columnas solo ocurre cuando de verdad falta una chispa para las tiradas gratis.
- **El resultado no depende de saltarse la animación** ni del modo rápido.

## Alternativas descartadas

- **Rodillos mecánicos clásicos de una línea** (tres rodillos, uno o dos créditos). Son los de la lista que pasó Luis, pero se parecen a lo que ya había y dan poco juego en pantalla.
- **Recrear un juego concreto.** No se copia un juego comercial: ni nombre, ni arte, ni tabla de pagos.
- **Motor gráfico (canvas o WebGL) para la rejilla.** Con 30 casillas, el DOM y las transiciones de CSS bastan y no añaden dependencias.

## Consecuencias

- El resultado se decide en el navegador, como el resto de juegos individuales de la prueba: no sirve para nada que tenga valor.
- Una jugada con tiradas gratis dura medio minuto y no se puede salir del juego hasta que acaba; el botón de girar pasa a «Saltar» y la termina al instante.
- La invitación a Plus se muestra bajo la máquina al acabar la jugada, nunca durante ella.
- Las cinco máquinas de la sala enseñan la rejilla en su pantalla y el rótulo pasa a ser «Tormenta».
