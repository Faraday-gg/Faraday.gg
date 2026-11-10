# 0009 — Jugador sin registro: cookie propia con el identificador anónimo

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
Se juega sin registro. Cada navegador tenía un UUID anónimo solo en `localStorage`, igual que el progreso. Si el navegador vacía `localStorage` (Safari lo hace a los 7 días sin visitar la web), el jugador pierde su identificador y su progreso, aunque sus respuestas sigan en Supabase. Luis pidió reconocer al jugador sin que tenga que registrarse.

## Decisión
- El servidor pone una cookie propia, `faraday_jugador`, con el mismo UUID anónimo: `HttpOnly`, `SameSite=Lax`, `Secure` en https, `Path=/` y un año de duración. La pone y la renueva `POST /api/jugador`, que el navegador llama al cargar la página.
- Si el navegador tiene su UUID en `localStorage`, ese manda y la cookie se actualiza con él. Si no lo tiene, se usa el de la cookie; si tampoco hay cookie, el servidor crea uno nuevo.
- Cuando el UUID sale de la cookie, la respuesta incluye el progreso guardado (`progress`: por fecha, las cifras en orden de pregunta). El navegador rellena los días que no tengan progreso local y avisa con «Hemos recuperado tu progreso…».
- En la base de datos no cambia nada: se sigue guardando solo el hash SHA-256 del UUID. La recuperación busca en `answers` por `player_hash`.
- No se recupera el bloc (notas e historial de cálculos), que sigue solo en `localStorage`.

## Alternativas descartadas
- **IP y huella del dispositivo (fingerprinting):** la IP y la huella son datos personales según el RGPD, y la huella necesita consentimiento previo, banner y política de privacidad. Además fallan con IP compartidas o cambiantes. Luis eligió no usarlas.
- **Código o enlace para continuar en otro dispositivo:** útil, pero se deja para más adelante. La cookie no sirve entre dispositivos; para eso está la idea del [inicio de sesión](../ideas/login-con-supabase.md).
- **Cookie escrita desde JavaScript:** Safari también la limita a 7 días. Una cookie `HttpOnly` puesta por el propio servidor no tiene ese límite.

## Consecuencias
- Es una cookie técnica necesaria para el servicio que pide el jugador (guardar su partida), sin terceros ni publicidad, así que no necesita banner. Si se añadieran analítica o publicidad, habría que revisarlo.
- Si el jugador borra cookies **y** `localStorage` a la vez, empieza de cero, como antes.
- La búsqueda por `player_hash` no tiene índice propio (la restricción única empieza por `question_id`). Vale con pocos jugadores; se apunta en [mejoras](../mejoras/README.md).
