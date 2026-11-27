# 0128. Chat público del lobby, también dentro de los juegos

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-27
- **Quién:** Luis, con Claude

## Contexto

Solo había chat dentro de un duelo ([0040](0040-chat-en-los-duelos.md)) y en el Salón entre amigos ([0122](0122-salon-gestos-correr-saltar-y-chat.md)). Luis pide chat en el resto de juegos. Con el lobby público ([0124](0124-lobby-publico-al-entrar.md)) hay por primera vez un grupo de gente con la que hablar en cualquier momento.

## Decisión

- **Un solo chat: el de tu lobby.** Lo que escribes lo leen los jugadores de tu sala (hasta 20), estén en la portada o dentro de un juego.
- **Una sola caja** (`window.ChatDock`, `dist/chat-dock.js`) que acompaña al jugador: en la portada va en el escenario del lobby y arranca plegada; dentro del reto diario, el archivo, Traza, Ascensión, Archivo Vivo, ligas, comunidad y circuito es un botón en la barra superior con el contador de no leídos. No aparece en el duelo ni en el Salón, que tienen su chat, ni en perfil, mercado o inicio de sesión.
- **Dentro de un juego no distrae:** plegada por defecto, sin sonido, sin bocadillos y sin robar el foco; lo que se teclea en ella no llega al juego.
- **En el lobby, además, bocadillo** sobre la cabeza de quien habla.
- **Viaja con el pulso del lobby** (acción `chat` de `/api/lobby`, eventos en `lobby_events`): un mensaje tarda en verse entre 1,5 y 8 s según lo que esté haciendo quien lo lee.
- **Defensas, porque es un chat entre desconocidos:**
  - el texto pasa por la misma limpieza que el chat de los duelos (140 caracteres, fuera caracteres de control y de dirección) y se pinta siempre como texto;
  - un filtro básico de palabras sustituye por asteriscos los insultos graves en español;
  - 6 mensajes cada 10 s por jugador y un tope por sala;
  - **silenciar** a un jugador (se guarda en el navegador) y **ocultar el chat** entero.

## Alternativas descartadas

- **Un chat por juego:** nadie con quien hablar en modos individuales, y un almacén por modo.
- **Chat solo entre amigos**, como en el Salón: no es lo pedido y deja el lobby mudo.
- **Chat solo para cuentas:** en local no hay cuentas y la mayoría entra como invitado. Sigue siendo la salida si hay abuso.
- **Una caja flotante en una esquina de cada juego:** en móvil las esquinas las ocupan los botones de enviar, y fuera de un diálogo modal no se ve.

## Consecuencias

- **Cambia lo decidido en la 0040 y la 0122**, que evitaban el chat abierto por no tener moderación. El filtro es una lista corta: no detecta palabras separadas, otros idiomas ni acoso sin palabrotas. No hay denuncias, historial ni bloqueo en el servidor.
- **Puede haber menores.** Antes de producción hay que decidir si el chat público se limita a cuentas, a mayores de cierta edad o a frases predefinidas, y actualizar los textos legales.
- Un invitado que borre la cookie estrena identidad y cupo de mensajes; el tope por sala acota la inundación, pero un límite por IP solo puede ponerse en Vercel.
- Los mensajes se borran solos a los pocos minutos; no queda registro para revisar una queja.
