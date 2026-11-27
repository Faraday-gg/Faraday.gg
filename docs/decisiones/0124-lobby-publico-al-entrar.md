# 0124. Lobby público al entrar: salas de 20, ir a por un jugador, retos y amistades

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-27
- **Quién:** Luis, con Claude

## Contexto

Luis quiere que el juego sea más social: que nada más entrar se esté con otros jugadores, se les pueda pulsar para retarlos y pedirles amistad. Hasta ahora solo había presencia compartida en el Salón, entre amigos y con cuenta ([0116](0116-salon-casino-de-prueba.md), [0122](0122-salon-gestos-correr-saltar-y-chat.md)), y la portada enseñaba el avatar solo.

## Decisión

- **El centro de la portada es un Lobby en 3D** (`dist/lobby.js`, `dist/lobby-world.js`, `dist/lobby.css`): una plaza propia con el avatar del jugador y los de los demás, su nombre encima, la insignia «Lobby 1 · 7/20», la lista «Jugadores (n)» y un botón para ampliarlo a toda la ventana. El título y el pie (nivel, «Editar avatar», cofres) se conservan.
- **Salas de 20.** Se llena siempre el lobby de número más bajo con hueco y solo entonces se abre el siguiente. Quien ya está en uno se queda mientras siga presente.
- **Vale para invitados y para cuentas.** La identidad es la cuenta de la sesión o, sin ella, la cookie `faraday_jugador` ([0009](0009-jugador-sin-registro-con-cookie.md)). El nombre es el apodo de los duelos.
- **Moverse:** teclado con el foco en el lienzo, palanca táctil y clic o toque en el suelo.
- **Pulsar a un jugador:** el avatar corre hasta él, lo sigue si se mueve y, al llegar, se abre un menú: «Retar a…» (un botón por juego, ver [0125](0125-duelos-en-todos-los-juegos.md)), «Añadir a amigos», «Saludar» y «Silenciar». El mismo menú se abre desde la lista de jugadores, que es la alternativa por teclado y la vista cuando no hay 3D.
- **Retar:** quien reta crea un duelo privado y envía su código; el retado ve un aviso con Aceptar y Rechazar que caduca a los 30 s, también si está dentro de otro juego. Si se rechaza o caduca, el duelo en espera se cancela.
- **Amistad con solicitud.** Hasta ahora una amistad nacía al abrir un enlace de invitación. Desde el lobby se pide y el otro la acepta; hace falta cuenta en los dos. Al aceptar se crea el perfil social de quien no lo tuviera, con su nombre del lobby.
- **Servidor:** `POST /api/lobby` (`lib/lobby.mjs`, `lib/lobby-store.mjs`) con las acciones `pulso`, `salir`, `chat`, `retar`, `rechazar-reto`, `amistad` y `aceptar-amistad`. Cada jugador tiene un identificador público opaco por presencia; el hash del jugador no sale nunca.
- **Sin fila compartida.** El Salón guarda toda la sala en una fila JSON por la que compiten todos los latidos. Aquí hay una fila por jugador en `lobby_presence` (tabla `UNLOGGED`) y los mensajes y señales son inserciones en `lobby_events`. La presencia solo se escribe si hay movimiento, gesto o han pasado 4 s, y caduca entre 15 y 19 s sin pulso.
- **Ritmo del pulso:** 1,5 s con el lobby a la vista y actividad reciente; 6 s en reposo; 8 s dentro de un juego (3 s con el chat desplegado, 2 s mientras hay un reto pendiente); parado con la pestaña oculta. Un fallo de red no vacía la plaza: se reintenta a los 3, 6, 15 y 30 s.
- **Límites de envío que aguantan peticiones simultáneas.** Cada mensaje y cada invitación ocupa un «turno» (`slot`) protegido por un índice único: de dos peticiones que leyeron lo mismo solo entra una. Un reto por destinatario cada 15 s y 8 invitaciones por minuto.
- **Rendimiento:** solo los 8 jugadores más cercanos (5 en móvil) llevan modelo 3D completo y el resto se dibuja como una imagen plana que se puede pulsar; con 20 jugadores eso baja de unas 3.000 a unas 1.770 llamadas de dibujo por fotograma en escritorio. Se limita la resolución y las sombras en móvil y el bucle se para cuando la portada no se ve. Con «reducir movimiento», ahorro de datos o sin WebGL se usa la vista plana.
- **Migraciones `20261126120000_lobby` y `20261126120100_amigos_aspecto`, pendientes de aplicar.** Sin ellas `/api/lobby` responde 503 y la portada enseña el lobby en solitario; el resto del juego no cambia.

## Alternativas descartadas

- **Una fila JSON por sala**, como el Salón: con 20 jugadores los latidos chocan entre sí.
- **Supabase Realtime o conexiones abiertas:** mismos motivos que en la [0023](0023-duelos-1vs1.md) y la 0122 (clave en el navegador o servidor con estado).
- **Lobby solo para cuentas:** en local no hay cuentas y la mayoría de los jugadores entra sin registro.
- **Copiar el mundo del Salón:** la plaza es una escena nueva y más ligera; las mesas no pintan nada en la portada.
- **Comprobar en el servidor que el código del reto es de un duelo de quien reta:** acoplaba el lobby con el almacén de duelos; un código falso solo da un «código no válido» al aceptar.

## Consecuencias

- **Coste.** Un jugador activo en la portada hace unas 40 peticiones por minuto a la función de Vercel, y cada pulso son cuatro lecturas en Supabase (más una escritura si se mueve). Hay que vigilar el consumo del plan Hobby; quedan apuntadas en [mejoras](../mejoras/README.md) una función SQL que haga las tres lecturas en un viaje y una caché corta de la sesión.
- **Identidades de invitado gratis.** Una cookie inventada es un jugador nuevo: se pueden llenar lobbies con fantasmas. El chat tiene un tope por sala, pero un límite por IP solo puede ponerse en Vercel.
- **Nivel, nombre y aspecto los declara el navegador:** son cosméticos y falsificables.
- **Preview y producción comparten base de datos** ([0001](0001-supabase-un-solo-entorno.md)): las tablas llevan `scope` y cada entorno tiene sus lobbies.
- Silenciar a alguien se guarda en el navegador y va por su identificador de presencia, que cambia tras 10 minutos de ausencia.
- No existe «Ver perfil» de otro jugador; queda para más adelante.
- La migración solo se ha probado contra un Supabase simulado. Al aplicarla hay que comprobar contra el real el índice único de los turnos y la consulta de eventos.
- El rendimiento con el lobby lleno solo se ha medido con render por software; falta probarlo en móviles reales.
