# 0038. Referidos: el «Circuito» de amigos

- **Estado:** aceptada (código fusionado en `preprod` con la PR #59; la migración `20261112140721_referidos` se aplicó el 12 de noviembre de 2026)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

## Contexto

Luis quiere que los jugadores inviten a sus amigos y que los dos ganen algo. La idea, con el análisis previo hecho con REA de Duolingo, GeoGuessr y Chess.com, está en [docs/ideas/referidos-circuito-de-amigos.md](../ideas/referidos-circuito-de-amigos.md). Luis la aprobó tal cual: «la idea me encanta, hazla».

Limitaciones:

- se juega sin registro ([0009](0009-jugador-sin-registro-con-cookie.md));
- el progreso (faradios, cofres, piezas) vive en el navegador ([0024](0024-avatar-faradios-y-misiones.md));
- Supabase solo se usa desde el servidor ([0002](0002-acceso-a-supabase-solo-desde-el-servidor.md));
- ya existe `daily_results`, la tabla en la que el servidor apunta el reto del día jugado ese mismo día ([0031](0031-ligas-de-amigos.md)).

## Decisión

### Enlace y vínculo

- Cada jugador tiene un **código** de 6 caracteres (`referral_codes`), que guarda también su apodo y su avatar para que sus amigos le reconozcan.
- **Todos los enlaces que ya se comparten llevan `?de=CÓDIGO`**: la tarjeta para stories, el resultado del reto, los duelos (código y resultado) y las ligas. Hay además un botón «Invitar amigos» en la pantalla del Circuito. Compartir ya es invitar.
- Al abrir un enlace con `de=`, el navegador guarda el código y lo quita de la dirección sin tocar `?liga=` ni `?duelo=`. El servidor apunta el vínculo (`referrals`) **solo si el jugador es nuevo**. No lo apunta si:
  - el jugador ya tiene alguna respuesta guardada;
  - el código es el suyo;
  - ya tenía padrino;
  - el que invita es alguien a quien invitó él (para que no se cierren círculos).
- Quien entra invitado ve «Fulano te ha invitado. ¿Te acercas más?», con un botón para jugar el reto de hoy. **Después** de jugarlo, ve el resultado de quien le invitó («Luis hizo 2× hoy; tú, 1,2×. ¡Le ganas!»).

### Cuándo cuenta un amigo

Un invitado pasa a ser **conexión** cuando juega el reto del día, ese mismo día, en **3 días distintos dentro de sus primeros 14**. Lo comprueba el servidor con `daily_results`. El archivo no cuenta.

### Premios

El servidor marca cada premio como cobrado **antes** de devolverlo, con un `PATCH … where *_claimed = false`. Si llegan dos peticiones a la vez, solo una lo recibe. El navegador (`progress.js`) entrega el premio.

| Quién | Cuándo | Premio |
|---|---|---|
| Invitado | Al terminar su primer reto del día | Cofre Rayo y la gorra (o el gorro) **Enchufe**, exclusiva |
| Invitado | Al hacerse conexión | 150 ≈ |
| Quien invita | Por cada conexión, de la 1.ª a la 10.ª | Cofre Rayo |
| Quien invita | Por cada conexión desde la 11.ª | 50 ≈, como mucho 20 al mes |
| Quien invita | 1 conexión | **Camiseta Cable pelado** (exclusiva) |
| Quien invita | 3 conexiones | Cofre Tormenta (una vez) |
| Quien invita | 5 conexiones | **Sudadera Bobina de Tesla** (exclusiva) |
| Quien invita | 10 conexiones | **Universitaria Jaula de Faraday** (exclusiva) |

Detalles de las piezas y de los escalones:

- Las piezas exclusivas llevan un estampado nuevo, un rayo en un círculo, con «CIRCUITO» a la espalda.
- No se compran ni salen en cofres, igual que la sudadera «Casi casi».
- Los escalones los aplica el navegador con el número de conexiones que da el servidor.

### Corriente compartida

Durante los 30 días siguientes al vínculo, cada día que **los dos** juegan el reto del día, a cada uno se le carga la batería **+15**. El servidor da los días en que jugaron los dos (los últimos 7) y el navegador recuerda cuáles ya ha cargado.

### Pantalla

Se abre desde «⚡ Invita amigos: ganáis los dos» en la portada, desde el menú y desde las piezas exclusivas del armario. Tiene:

- un tablero oscuro con **10 enchufes** que se llenan con el avatar de cada amigo conectado, con los escalones marcados;
- tu código y el botón para invitar;
- tres pasos que explican cómo funciona;
- la lista de invitados con su progreso («1 de 3 retos · hasta el 25 de noviembre»);
- la corriente compartida;
- las reglas.

### Código

- `lib/referidos.mjs`: reglas (`RULES`) y la ruta `POST /api/referido`, con las acciones `codigo`, `abrir`, `estado` y `reclamar`.
- Dónde se guarda:
  - en local, en `runtime/referidos.json`;
  - en Vercel, en `referral_codes` y `referrals` (migración `20261112140721_referidos`).

  Si las tablas no existen, la ruta responde 503 y el resto del juego sigue.
- `dist/circuito.js` y `dist/circuito.css`, para la pantalla.
- Cambios en archivos que ya existían:
  - `progress.js` entrega los premios;
  - `avatar.js` añade las piezas exclusivas y `avatar3d.js`, el estampado del rayo;
  - `app.js`, `share-card.js`, `duel.js` y `ligas.js` añaden `de=` a sus enlaces.
- `tests/referidos.test.mjs` prueba las reglas.

## Alternativas descartadas

- **Premiar el clic o el registro:** es lo más fácil de falsear. Pedir 3 días de juego hace que una invitación falsa cueste tres días de trabajo.
- **Recompensas en dinero o descuentos:** no hay pagos, y la [0024](0024-avatar-faradios-y-misiones.md) evita el dinero real.
- **Guardar todo el premio en el servidor:** los faradios y los cofres siguen en el navegador hasta que haya progreso en la cuenta. El servidor protege lo que sí puede: el vínculo, la validación y que cada premio se cobre una vez.
- **Un botón de invitar aparte y nada más:** casi nadie lo pulsa. Meter el código en los enlaces que ya se comparten aprovecha lo que la gente ya hace.
- **Avisos para pedir invitaciones después de un «¡Casi casi!» o de ganar un duelo:** se dejan para más adelante. Primero hay que ver cuánto se comparte con los enlaces.

## Consecuencias

- La migración `20261112140721_referidos` se aplicó en Supabase el 12 de noviembre de 2026, a petición de Luis. Si las tablas fallaran, en Vercel el Circuito responde «no disponible», aunque los enlaces se siguen compartiendo sin código.
- Quien edite su `localStorage` puede darse premios, como ya pasa con todo el progreso. Lo que no puede es fabricar conexiones sin jugar 3 días con otro navegador. Además, desde la 11.ª conexión los premios son pequeños y tienen tope.
- Un invitado que vacíe su navegador antes de cobrar no pierde el premio: sigue pendiente en el servidor. Uno que lo vacíe después pierde lo cobrado, como el resto de su progreso.
- Revisar las cifras (3 días en 14, el cofre Rayo por amigo) cuando haya datos: cuántos enlaces se comparten, cuántos invitados juegan el primer reto, cuántos se conectan y si se quedan más que los que llegan solos.
