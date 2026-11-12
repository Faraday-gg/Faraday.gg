# 0038. Menú lateral rediseñado y logo que vuelve al inicio

- **Estado:** propuesta
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

> Nota: el número 0038 ya lo usa [0038-circuito-de-amigos.md](0038-circuito-de-amigos.md). Se mantiene porque fue el número asignado a esta tarea; conviene renumerarla al fusionar si se quiere evitar la duplicidad.

## Contexto

El menú lateral ([0016](0016-menu-y-archivo-en-calendario.md)) había ido creciendo con cada función nueva (duelos, ligas, Circuito, perfil, cuenta). Eran botones-tarjeta grandes, todos iguales y apilados, con emojis sueltos alineados a la derecha (⚔ 🏆 ⚡ ≈), mucho aire y sin jerarquía. En escritorio parecía una columna de móvil estirada. A Luis no le gustaba ni en móvil ni en escritorio.

Además, el logo «≈ Faraday.gg» no hacía nada: en las cabeceras de juego era `aria-hidden` y no había forma de volver al inicio desde él.

## Decisión

### Menú

- **El reto de hoy, destacado arriba:** una tarjeta coral (como la de la portada) con «Reto de hoy», el número, un título que cambia según el progreso («Tres preguntas nuevas», «Te quedan 2 preguntas», «Reto completado») y la fecha, con una flecha a la derecha. Si ya se jugó, la tarjeta pasa a papel.
- **El resto, como lista compacta por secciones:** «Juega» (Duelo 1 vs 1, Ligas con amigos, Invita amigos) y «Tú» (Avatar, misiones y medallas; cuenta), cada una en una tarjeta con separadores finos. Cada fila lleva a la izquierda un icono SVG en línea (24×24, trazo 1,8, mismo tamaño para todos) sobre un cuadrado con un tono de la paleta, título, subtítulo corto y una flecha discreta.
- **Títulos de sección** pequeños, en mayúsculas espaciadas y con una línea, y «El archivo» se queda igual debajo.
- **«Volver al inicio»** (solo dentro del juego) pasa a ser una píldora discreta encima del reto.
- **Estados** de hover, pulsado, foco (anillo hacia dentro para que no lo corte el scroll) y desactivado. Entrada escalonada de los bloques al abrir, que se desactiva con `prefers-reduced-motion`.
- **Escritorio (≥ 720 px):** panel flotante de 372 px separado 12 px de los bordes, con esquinas redondeadas, sobre la página oscurecida y desenfocada. **Móvil:** ocupa todo el alto y deja 40 px de página oscurecida a la derecha para tocar y cerrar.
- Se mantienen todos los destinos, los atributos `data-open-*` y `data-auth-open`, los `id` que usan otros scripts (`menu-account-label`, `menu-account-hint`, `menu-today`, `menu-home`, `menu-archive`), el cierre con Esc y el foco al abrir (va al reto de hoy) y al cerrar (vuelve al botón de menú).

### Logo

- El logo de la portada, el del menú y los de las cabeceras de juego (`game-brand` del reto, duelo, ligas, Circuito y perfil) son enlaces `<a href="/" data-go-home aria-label="Ir al inicio">`.
- Al pulsarlos, `goHome()` (en `dist/app.js`) cierra el menú y las pantallas abiertas de arriba abajo **usando el cierre propio de cada una** (perfil, Circuito, ligas, duelo y juego). En un duelo en curso se respeta la confirmación «¿Abandonar el duelo?»: si se cancela, no se cierra nada más. El juego se cierra con `closeGame()` (que usa `history.back()`), así que el botón «atrás» sigue funcionando igual. Después sube al principio de la portada y deja el foco en el logo.
- Con Ctrl, Cmd, Mayúsculas o Alt el enlace se comporta como un enlace normal (abre la portada en otra pestaña).

## Alternativas descartadas

- **Rejilla de iconos grandes:** más vistosa, pero sin sitio para el subtítulo y peor para leer qué hace cada cosa.
- **Emojis o una fuente de iconos:** los emojis cambian según el sistema y no casan entre sí; una fuente de iconos sería una dependencia nueva. Los SVG en línea son pocos y sin coste.
- **Navegar a `/` de verdad al pulsar el logo:** recargaría la página y, en un duelo, saltaría la confirmación de salida.

## Consecuencias

- Una función nueva en el menú necesita su fila con icono SVG del mismo trazo, tono (`data-tone`: `coral`, `yellow`, `blue` o `ink`) y subtítulo corto.
- Si se añade otra pantalla a pantalla completa con `game-brand`, hay que incluirla en `goHome()` para que el logo la cierre.
