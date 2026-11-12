# 0033. El avatar reacciona en el reto diario y los aciertos se celebran

- **Estado:** propuesta (código en la rama `feat/avatar-reacciones`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0028](0028-avatar-de-mujer-y-animaciones.md) (animación del avatar) y la [0012](0012-tarjeta-de-respuesta-clara.md) (tarjeta de respuesta). Cambia de la 0012 un detalle: entre 1,1× y 1,9×, la etiqueta «Te pasaste» / «Corto» pasa a decir «¡Muy cerca!». Convive con la [0030](0030-momento-casi-casi.md) (momento «¡Casi casi!», menos de 1,1×), que entró en `preprod` mientras se hacía esta: ver «Convivencia con el momento ¡Casi casi!».

## Contexto

El avatar solo aparecía en la portada, el perfil y los duelos. En el reto diario, que es lo que más se juega, no estaba, y acertar o fallar por mucho se veía igual: el multiplicador cuenta y nada más. Luis pidió el avatar a la izquierda de cada pregunta, nervioso mientras se responde, con un gesto distinto según lo lejos que quede la respuesta (desmayo con vuelta incluida a partir de 100×), y una recompensa con animación y sonido al acertar por menos de 1,9×.

## Decisión

### El avatar junto a la tarjeta

- Un solo avatar animado (`#game-avatar`, dentro de la tarjeta del reto) que se conserva de una pregunta a otra. En pantallas anchas va a la izquierda de la tarjeta, de pie a la altura de su borde inferior; cuando no hay sitio (móvil, o con el bloc abierto) se sube encima de la tarjeta, en pequeño. Lo decide una consulta de contenedor sobre el ancho libre, no sobre la ventana.
- Encuadre nuevo `stage` en `dist/avatar3d.js`: cuerpo entero en un lienzo cuadrado, con sitio a los lados para que quepa tumbado.
- `dist/app.js` avisa con el evento `faraday:view` de lo que acaba de pintar (pregunta, resultado, resumen o cierre). `dist/reactions.js`, archivo nuevo, decide qué hace el avatar, qué suena y qué se ve. `Avatar3D.react(el)` cambia el estado de un avatar ya dibujado.

### Estados y gestos

| Momento | Qué hace |
|---|---|
| Respondiendo | Nervioso: se mece de un pie a otro, se muerde las uñas, mira a los lados y da golpecitos con el pie |
| El multiplicador está contando | Las dos manos en la boca y los ojos como platos, pendiente de la tarjeta |
| Menos de 1,1× | **Clavada** (el «¡Casi casi!» de la 0030): giro en el aire y tres botes con los brazos arriba; se queda celebrando |
| De 1,1× a menos de 1,9× | **Acierto:** salto; se queda celebrando |
| De 1,9× a menos de 5× | **Por poco:** echa el puño hacia abajo y da un pisotón |
| De 5× a menos de 10× | **Lejos:** se encoge de hombros con las palmas hacia fuera |
| De 10× a menos de 20× | **Fallo:** se tapa la cara con la mano y niega |
| De 20× a menos de 100× | **Desastre:** manos a la cabeza, se tambalea y acaba hundido |
| 100× o más | **Desmayo:** se marea, da una vuelta sobre sí mismo, cae redondo y se queda tumbado |

- El avatar reacciona cuando el multiplicador termina de contar, no antes: así no destripa la cifra.
- Al repasar una respuesta ya dada se queda con el ánimo que le tocó (tumbado incluido), sin gesto, sonido ni confeti. En el resumen, el ánimo sale de la media del día.
- Para estos gestos el avatar gana ojos que se abren, boca que se tuerce hacia abajo y la posibilidad de tumbarse entero.

### Convivencia con el momento «¡Casi casi!»

La 0030 ya celebra las respuestas a menos de 1,1× con su sello, su destello y su sonido (`dist/casi.js`). Para no celebrar dos veces lo mismo:

- **Por debajo de 1,1× manda la 0030.** Esta decisión solo añade el gesto del avatar (clavada) y el confeti, con dos estallidos y lluvia. No suena nada propio (ni los clics del contador ni el acorde) y la etiqueta no cambia.
- **De 1,1× a menos de 1,9× manda esta decisión**, con todo lo que sigue. La etiqueta dice «¡Muy cerca!» y no «¡Casi casi!», que queda reservado para la 0030.
- El tramo de la clavada toma su límite de `CasiCasi.LIMIT`, así que si la 0030 cambia el umbral, este lo sigue.

### Recompensa al acertar (de 1,1× a menos de 1,9×)

- **Sonido en tres capas**, hecho con `dist/sound.js` (sin archivos): un golpe grave que da peso, un arpegio mayor rápido que sube y una campana que se queda sonando.
- **Cada acierto seguido en el mismo día suena un tono más alto** que el anterior. Tres de tres suena como una escalera que sube.
- **Antes del resultado, en todas las respuestas salvo la clavada:** clics que suben de tono y se espacian mientras el multiplicador cuenta, como una ruleta que frena.
- **Lo que se ve:** el multiplicador da un bote con un anillo que se abre, la etiqueta cae como un sello, confeti desde la cifra y un pulso en la tarjeta.
- **Los fallos también suenan, sin castigar:** dos notas blandas, un «mmm», el trombón triste en el desastre y, en el desmayo, un silbido que cae, el golpe contra el suelo (la tarjeta se sacude) y pajaritos.
- En móviles con vibración, un toque corto al acertar y otro al caer.
- **Botón de sonido** en la barra del reto. El ajuste es el mismo que el de los duelos y los cofres.
- Con «reducir movimiento» activado no hay gestos ni confeti: el avatar cambia de postura y la etiqueta cambia sin animación. El sonido se mantiene.

### En qué se apoya el diseño del sonido

No se ha hecho un análisis nuevo de aplicaciones para esta decisión. Se aplican patrones conocidos de juegos y aplicaciones con buena respuesta al acierto, tal como los recuerda el agente, sin enlaces que lo respalden: el acierto corto y ascendente de dos o tres notas (Duolingo), el tono que sube con cada acierto seguido (Candy Crush, Peggle, Balatro), el contador que hace clic mientras suma (tragaperras, puntuación de GeoGuessr), la campana final que se deja sonar y el golpe grave que da peso al momento. Lo propio del proyecto: todo generado en el navegador, triangulares y senoidales suaves como en los duelos y los cofres, y celebración proporcional al acierto, como la fanfarria de los cofres ([decisión 0027](0027-cofres.md)).

## Alternativas descartadas

- **Reaccionar nada más confirmar.** Más inmediato, pero el gesto adelanta el resultado antes de que la cifra termine de contar.
- **Avatar solo en escritorio.** En móvil no hay hueco a la izquierda; se prefirió subirlo encima de la tarjeta, aunque ocupe unos 100 px de alto.
- **Archivos de audio.** Sonarían mejor, pero el proyecto no tiene archivos de sonido ni dependencias, y habría que revisar licencias.
- **Castigar el fallo con sonidos estridentes.** Los fallos gordos se llevan al humor (desmayo, trombón), no a la bronca.

## Consecuencias

- El reto diario suena por defecto. Quien ya había silenciado los duelos o los cofres lo tiene silenciado también aquí.
- En móvil la tarjeta baja unos 100 px para dejar sitio al avatar. Hay que verlo en un teléfono real con el teclado abierto.
- Hay un avatar animado más en pantalla durante el reto (el de la portada no se dibuja mientras el juego la tapa).
- Con gorros altos o peinados muy voluminosos, la cabeza puede salirse un poco del lienzo al tumbarse.
- En la clavada, el sello y el sonido de la 0030 salen al pintar la tarjeta, y el avatar y el confeti cuando el multiplicador termina de contar (algo menos de un segundo después). Habrá que verlo a velocidad real y decidir si se acompasan.
- Los tramos y sus gestos están en `TIERS` (`dist/reactions.js`) y el umbral de acierto en `HIT` (`dist/app.js`): tienen que coincidir (1,9).
- Sin pruebas automáticas: gestos, sonido y confeti solo se han comprobado en el navegador, con reloj simulado. Los sonidos no se han escuchado: falta que Luis los oiga y diga si el volumen y el carácter convencen.
