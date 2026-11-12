# 0030. Momento «¡Casi casi!»: celebrar las respuestas a menos de 1,1×

- **Estado:** propuesta (código en la rama `feat/momento-casi-casi`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

> **Número:** iba a ser la 0029, pero la 0028 ya estaba ocupada en `preprod` (avatar de mujer) y las mejoras para hacer correr el juego se corrieron un número. Al fusionar `preprod`, la 0029 resultó ocupada por «Cómo se calcula» por pasos; esta sigue siendo la 0030.

## Contexto

Luis aprobó tres mejoras para que el juego se comparta más, hechas en paralelo: una tarjeta para stories, ligas de amigos y esta, un momento de celebración cuando una respuesta sale casi exacta. En qué se apoya:

- **Moneda social** (Jonah Berger, *Contagious*): se comparte lo que hace quedar bien. Clavar una cifra es un logro que apetece contar, y más si casi nadie lo consigue.
- **Regla del pico y el final** (Daniel Kahneman): de una experiencia se recuerdan sobre todo el momento más intenso y el final. Una celebración clara en el mejor momento de la partida hace que se recuerde mejor.
- **Estimar con precisión es raro** (Alpert y Raiffa, 1982): incluso con intervalos amplios la gente falla mucho más de lo que cree. Quedarse a menos de un 10 % es de verdad poco habitual, así que el premio no se devalúa.

Límites: juegan menores, así que nada de presión temporal ni castigos ([0024](0024-avatar-faradios-y-misiones.md), [0027](0027-cofres.md)); la distribución de los demás es simulada mientras haya menos de 30 respuestas reales y no se pueden inventar cifras ([0014](0014-distribucion-simulada-y-cifras.md)); no hay dependencias ni cuentas.

## Decisión

- **Qué cuenta:** una respuesta del reto diario o del archivo con multiplicador **por debajo de 1,1×** (exacto incluido; 1,1× justo no). La regla vive en `dist/casi.js` (`CasiCasi.is`).
- **La tarjeta de respuesta cambia** (`dist/casi.js`, `dist/casi.css`): borde y brillo dorados, sello grande «¡CASI CASI!» con el número de «Casi casi» del jugador, y un sonido propio generado con Web Audio (`Sound.casi` en `dist/sound.js`: dos notas que suben, un acorde y un destello). El sonido respeta el silencio de todo el juego. La celebración entera (destello, brillo que cruza la tarjeta, sello que cae y sonido) solo sale al responder; al volver a abrir la pregunta el sello aparece quieto. Con «reducir movimiento» no hay ninguna animación: el sello y el borde se ven directamente.
- **Dato social:** debajo del sello, «Solo el X % lo ha clavado hoy», con la distribución real que ya carga la tarjeta. La API (`lib/api.mjs`, `distribution`) devuelve un campo nuevo, `near`: cuántos de los demás jugadores quedaron a menos de 1,1×. Variantes: «Nadie más lo ha clavado hoy», «Menos del 1 %», y por encima del 50 % se quita el «Solo». En el archivo se quita el «hoy». **Con la muestra simulada no hay porcentaje**: se dice «¡Lo has clavado! Aún hay pocas respuestas para saber cuántos más lo han hecho.»
- **Contador permanente** en el progreso (`dist/progress.js`, campo nuevo `casi: {n, ids}` dentro de `casi-casi:progreso`). Cuenta una vez por pregunta (se guardan los identificadores de las últimas 300; el total sigue creciendo). Un progreso guardado antes de esta versión empieza en 0 y no se rompe nada. Se ve en el perfil, bajo el nivel: «🎯 N «Casi casi» · X más para la sudadera exclusiva».
- **Pieza exclusiva:** la **Sudadera «Casi casi»** (negra, diana y «1,1×» en dorado delante, «CASI CASI» a la espalda), una para cada cuerpo, se desbloquea **gratis al llegar a 10 «Casi casi»**. Usa el mismo mecanismo que las piezas por nivel: precio 0 y una condición (`casi: 10` en vez de `level`) que comprueba `owns()`. No se compra, no sale en cofres (los cofres solo sortean piezas con precio) y en la tienda se ve con el candado «10 «Casi casi»». Al conseguirla, un aviso: «¡10 «Casi casi»! Nuevo: Sudadera «Casi casi»».
- **Duelos:** solo un indicador pequeño «¡Casi casi!» junto al multiplicador de cada jugador en la revelación de la ronda. **No suma al contador**: así no se puede subir jugando contra el bot y el contador mide lo mismo para todo el mundo (las preguntas del día y del archivo).
- **Enganches mínimos** en archivos compartidos, para no chocar con las otras dos mejoras: `app.js` pasa el identificador de la pregunta en `faraday:answer` y llama a `CasiCasi.card` al pintar la tarjeta; `community.js` emite `faraday:distribucion` con la distribución (o `null` si es simulada), que puede aprovechar también la tarjeta para stories.

## Alternativas descartadas

- **Umbral de 1,25×** (el de la misión «Clava una»): demasiado frecuente para ser un momento especial; 1,1× deja la misión como paso intermedio.
- **Calcular el porcentaje en el navegador con los `bins`** del histograma: los cubos son demasiado anchos (1/32 de varias décadas) para separar el 10 %. Un contador en el servidor es exacto y barato.
- **Porcentaje también con la muestra simulada** (marcado como simulación): un «Solo el 4 %» sobre datos inventados es justo lo que la 0014 quiere evitar, y es la frase que más se compartiría.
- **Contar los duelos:** inflaría el contador contra el bot y mezclaría preguntas repetidas.
- **Que la pieza salga también en cofres o se pueda comprar:** dejaría de ser una prueba de habilidad, que es lo que la hace enseñable.
- **Racha de «Casi casi» o un tope por tiempo:** añade presión, y juegan menores.

## Consecuencias

- El contador vive en el navegador, como el resto del progreso: se puede editar a mano y no viaja entre dispositivos (igual que en la 0024).
- Los identificadores de pregunta son únicos por jornada; si algún día se reutilizara una pregunta, no contaría dos veces.
- La API devuelve un campo más (`near`); no cambia el esquema de Supabase ni hay migración.
- Prueba nueva `tests/casi.test.mjs` (regla, contador, compatibilidad del guardado, dato social y pieza) y caso nuevo en `tests/community.test.mjs` (`near`).
- Revisar con datos reales cuántas respuestas quedan a menos de 1,1×: si fueran muchas más de un 10 %, subir la exigencia.
