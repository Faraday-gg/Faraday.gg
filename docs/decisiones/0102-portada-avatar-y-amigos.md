# 0102. Portada de Faraday con avatar y panel de amigos

- **Estado:** implementada y comprobada en local. La migración social queda pendiente de aplicación.
- **Fecha:** 2026-11-19.
- **Quién:** Álvaro, con Codex.
- **Continúa:** [0041](0041-menu-rediseno.md), [0070](0070-avatar-sigue-al-raton-y-dice-ay.md) y [0097](0097-modulo-plus-por-modalidad.md).

## Referencia

Se inspeccionó la estructura visible de la portada pública de GeoGuessr, incluidas navegación, registro, propuesta de juego, bloques de modos y pie. El acceso al menú personalizado lleva al formulario de inicio de sesión. Para esa vista se partió de la descripción de Álvaro y del registro oficial, que confirma la barra lateral, la actividad y el chat entre amigos. [Portada pública](https://www.geoguessr.com/) · [Notas oficiales de GeoGuessr](https://geoguessr.canny.io/changelog/patch-notes-26th-may-2026).

## Decisión

La portada sirve de entrada gratuita y de menú para quien vuelve. Las cuatro modalidades tienen acceso desde la cabecera y las tarjetas ilustradas. Mercado y Comunidad van después de las modalidades. El perfil muestra nivel y saldo junto a la cuenta y al panel social. El avatar usa la ropa y el saludo del jugador, reacciona con un giro más rápido y visible del torso, la cabeza y los ojos, y abre el Armario con un botón propio. Los cofres pendientes tienen un acceso independiente. La oferta de la derecha reutiliza Plus y las condiciones que informa el servidor. En móvil las secciones se apilan. La zona de enlaces muestra cómo se juega, preguntas frecuentes, ligas y el GitHub público. Quedan por incorporar los perfiles oficiales en redes cuando se conozcan sus enlaces.

El lema elegido, **«¿A cuánto te acercas?»**, convierte la mecánica en una pregunta breve. «A cuánto» invita a pensar en una cifra y «te acercas» apunta a la precisión. La línea de apoyo explica las tendencias y la competición. Hodges, Estes y Warren observaron que la facilidad de lectura favorece el agrado y que la concreción de las palabras ayuda al recuerdo. La elección aplica ese criterio y queda abierta a validación con jugadores. [Journal of Consumer Research](https://doi.org/10.1093/jcr/ucad034).

## Amistades y chat

- El panel enlaza a Ligas y al Circuito de amigos. La amistad es mutua al aceptar un enlace de una persona que ha activado su perfil. El enlace usa un token aleatorio, se puede renovar y viaja en el fragmento de la URL.
- La sesión del servidor determina la identidad. El panel pregunta por un apodo, comparte actividad solo entre amistades y ofrece ocultarla. «En línea» significa que la pestaña visible envió un pulso en los últimos 150 segundos. La fecha de juego resume señales de las modalidades durante los últimos siete días.
- Se guardan los últimos 60 mensajes de texto directo. Solo pueden consultar o escribir las dos personas de una amistad activa. El guardado usa una versión para no perder escrituras simultáneas y un identificador por mensaje para tolerar reintentos. Bloquear impide volver a conectar con ese enlace y elimina el historial compartido.
- La API usa las cookies de sesión y las tablas quedan bajo RLS con acceso del servidor. Los datos locales viven junto a las respuestas en `social.json`. Preview y producción separan perfiles, contactos y mensajes por ámbito.

Se prefirió una sola portada con acceso inmediato al juego para mantener el arranque como invitado. El chat de duelo queda ligado a su partida y el chat directo usa amistades aceptadas. La presencia usa sondeo sobre la API existente, suficiente para la frecuencia de actualización del panel.

## Comprobaciones

Se revisa escritorio y móvil con `node preview-server.mjs`, incluidos Armario, entradas de juego, panel y oferta Plus. Dos cuentas simuladas verifican el enlace, la aceptación y la entrega de mensajes. `node tests/social.test.mjs` comprueba sesión, ámbito, permisos, privacidad, reintentos, concurrencia y persistencia. La migración se valida en PostgreSQL local con roles equivalentes a los de Supabase.
