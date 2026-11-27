# 0126. Voz entre preguntas en los duelos de dos

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-27
- **Quién:** Luis, con Claude

## Contexto

Luis quiere que, al terminar cada pregunta de un duelo, los dos jugadores puedan hablar unos segundos si ambos quieren, con un botón fácil para silenciar y otro para salir de la llamada. El juego no tiene conexiones abiertas: el duelo se sondea una vez por segundo ([0023](0023-duelos-1vs1.md)).

## Decisión

- **Solo si los dos la activan, y solo en ese duelo.** Cada jugador ve una barra de voz bajo el marcador. La primera vez se explica qué implica y hay que pulsar otra vez; entonces el navegador pide el micrófono. Nadie oye ni es oído sin haberla activado. La casilla «Activar siempre la voz en mis duelos» está apagada por defecto.
- **Solo en duelos de dos personas:** ni contra el bot ni en el duelo de tres.
- **Se habla entre preguntas.** La conexión se negocia durante la pregunta con el micrófono cerrado y el rival silenciado. Se abren al enseñarse el resultado de cada ronda (unos 10 s) y en la pantalla final (hasta 60 s), y se cierran solos al empezar la siguiente pregunta. La ventana la marca el servidor para que coincidan los dos.
- **Controles:** estado con cuenta atrás, silenciar o activar el micro (también con la tecla M), silenciar al rival, salir de la llamada (libera el micrófono y avisa al otro) e indicador de quién habla.
- **Audio directo entre navegadores (WebRTC), sin servidor de medios.** La señalización viaja por el sondeo del duelo: acción `voz` de `/api/duelo` y campo `voice` en la vista (`lib/voz.mjs`, `dist/voice.js`). Se envía una sola oferta y una sola respuesta con los candidatos dentro (sin *trickle ICE*); el asiento 0 ofrece y el 1 responde; un contador de intento descarta señales viejas.
- **Servicio externo nuevo: STUN públicos** de Google y Cloudflare (`ICE_SERVERS` en `dist/voice.js`), sin clave ni coste, para atravesar el NAT.
- `/api/duelo` admite cuerpos de 16 KB porque la oferta no cabe en 2 KB.
- **No hay migración:** el estado de la voz va en el JSON del duelo y se vacía al conectar y al terminar.

## Alternativas descartadas

- **Micrófono abierto durante la pregunta:** permitiría dictar la respuesta o distraer.
- **WebSocket, SSE o Supabase Realtime** para señalizar: no encajan con Vercel y el sondeo.
- ***Trickle ICE*:** con sondeo de un segundo serían decenas de escrituras en la fila del duelo.
- **Servidor de medios o TURN propio:** coste y un servicio más que mantener.
- **Recordar la voz activada por defecto.**

## Consecuencias

- **La conexión directa enseña la dirección IP de cada jugador al otro**, también en la partida rápida contra desconocidos. Se avisa antes de la primera activación. Luis debe decidir si se limita a duelos con código o entre amigos.
- **Sin TURN no conectará en algunas redes** (NAT simétrico, redes corporativas, parte de las móviles): falla con «No se ha podido conectar la voz» y el duelo sigue.
- Los STUN de Google y Cloudflare ven la IP de quien activa la voz.
- El navegador mantiene encendido el indicador del micrófono durante el duelo aunque solo se transmita en las pausas; «Salir de la llamada» lo apaga.
- No se graba nada y no hay moderación ni denuncias: la defensa es la adhesión expresa, silenciar y salir.
- La política de privacidad (`dist/legal/privacidad.html`) no menciona todavía el micrófono ni la conexión directa; hay que actualizarla antes de producción.
- Probado con micrófono simulado entre dos navegadores; falta probarlo con micrófonos y redes reales, Safari e iOS.
