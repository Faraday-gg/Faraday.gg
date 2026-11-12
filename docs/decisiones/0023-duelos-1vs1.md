# 0023. Duelos 1 vs 1 con vida, al estilo GeoGuessr

- **Estado:** propuesta (código en la PR de `feat/duelos-1vs1`; la migración, renombrada `20261112005952_duelos`, se aplicó el 2026-11-12)
- **Fecha:** 2026-11-11
- **Quién:** Luis, con Claude Code

## Contexto

Luis quiere que el juego sea social: competiciones 1 vs 1 como los duelos de GeoGuessr, con avatar, barra de vida que baja según lo lejos que quede cada respuesta, 3 minutos por pregunta que bajan a 30 segundos cuando el rival responde, aviso de que el rival ha respondido, sonidos agradables y mecánicas de retención.

Limitaciones: no hay cuentas ([0009](0009-jugador-sin-registro-con-cookie.md)), Supabase solo se usa desde el servidor ([0002](0002-acceso-a-supabase-solo-desde-el-servidor.md)), la API es una función de Vercel sin conexiones abiertas ([0003](0003-despliegue-en-vercel.md)) y no hay dependencias de npm.

## Cómo lo hace GeoGuessr y qué copiamos

Lo que sigue describe los duelos de GeoGuessr tal y como los conocemos; no se ha vuelto a contrastar con su web en esta tarea.

| GeoGuessr (duelos) | Casi Casi |
| --- | --- |
| Cada jugador empieza con 6000 de vida. | Igual: 6000. |
| Cada respuesta puntúa de 0 a 5000 según la distancia al punto real. | De 0 a 5000 según la distancia multiplicativa a la cifra real, en escala logarítmica: 1× = 5000, 2× ≈ 4000, 10× ≈ 1670 y 32× o más = 0. El doble y la mitad puntúan igual. |
| Quien puntúa menos pierde la diferencia de puntos. | Igual. Si empatan, nadie pierde vida. No responder vale 0 puntos. |
| El daño se multiplica a partir de cierta ronda para que la partida no se eternice. | Rondas 1 a 3 ×1; después +0,5 por ronda (×1,5, ×2, ×2,5…). Tope de 10 rondas: si nadie ha caído, gana quien conserve más vida. |
| Cuando un jugador responde, el otro tiene una cuenta atrás corta y el reloj se vuelve urgente. | 3 minutos por pregunta; cuando uno responde, al otro le quedan como mucho 30 segundos. El reloj cambia de color y late muy despacio, aparece un aviso «X ha respondido · te quedan 30 s», suena una campanita y sale una marca ✓ junto al avatar del rival. En los últimos 10 segundos hay un tic suave. |
| Marcador con avatar y barra de vida; el daño sale flotando y la barra baja con retardo. | Igual: avatar, nombre, nivel y barra de vida de cada uno. La vida perdida queda marcada un instante, la cifra del golpe sube flotando y la barra cambia de verde a ámbar y a rojo. |
| Resultado de la ronda con las dos respuestas y siguiente ronda automática. | Cifra real con su fuente, las dos respuestas con sus puntos y la siguiente ronda a los 10 segundos. |
| Retención: niveles y experiencia, rachas, recompensa diaria, revancha inmediata, partida rápida, retar a amigos. | Nivel y XP, racha de victorias, «primera victoria del día» (+50 XP), botón de revancha (el rival ve «quiere la revancha»), partida rápida, reto por enlace o código y compartir el resultado. |
| Sonidos cortos de confirmación, aviso, golpe y victoria. | Tonos generados en el navegador (Web Audio, sin archivos), con botón para silenciarlos. |

No copiamos (por ahora): divisiones y clasificación por puntos, emoticonos durante la partida, misiones, temporadas ni monetización.

## Decisión

- **El servidor manda.** `lib/duelos.mjs` guarda el estado de cada duelo (jugadores, vida, rondas, respuestas y horas límite) y lo pone al día con el reloj en cada petición: no hay ningún proceso en segundo plano. La cifra real y la respuesta del rival no salen del servidor hasta que la ronda termina.
- **Sin conexiones abiertas.** El navegador pregunta el estado una vez por segundo (`POST /api/duelo`, acción `estado`). Funciona igual en local y en Vercel y no necesita claves en el navegador.
- **Estado en una tabla nueva, `duels`** (migración `20261112005952_duelos`), una fila por duelo con el estado en `jsonb` y una columna `version` para que dos peticiones a la vez no se pisen. En local se guarda en memoria.
- **Emparejamiento:** partida rápida (te une al primer duelo público en espera cuyo creador siga conectado), reto a un amigo con código de 6 caracteres o enlace `?duelo=CÓDIGO`, y un **bot de práctica** que solo entra si el jugador lo pide y siempre se llama «Faraday-bot»: nunca se hace pasar por una persona.
- **Preguntas:** al azar entre las escritas a mano de días ya pasados (archivo y piloto), para no destripar el reto de hoy. Conservan la foto con su atribución y la fuente.
- **Identidad:** el mismo identificador anónimo del juego (se guarda su SHA-256), más un apodo de hasta 16 caracteres y uno de 12 avatares. El perfil, el nivel, la XP y la racha se guardan en el navegador.

## Alternativas descartadas

- **Supabase Realtime o WebSockets.** Daría avisos instantáneos, pero obliga a usar la clave pública en el navegador (contra la 0002) o a mantener un servidor con conexiones abiertas (no cabe en una función de Vercel). Con consultas cada segundo el retraso máximo es de un segundo, suficiente para este juego.
- **Clasificación y nivel en el servidor.** Sin cuentas se puede falsear y se pierde al cambiar de dispositivo. Se deja para cuando haya inicio de sesión ([idea](../ideas/login-con-supabase.md)).
- **Bots disfrazados de personas** para que siempre haya rival. Sería engañar al jugador.
- **Reutilizar las tres preguntas del día.** Un duelo dura entre 3 y 10 rondas y destriparía el reto diario.

## Consecuencias

- **Hasta que se aplique la migración, los duelos no funcionan en Vercel**: la API responde 503 y la web muestra «Los duelos no están disponibles ahora mismo». El resto del juego no se ve afectado. En local funcionan sin base de datos.
- Cada jugador en un duelo hace una petición por segundo a la función y una lectura a Supabase. Un duelo de 5 minutos son unas 600 peticiones entre los dos. Hay que vigilar los límites del plan Hobby de Vercel y del plan gratuito de Supabase si los duelos crecen.
- Las Preview de Vercel comparten la tabla con producción ([0001](0001-supabase-un-solo-entorno.md)): alguien en la Preview puede emparejarse con alguien de producción.
- El apodo lo escribe el jugador y lo ve su rival. Se limpia de HTML, pero no hay filtro de palabras.
- Trampas posibles: las respuestas de los días pasados son públicas (`/api/day`), así que quien quiera puede buscarlas. Igual que en el reto diario, no se intenta impedir.
- El duelo usa el mismo bloc (calculadora y notas) del reto diario, con sus propias notas. Los duelos terminados se quedan en la tabla: falta una limpieza periódica, anotada en [mejoras](../mejoras/README.md).
