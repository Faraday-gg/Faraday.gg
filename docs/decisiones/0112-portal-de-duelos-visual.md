# 0112. Portal de duelos más visual

- **Fecha** · 2026-11-21.
- **Estado** · Implementada.
- **Cambia** · la portada de los duelos ([duelos 1 vs 1](0023-duelos-1vs1.md), [duelo de tres](0082-duelos-1vs1vs1.md), [clasificatorias](0043-clasificatorias-y-rangos.md) y [apuestas](0044-apuestas-en-duelos.md)).

## Problema

La portada de los duelos era casi todo texto: un titular de dos líneas, el perfil, la apuesta bloqueada, el selector «Normal / Clasificatoria» con otra tarjeta bloqueada debajo, dos botones, la caja del duelo de tres con otros dos, dos enlaces y las reglas en frases. Con nivel bajo, la mitad de la pantalla eran candados repetidos y no se entendía bien qué modos había ni cuál era el principal.

## Decisión

Se toma el patrón de los juegos de móvil con partidas rápidas (Clash Royale, Brawl Stars, Preguntados, Chess.com): un botón enorme para jugar ya y el resto de modos como fichas grandes con icono y color.

- **Perfil compacto** arriba: avatar en círculo con el lápiz para editarlo, apodo editable, nivel con su barra y fichas de victorias, derrotas y racha.
- **Partida rápida** como escenario principal: tu avatar contra un «?», una sola frase con la regla y el botón «Jugar». En modo clasificatoria la tarjeta cambia a mostaza, se titula «Clasificatoria» y el botón dice «Buscar rival».
- **Fichas de modo** en rejilla de dos (de cuatro en pantallas anchas), con los colores de las categorías: «Con amigos», «Duelo de tres» (con la banda «Nuevo»), «Práctica» contra Faraday-bot y «Clasificatoria». Por debajo del nivel 10 la clasificatoria sale apagada, con candado y la barra del nivel que falta; desde el 10, esa ficha pasa a «Tengo un código» y arriba aparece el selector de modo con la tarjeta del rango, como antes.
- **Con amigos** abre una hoja inferior (`<dialog>`) con «Retar a un amigo», «Retar a dos amigos» y el campo del código. Así desaparecen de la portada tres botones y el enlace «¿Tienes un código de duelo?». Los errores al unirse salen dentro de la hoja.
- **Apuestas:** si están bloqueadas, una sola línea «Apuestas en el nivel 10» en vez de la tarjeta; desbloqueadas, el selector de siempre bajo la partida rápida.
- **Reglas** como tres iconos (vida, tiempo por pregunta, tiempo si responde el rival) y el detalle en «¿Cómo se juega?», plegado.
- Los botones tienen un «labio» inferior y se hunden al pulsarlos.

No cambia ninguna acción ni llamada al servidor: los botones siguen usando `data-duel` (`quick`, `quick3`, `friend`, `friend3`, `practice`) y la oferta común de Plus (`data-duel-plan`) sigue en su sitio.

## Alternativas descartadas

- **Elegir modo y luego un único «Jugar»** (como Clash Royale): añade un paso a cada modo y obliga a explicar el modo elegido; con cinco modos, que la ficha ya lance la partida es más directo.
- **Mantener el selector «Normal / Clasificatoria» bloqueado**: dos elementos para decir lo mismo que un candado en una ficha.

## Archivos

`dist/duel.js` (`renderLobby`, hoja de amigos e iconos), `dist/duel-lobby.css` (nuevo), `dist/ranked.js` (`paint` cambia el título y el botón de la tarjeta principal) y `dist/index.html`.
