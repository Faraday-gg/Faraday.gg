# 0029. Tarjeta para stories al compartir el resultado del día

- **Estado:** propuesta (código en la rama `feat/tarjeta-stories`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Número:** se reservó la 0028, pero ya la usaba el avatar de mujer. Las tres mejoras de esta tanda corren un número: esta es la 0029, el momento «¡Casi casi!» la 0030 y las ligas de amigos la 0031.

## Contexto

«Compartir» solo copiaba un texto («Mi distancia media: 2,3×» y los tres multiplicadores). No tenía imagen ni gancho, y en Instagram, donde se comparte casi todo, un texto no se puede subir a stories. Era el mayor freno para que el juego se difunda. Luis aprobó tres mejoras para la difusión que se hacen en paralelo: esta tarjeta, el momento «¡Casi casi!» y las ligas de amigos.

## Decisión

Al pulsar «Compartir» en el resumen del día se abre una vista previa con una imagen vertical de 1080 × 1920 (formato de stories), dibujada en un `<canvas>` en el propio navegador, y dos botones: «Compartir» y «Descargar».

**Qué lleva la imagen** (`dist/share-card.js`):

- Cabecera con la marca Faraday.gg, el número del reto, el día de la semana y la fecha.
- Una pregunta destacada: si alguna respuesta quedó a menos de 1,1× (un «¡Casi casi!»), la más cercana; si no, aquella en la que el jugador se quedó más lejos. Lleva su foto si la tiene, con el autor y la licencia en pequeño; sin foto, el icono de la categoría. La pregunta se lee entera: la letra se reduce hasta que cabe.
- «Yo dije: X unidad» al lado de un bloque que **tapa la cifra real** («La real · ? ? ? · ¿Cuántas son de verdad?»). La tarjeta no destripa la respuesta: invita a jugar para descubrirla.
- Una marca por pregunta según el multiplicador: diana (🎯) por debajo de 1,1×, verde (🟩) por debajo de 1,5×, amarilla (🟨) por debajo de 3× y roja (🟥) el resto. En la imagen se dibujan como formas propias, para que se vean igual en todos los sistemas; en el texto van como emojis.
- La distancia media del día, en Geist, y la llamada «Juega en faraday.gg».
- El fondo es el color de la categoría de la pregunta destacada (decisión 0018). Si hubo un «¡Casi casi!», la tarjeta es **dorada**, con rayos y la etiqueta «¡CASI CASI!». Se calcula aquí con la misma fórmula de distancia; no depende de la otra mejora.
- Lo importante queda a más de 200 px de los bordes de arriba y abajo, que Instagram tapa con su interfaz.

**Texto que acompaña a la imagen** (sin cifras reales): `Faraday.gg · Nº 96 · Jueves 12 de noviembre`, la fila de emojis, la distancia media, «¿Te acercas más que yo?» (o «¡Casi casi! Clavé una.») y «Juega en faraday.gg».

**Cómo se comparte:**

- Si el navegador puede compartir archivos (`navigator.canShare({files})`, casi todos los móviles), «Compartir» abre la hoja del sistema con el PNG y el texto: desde ahí se sube a stories, WhatsApp, etc.
- Si no (la mayoría de navegadores de escritorio), «Compartir» copia el texto y descarga la imagen; «Descargar» solo la descarga (`faraday-AAAA-MM-DD.png`).
- Si `share-card.js` no llegara a cargar, `app.js` sigue compartiendo el texto de antes.

**Fotos y CORS:** la imagen se pide con `crossOrigin="anonymous"`. Las fotos de Supabase Storage responden con `Access-Control-Allow-Origin: *` (comprobado), así que se pueden dibujar y exportar. Si una foto falla o deja el lienzo «manchado», la tarjeta se repite sin foto.

**Accesibilidad:** la vista previa es un `<dialog>` modal con título, foco en «Compartir» al abrir y vuelta del foco al botón «Compartir» del resumen al cerrar. Escape cierra solo la vista previa, no el juego. La imagen tiene un texto alternativo que describe la tarjeta (pregunta, tu respuesta, marcas y media). Los avisos se escriben dentro del diálogo (`role="status"`), porque el aviso general de la página queda tapado por el modal. Con «reducir movimiento» el diálogo aparece sin animación; la tarjeta es estática.

**Organización del código:** toda la lógica vive en `dist/share-card.js` y sus estilos en `dist/share-card.css`. En `app.js` solo cambia la primera línea de `shareResult`, para reducir conflictos con las otras dos mejoras, que tocan los mismos archivos.

## Alternativas descartadas

- **Generar la imagen en el servidor** (una función de Vercel que devuelva un PNG): necesita una librería de dibujo o de fuentes (el proyecto no tiene dependencias de npm) y gasta tiempo de función. En el navegador ya están las fuentes y los datos.
- **Imagen cuadrada para el feed**: el uso esperado son las stories; se puede añadir otra variante más adelante.
- **Enseñar la cifra real**: haría la tarjeta más informativa, pero destripa la pregunta a quien la vea antes de jugar y quita el motivo para entrar.
- **Emojis dibujados como texto en el lienzo**: cada sistema los pinta distinto (o no los pinta); se dibujan formas propias.
- **Enlace con vista previa (Open Graph) por resultado**: necesita guardar el resultado en el servidor. Queda como idea si la tarjeta funciona.

## Consecuencias

- «Yo dije» puede dar una pista muy buena cuando la respuesta destacada es un «¡Casi casi!» (está a menos de un 10 % de la real). Se acepta: es justo el momento que se quiere presumir, y la cifra exacta sigue tapada.
- La tarjeta solo se ha visto en el navegador del agente (Chromium, escritorio y ancho de móvil). Falta comprobar en un iPhone y en un Android reales que la hoja del sistema ofrece Instagram con la imagen y el texto.
- Si se cambian los colores de categoría en `styles.css` o en `categories.js`, hay que cambiarlos también en `TONES` de `share-card.js`.
- Revisar cuando haya datos: cuántas personas comparten y si el tráfico de stories trae jugadores nuevos.
