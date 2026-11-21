# 0110 — Pie de página y páginas legales

- **Estado:** aceptada, pendiente de completar los datos del titular antes de pasar a `main`.
- **Fecha:** 2026-11-21.
- **Quién:** Luis, con Claude Code.

## Contexto

La web guarda correos y nombres desde el inicio de sesión ([0022](0022-inicio-de-sesion-desde-el-servidor.md)), apodos, chats y preguntas de la comunidad, y prepara el cobro de Plus con Stripe ([0077](0077-cobro-con-stripe.md)). No había política de privacidad, condiciones de uso ni aviso legal, y la [mejora](../mejoras/README.md) «Política de privacidad y borrar la cuenta» lo pedía antes de anunciar las cuentas.

## Decisión

- Tres páginas estáticas en `dist/legal/`: `privacidad.html`, `terminos.html` (condiciones de uso con el aviso legal de la LSSI) y `cookies.html`, con un estilo propio (`legal.css`) sobre la marca de `styles.css`. No cargan JavaScript.
- El pie del vestíbulo (`.portal-links` en `dist/index.html`) suma «© 2026 Faraday.gg» junto a GitHub y una línea con Privacidad, Términos y Cookies. Cabe sin desplazamiento en escritorio y en 375 px.
- Los textos describen lo que hace hoy el código: cookies `faraday_jugador`, `faraday_sesion`, `faraday_refresco` y `faraday_pkce`; `localStorage`; Vercel, Supabase, OpenAI (solo moderación de preguntas de la comunidad), Stripe, Google Fonts y los proveedores de acceso. Repiten las reglas de la [0027](0027-cofres.md) y la [0055](0055-tokenomics-suscripcion-y-mercado.md): los faradios no tienen valor en dinero.
- **Sin banner de cookies:** todas son técnicas y propias (exentas por el art. 22.2 de la LSSI, como ya decía la [0009](0009-jugador-sin-registro-con-cookie.md)).
- Edad mínima de 14 años para cuenta, chat y suscripción (art. 7 de la LOPDGDD).
- El borrado de la cuenta se pide por correo, hasta que exista un botón.

## Alternativas descartadas

- **Una sola página legal:** más difícil de enlazar desde el pago de Stripe o los proveedores OAuth, que piden URL de privacidad y de condiciones por separado.
- **Inventar los datos del titular:** el repositorio es público y el aviso legal exige nombre, NIF, domicilio y correo reales. Quedan marcados en amarillo como `[pendiente]` para que Luis los complete.
- **Banner de consentimiento:** no hace falta mientras no haya cookies no técnicas.

## Consecuencias

- Antes de pasar a `main` hay que rellenar los cuatro marcadores `legal-pending` de `privacidad.html` y `terminos.html` (titular, NIF, domicilio, correo).
- Revisar estas páginas si se añaden anuncios reales, analítica, nuevos proveedores, o se activa el cobro: ahí hacen falta banner de consentimiento, condiciones de desistimiento concretas y la revisión con un abogado que pide la 0055.
- Google Fonts envía la IP de cada visitante a Google; alojar las fuentes en `dist/` lo evitaría (anotado en mejoras).
- Las URL públicas son `/legal/privacidad.html` y `/legal/terminos.html`, útiles para la configuración de Google, Apple, Discord, Twitch y Stripe.
- Esto no es asesoramiento legal: conviene que un abogado revise los textos antes de cobrar.
