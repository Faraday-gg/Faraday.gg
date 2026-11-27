# 0127. Tiempo límite en todos los modos

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-27
- **Quién:** Luis, con Claude

## Contexto

El reto diario, el archivo, Traza y Archivo Vivo no tenían límite de tiempo, y un duelo daba 3 minutos por pregunta. Luis pide un tiempo «ni muy rápido ni muy lento» en todos los modos, porque sin él la gente busca la respuesta en internet.

## Decisión

Criterio: lo justo para leer, pensar, usar la calculadora y escribir; no lo bastante para buscarlo y comprobarlo.

| Modo | Tiempo |
| --- | --- |
| Duelo de estimación (1 contra 1, de tres, clasificatoria y práctica) | 60 s por pregunta; 20 s para los demás cuando alguien responde |
| Duelo de Ascensión | 25 s; 10 s tras la primera respuesta |
| Duelo de Traza y de Archivo Vivo | 45 s; 15 s tras la primera respuesta |
| Reto diario, días del archivo y reto extra | 90 s por pregunta |
| Traza la tendencia | 45 s por gráfica |
| Archivo Vivo | 45 s por foto |
| Ascensión | 25 s (ya los tenía) |
| Póker del Salón | 30 s por turno (ya los tenía) |

- **En los duelos manda el servidor.** Los tiempos de cada juego están en `lib/duelos-juegos.mjs`, viajan en la vista (`rules`) y el navegador los pinta sin valores propios.
- **Reloj común** `window.RoundTimer` (`dist/round-timer.js`) para el reto, Traza y Archivo Vivo: cuenta hacia una fecha de fin guardada por ronda, así que recargar, volver a la portada o abrir el día desde el archivo no lo reinicia. Avisa en color a los 10 s, con sonido a los 5 y por voz solo a los 30, 10 y 5 s.
- **Reto diario al agotarse:** si hay una cifra escrita, se envía; si no, la pregunta queda **sin respuesta**. No se inventa una cifra, no se envía nada al servidor y el día queda **sin media**: no cuenta para la racha, el premio ni las ligas (es lo que ya hace el servidor con un día sin tres cifras). El borrador se guarda en cada pulsación para no perder la cifra por salir de la pantalla.
- **El reloj del reto solo se pausa durante el anuncio de una pista**, con un tope de 60 s por pregunta.
- **Traza al agotarse:** el trazo a medias se completa en horizontal; sin trazo, 0 puntos.
- **Archivo Vivo al agotarse:** cuenta el año marcado si se tocó el selector; si no, 0 puntos. Aquí el plazo lo lleva el servidor: empieza cuando el navegador avisa de que ha enseñado la foto (`archivo-ver`) y admite 3 s de gracia.

## Alternativas descartadas

- **Penalización fija (100×) para la pregunta sin respuesta:** obligaba a enviar una cifra inventada y ensuciaba la distribución de la comunidad.
- **Empezar el plazo de Archivo Vivo al servir la partida:** rompía la reanudación de una partida al cambiar de día.
- **Línea plana como trazo por defecto en Traza:** puntuaría.
- **Tiempos más cortos en el reto** (60 s): las preguntas de estimación piden un cálculo en varios pasos y hay calculadora y bloc.

## Consecuencias

- **El reloj del reto diario, del archivo y de Traza solo lo aplica el navegador.** El servidor no sabe cuándo se mostró la pregunta: quien llame a la API a mano o borre los datos del navegador tiene más tiempo. Hacerlo cumplir en el servidor exige guardar cuándo se sirvió cada ronda (migración); queda en [mejoras](../mejoras/README.md).
- **Una sola pregunta sin cifra deja el día sin media y sin racha.** Es coherente con el servidor, pero es duro: Luis debe confirmar si es lo que quiere.
- En otro dispositivo, una pregunta vencida sin respuesta se vuelve a abrir (el servidor solo conoce las cifras enviadas).
- Los años de Archivo Vivo siguen viajando en `dist/archivo-vivo-rondas.js`: el reloj frena buscar en internet, no leer el código.
