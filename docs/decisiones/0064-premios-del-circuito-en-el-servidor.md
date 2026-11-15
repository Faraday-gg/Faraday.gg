# 0064. El servidor reparte los premios del Circuito de amigos

- **Estado:** propuesta (código en la rama `feat/referidos-servidor`, montada sobre `feat/cofres-servidor`; sin migración nueva)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la entrega 4c de la fase 1 ([0063](0063-cofres-en-el-servidor.md)).
- **Cambia a:** la [0038](0038-circuito-de-amigos.md), que dejaba la entrega de los premios al navegador. Las reglas del Circuito no cambian.

## Contexto

En la 0038 el servidor ya decidía qué premios tocaban y los marcaba como cobrados, pero quien los sumaba era el navegador. Tras la 0063 era lo último que el navegador declaraba: los faradios con el motivo `referidos` y los cofres con una llamada (`regalo-cofre`) que el servidor aceptaba sin poder comprobarla, con tope de 2 al día.

## Decisión

- **Con cuenta, los premios del Circuito los reparte el servidor.** Cuando `POST /api/referido` devuelve el estado o los premios cobrados, y la sesión es la de ese mismo jugador, el servidor los aplica en el momento:

  | Premio | Qué hace el servidor |
  |---|---|
  | Bienvenida del invitado (cofre Rayo) | Lo apunta en sus cofres |
  | Invitado que se conecta (150 ≈) | Los suma a su saldo, con un apunte `referidos` |
  | Conexión para quien invita (cofre Rayo las 10 primeras; 50 ≈ después) | Cofre o faradios, según toque |
  | 3 conexiones (cofre Tormenta) | Lo apunta una sola vez |
  | Corriente compartida (+15 de batería por día jugado los dos) | Carga la batería, una vez por amigo y día |

- La respuesta lleva `server` con el saldo, los cofres y la batería. El navegador lo copia y **no suma nada por su cuenta**; sigue enseñando los avisos y desbloqueando las piezas exclusivas, que salen del número de conexiones.
- **Se quita `regalo-cofre`** y **el navegador ya no puede declarar el motivo `referidos`.** Le quedan `bienvenida` y `otros`.
- La primera vez, el servidor parte de lo que el jugador ya tenía: si ya recibió el cofre Tormenta y qué días de corriente ya cargó.
- Sin cuenta, o si la sesión no es la del jugador que pide, todo sigue como en la 0038.

### Las entregas de la fase 1

| Entrega | Estado |
|---|---|
| 1 a 4b | Hechas (0057 a 0063) |
| **4c. Referidos** | Esta |
| 5. Cierre: dejar de aceptar el saldo inicial, la bienvenida y «otros» declarados | Pendiente |

### Código

- `lib/comunidad.mjs`: `referral`, que reparte los premios, y la lista `REASONS` sin `referidos`; se quita `regalo-cofre`.
- `lib/api.mjs`: la ruta del Circuito llama a `referral` cuando hay sesión del propio jugador.
- `lib/cofres.mjs`: al empezar, recoge del progreso declarado el cofre Tormenta y los días de corriente ya cargados.
- `dist/progress.js` y `dist/circuito.js`: con lo que reparte el servidor, el navegador solo avisa.
- `tests/circuito-servidor.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Mover el reparto dentro de `lib/referidos.mjs`.** Ese módulo trabaja con jugadores anónimos y no sabe quién tiene cuenta; la ruta de la API sí.
- **Que el navegador pida el premio aparte**, como con el reto. El Circuito ya tiene su llamada de cobrar, que marca cada premio una vez; repartirlo ahí mismo evita otra ida y vuelta.
- **Pasar también las piezas exclusivas al inventario.** No se compran ni se venden; salen del número de conexiones, que ya lleva el servidor.

## Consecuencias

- **Si el reparto falla después de marcar el premio como cobrado, ese premio se pierde.** Ya pasaba cuando lo sumaba el navegador y se cerraba la pestaña. Queda apuntado en el registro del servidor.
- **Quien cobra sin sesión** (por ejemplo, con la sesión caducada) recibe los premios en el navegador como antes. Sus faradios entran como `sin-desglose`, bajo el tope diario.
- **Quien juega con cuenta el mismo día que varios amigos** carga 15 de batería por cada uno, igual que antes.
- Lo único que el navegador sigue declarando es el saldo de la primera subida, la `bienvenida` y `otros`. Lo cierra la entrega 5.
- Sin migración nueva.
- Hay que aceptar antes la PR de la entrega 4b: esta rama parte de la suya.
