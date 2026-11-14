# 0054 — Inicio de sesión también con Apple, Discord y Twitch

- **Fecha:** 2026-11-14
- **Quién:** Luis, con Claude Code
- **Estado:** aceptada. Discord y Twitch activados en Supabase el 2026-11-14; Apple pendiente por el coste del Apple Developer Program (ver [pasos](../mejoras/activar-inicio-de-sesion.md#7-apple-discord-y-twitch)).

## Contexto
El inicio de sesión de la [decisión 0022](0022-inicio-de-sesion-desde-el-servidor.md) funciona con código por correo y con Google, que se activó el 2026-11-14. Luis pidió añadir Apple, Discord y Twitch: Discord y Twitch encajan con el público de juegos y Apple es lo habitual en iPhone.

## Decisión
- **El mismo flujo que Google** para los cuatro: OAuth con PKCE a través de nuestro servidor. `GET /api/auth/<proveedor>` (`google`, `apple`, `discord` o `twitch`) redirige a Supabase, que vuelve a `/api/auth/callback`. La lista de proveedores admitidos está en `OAUTH_PROVIDERS` de `lib/auth.mjs`; cualquier otro nombre no redirige.
- **Cada botón solo aparece si su proveedor está activado en Supabase.** `/api/auth/estado` devuelve `{email, google, apple, discord, twitch}` leyendo `/auth/v1/settings`. Así el código puede llegar a producción antes de configurar los proveedores.
- **Orden de los botones:** Google, Apple, Discord y Twitch, encima del correo. Mismo estilo que el de Google, con el logotipo de cada uno.
- **Nombre de la cuenta:** se toma `full_name` o `name` y, si no hay ninguno, el nombre visible de Discord (`custom_claims.global_name`) o el `nickname`.
- Se mantiene la [decisión 0002](0002-acceso-a-supabase-solo-desde-el-servidor.md): sin SDK, sin clave publicable en el navegador y sin dependencias nuevas.

## Alternativas descartadas
- **Código propio para cada proveedor:** repetiría lo mismo cuatro veces. Supabase trata todos los proveedores igual en `/authorize`.
- **Mostrar todos los botones siempre:** llevaría a un error a quien pulse uno que aún no está configurado.

## Consecuencias
- **Apple necesita el Apple Developer Program (99 USD al año).** Además, el secreto que se pega en Supabase es un JWT firmado con la clave `.p8` que **caduca a los 6 meses como mucho**: hay que regenerarlo antes o el botón de Apple dejará de funcionar.
- **Apple puede ocultar el correo** (dirección `@privaterelay.appleid.com`) y solo envía el nombre la primera vez. Esa cuenta no se unirá con la del mismo jugador por correo o Google.
- **Supabase une las identidades con el mismo correo verificado.** Si alguien entra con Google y luego con Discord con el mismo correo, es la misma cuenta y conserva su jugador.
- **Twitch** exige que la cuenta de quien registra la aplicación tenga la verificación en dos pasos.
- Igual que con Google: probarlo en una Preview crea usuarios reales en producción, porque Supabase tiene un solo entorno.
