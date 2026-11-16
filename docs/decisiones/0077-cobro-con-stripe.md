# 0077. El cobro de la suscripción, con Stripe

- **Estado:** propuesta (código en la rama `feat/suscripcion-stripe`, montada sobre `feat/suscripcion`; **sin cuenta de Stripe ni claves todavía**, así que no se puede contratar)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0076](0076-suscripcion-sin-cobro.md), que dejó hecho todo lo que da la suscripción menos el cobro. Segunda entrega de la fase 5 de la [0055](0055-tokenomics-suscripcion-y-mercado.md).

## Contexto

Faltaba cobrar. Luis eligió **Stripe**. El juego no tiene dependencias de npm y la suscripción ya es una fila en `subscriptions`: solo hace falta que algo escriba esa fila cuando alguien paga y la ponga al día cuando renueva, falla un cobro o se da de baja.

## Decisión

### Cómo se contrata

1. En el perfil, el recuadro del plan enseña **«Suscribirme · 4,99 € al mes»** (el precio es el que diga Stripe).
2. El servidor pide a Stripe una **página de pago** (Stripe Checkout) y el navegador va a ella. La tarjeta se escribe en la página de Stripe: **el juego no ve ni guarda datos de pago**.
3. Al pagar, Stripe devuelve al jugador al juego y, aparte, manda al servidor un **aviso de pago**. El servidor comprueba la firma del aviso, lee la suscripción en Stripe y apunta hasta cuándo vale.
4. El juego pregunta unos segundos hasta que la suscripción aparece y dice «¡Suscripción activa!».

- Hace falta una **cuenta con el correo comprobado**.
- Quien ya la tiene activa no puede abrir otra página de pago.

### Cómo se gestiona

El recuadro del plan enseña **«Gestionar la suscripción»**, que abre el **portal de Stripe**: cambiar la tarjeta, ver recibos o cancelar. No hay pantalla propia para eso.

### Qué hace cada aviso de Stripe

Sea cual sea el aviso, el servidor **lee la suscripción en Stripe** y apunta su estado. Así da igual el orden en que lleguen y que alguno se repita.

| Estado en Stripe | Hasta cuándo vale en el juego |
|---|---|
| Activa o en prueba | Fin del periodo pagado, más **1 día** de margen |
| Cobro fallido (Stripe lo reintenta) | **3 días** desde el aviso, como mucho |
| Cancelada, impagada o sin completar | Deja de valer en el momento |

- Avisos que se atienden: pago completado en la página de pago, cambios y baja de la suscripción, factura pagada y factura fallida. Los demás se dan por recibidos sin hacer nada.
- Si Stripe no responde al leer la suscripción, el aviso falla a propósito para que Stripe lo reintente.
- Un aviso **sin la firma de Stripe se rechaza**. La firma caduca a los 5 minutos.

### Datos

- `subscriptions` gana la columna `customer` (el cliente en Stripe, para abrirle el portal). `source` es `stripe` y `ref`, la suscripción en Stripe. La migración de la 0076 no se había aplicado, así que es el mismo archivo.
- Tres variables de entorno, **solo en producción**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_PRICE_ID`. Sin ellas, el recuadro del plan dice «Todavía no se puede contratar» y todo lo demás funciona.

### Código

- `lib/stripe.mjs` (nuevo): las llamadas a Stripe, la comprobación de la firma, las acciones `suscribirse` y `gestionar-suscripcion` de `POST /api/progreso` y el aviso de pago.
- `lib/api.mjs`: la ruta nueva `POST /api/stripe`. `api/index.mjs` y `preview-server.mjs`: leen las variables. `lib/comunidad.mjs`: `estado` devuelve `billing`.
- `dist/progress.js` y `dist/styles.css`: los botones y la vuelta del pago.
- `tests/stripe.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)), con un Stripe simulado.

## Lo que tiene que hacer Luis en Stripe

1. Crear la cuenta de Stripe y completar los datos del negocio.
2. Crear un **producto** con un **precio recurrente** (por ejemplo, mensual). Apuntar su identificador (`price_…`).
3. Activar el **portal del cliente** (Configuración → Facturación → Portal del cliente) y permitir cancelar.
4. Crear un **destino de avisos** (*webhook*) con la dirección `https://<dominio de producción>/api/stripe` y estos avisos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`. Apuntar su secreto (`whsec_…`).
5. Poner en Vercel, **solo en Production**, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_PRICE_ID`. El panel de Vercel lo lleva Álvaro.
6. ~~Aplicar la migración `suscripciones`.~~ Hecho el 16 de noviembre.

Conviene hacerlo antes con las **claves de prueba** de Stripe y sus tarjetas de prueba.

## Alternativas descartadas

- **La librería oficial de Stripe.** El proyecto no usa dependencias de npm; hacen falta cuatro llamadas y una firma.
- **Un formulario de tarjeta dentro del juego.** Obliga a cumplir más normas de seguridad de pagos; con la página de Stripe, ninguna tarjeta pasa por el servidor.
- **Fiarse de lo que trae cada aviso** en vez de leer la suscripción. Los avisos pueden llegar desordenados o repetidos.
- **Dar la suscripción al volver de la página de pago**, sin esperar el aviso. La dirección de vuelta la puede abrir cualquiera.
- **Pantalla propia para cancelar o cambiar la tarjeta.** El portal de Stripe ya lo hace.
- **Claves de Stripe también en las Preview.** Las Preview comparten la base de datos con producción: un pago de prueba daría una suscripción de verdad.

## Consecuencias

- **Es un servicio externo nuevo y tres claves nuevas.** Ninguna está en el repositorio.
- **No se ha probado contra Stripe de verdad**: no hay cuenta. Se ha comprobado su documentación y se ha probado con un Stripe simulado. La primera prueba real hay que hacerla con claves de prueba.
- **Cobrar exige más que código:** condiciones de venta, política de devoluciones, facturas e IVA. Stripe puede calcular el IVA (Stripe Tax), pero hay que activarlo y decidirlo; no está en esta entrega.
- **Las marcas reales del armario hay que retirarlas antes de cobrar** ([0026](0026-marcas-reales-en-la-tienda.md), [0055](0055-tokenomics-suscripcion-y-mercado.md)).
- **Una suscripción puesta a mano se sobrescribe** si esa cuenta paga después con Stripe: manda lo que diga Stripe.
- **El tope de 5 duelos** ya vale para todos desde la 0076; con esto pasa a poder quitarse pagando.
