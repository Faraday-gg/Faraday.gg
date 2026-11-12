# 0031. Ligas de amigos con clasificación semanal

- **Estado:** propuesta (código en la PR de `feat/ligas-amigos`; la migración `20261112120000_ligas` está **sin aplicar**)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

## Contexto

Luis aprobó tres mejoras para que el juego se comparta más: una tarjeta para stories (0029), el momento «¡Casi casi!» (0030) y esta, las ligas de amigos. La idea se apoya en el *efecto N* (Garcia y Tor, 2009): cuantas menos personas compiten, más se esfuerza cada una. Un ranking global con miles de jugadores no motiva a casi nadie; una liga con tu grupo de WhatsApp, sí.

Limitaciones: Supabase solo se usa desde el servidor ([0002](0002-acceso-a-supabase-solo-desde-el-servidor.md)), se juega sin registro con un identificador anónimo ([0009](0009-jugador-sin-registro-con-cookie.md)) y el inicio de sesión es opcional ([0022](0022-inicio-de-sesion-desde-el-servidor.md)). Los duelos ([0023](0023-duelos-1vs1.md)) ya resolvieron cómo guardar estado compartido: memoria en local, tabla en Supabase y 503 si la tabla no existe.

Los números de decisión reservados (0028 tarjeta, 0029 «Casi casi», 0030 ligas) chocaban con la 0028 del avatar de mujer, que entró antes en `preprod`, y después también con la 0029 del cálculo por pasos. Las tres sesiones acordaron correr un número y esta usa la **0031**; la tarjeta y «Casi casi» tendrán que elegir números libres al fusionar.

## Decisión

- **Crear y unirse.** «Crea tu liga» pide un nombre corto (hasta 24 caracteres) y genera un código de 6 caracteres y el enlace `?liga=CÓDIGO`, que se comparte con `navigator.share` (en el móvil abre WhatsApp y compañía; si no hay, se copia). Quien abre el enlace ve el nombre de la liga y cuántos son, y entra con un toque. También se puede escribir el código. El apodo es el mismo de los duelos y el avatar, el del armario.
- **Límites.** Máximo **15 personas** por liga (lo comprueba el servidor y, por si dos entran a la vez, un disparador de la base de datos). Cada jugador puede estar en **10 ligas** a la vez como mucho. Se puede salir de una liga; la liga que se queda vacía se borra.
- **Clasificación semanal**, de lunes a domingo en hora de Madrid, con la **distancia media del reto diario** de cada miembro (1× es exacto; gana la media más baja).
- **Solo cuenta el reto del día jugado ese día.** Cuando alguien completa el reto de hoy, el servidor calcula su distancia media a partir de las respuestas guardadas y la apunta en `daily_results`. El navegador no manda puntuaciones. Lo que se juega desde el archivo no se apunta. Se apunta para todos los jugadores, estén o no en una liga, para que quien se une un jueves no pierda lo que jugó el lunes.
- **Regla de los días sin jugar** (la misma para todos y explicada en la propia pantalla):
  - Un día ya cerrado que no jugaste cuenta como **la peor distancia de ese día entre los miembros de la liga que sí lo jugaron, y nunca menos de 10×**. Así saltarse un día nunca sale mejor que jugarlo, y un mal día de otro no te salva.
  - **Hoy** solo cuenta para quien ya lo ha jugado. A medianoche se cierra y se aplica la regla anterior.
  - **La primera semana de una liga empieza el día en que se crea**: los días anteriores no cuentan para nadie. Quien entra después sí recibe la regla desde ese día (y le cuenta lo que jugó antes de entrar).
  - La media semanal es la media de todos los días contados. Empate: gana quien jugó más días; si siguen empatados, comparten puesto.
  - Quien entra en una liga después de que acabe una semana no aparece en la clasificación de esa semana.
- **Resumen del lunes.** Al abrir la app en una semana nueva, si estabas en alguna liga la semana anterior, se enseña quién ganó (con su avatar y una corona) y en qué puesto quedaste. Se enseña una vez por semana y nunca encima de una partida.
- **Entrada discreta.** Un enlace «🏆 Ligas con amigos» bajo el botón del duelo en la portada y otro en el menú. No añade ningún paso al reto diario.
- **Servidor.** `lib/ligas.mjs` con la ruta `POST /api/liga` (acciones `mias`, `crear`, `unirse`, `ver`, `salir`, `perfil` y `resumen`). En local se guarda en `runtime/ligas.json`, junto a las respuestas; en Vercel, en las tablas `leagues`, `league_members` y `daily_results` (migración `20261112120000_ligas`). El jugador se identifica como en los duelos: SHA-256 de su identificador anónimo, que con sesión iniciada es el de su cuenta. Los apodos y nombres de liga se limpian de HTML. Nadie ve el identificador de otro.

## Alternativas descartadas

- **Ranking global.** Es justo lo que el efecto N desaconseja: con muchos jugadores casi todos quedan lejos de los primeros y dejan de intentarlo.
- **Contar solo los días jugados** (media de lo que juegas). Premia jugar solo los días fáciles o retirarse tras un buen comienzo.
- **Penalización fija de 10× sin mirar la liga.** Si alguien juega muy mal (50×), le saldría mejor no haber jugado. Por eso el castigo es la peor distancia del día, con 10× como mínimo.
- **Sumar puntos en vez de medias.** Habría que inventar una escala de puntos para el reto diario, que hoy se mide en distancias. La media en «×» es la misma cifra que el jugador ya ve al acabar.
- **Calcular desde `answers.created_at`.** Funcionaría en Supabase, pero el archivo local no guarda la hora de cada respuesta. Una tabla pequeña con el resultado del día vale para los dos y evita leer todas las respuestas de la semana en cada consulta.
- **Guardar la liga en un solo `jsonb`, como los duelos.** Buscar «las ligas de este jugador» dentro de un `jsonb` es más difícil con PostgREST; con una tabla de miembros basta un filtro y un índice.

## Consecuencias

- **Hasta que se aplique la migración, las ligas no funcionan en Vercel**: la API responde 503 y la web muestra «Las ligas no están disponibles ahora mismo». El reto diario sigue guardando respuestas aunque falle el apunte del resultado. En local funcionan sin base de datos.
- Al completar el reto de hoy hay una lectura más (las respuestas de ese jugador) y una inserción en `daily_results`. Ver la clasificación lee la liga con sus miembros y sus resultados de la semana.
- Las Preview de Vercel comparten las tablas con producción ([0001](0001-supabase-un-solo-entorno.md)).
- El nombre de la liga y el apodo los escribe el jugador y los ven los demás miembros. Se limpian de HTML, pero no hay filtro de palabras.
- Trampas posibles: igual que en el reto diario, alguien puede buscar la respuesta o crear identificadores nuevos. Las respuestas de los días pasados son públicas, pero el archivo no cuenta para las ligas.
- `daily_results` crece una fila por jugador y día. Si crece mucho, se pueden borrar las de hace más de unas semanas: la liga solo usa la semana actual y la anterior.
