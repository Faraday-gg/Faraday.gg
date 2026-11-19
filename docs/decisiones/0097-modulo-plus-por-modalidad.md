# 0097. Oferta común de Plus por modalidad

- **Estado:** implementada; integración en `preprod`.
- **Fecha:** 2026-11-19
- **Quién:** Álvaro, con Codex.
- **Continúa:** [0095](0095-plus-y-premios-de-traza.md), [0076](0076-suscripcion-sin-cobro.md) y [0077](0077-cobro-con-stripe.md).

## Contexto

Álvaro pide revisar todas las modalidades con límites diarios, adaptar la invitación a suscribirse y reutilizarla en las futuras. El precio y el paquete definitivo se decidirán después. Traza tenía su propia tarjeta; los duelos solo mostraban un error al llegar al cupo.

## Decisión

Un componente de interfaz común, `PlusOffers`, reúne diseño, textos por contexto, disponibilidad y navegación al plan del perfil. Se carga en toda la aplicación y admite nuevas modalidades mediante registro y contenedores declarativos. No cambia cuotas, premios, precios, pagos ni ventajas del servidor.

| Contexto | Política actual | Presentación |
| --- | --- | --- |
| Duelo 1v1, con amigos, de tres, clasificatorio y práctica contra bot | Comparten el cupo del servidor; hoy son cinco al día en gratuito | Oferta compacta en portal y contextual en resumen; destacada al agotarse o recibirse `code: limite` |
| Traza | Diaria gratuita; extras ilimitados con anuncio de prueba o directamente con Plus | Reutiliza el componente y conserva la alternativa gratuita |
| Reto diario | Una edición de tres preguntas; Plus no añade una edición ni reintentos | Invitación al terminar para explorar Plus y seguir en otras modalidades; archivo gratuito visible |
| Archivo y ligas | Archivo sin cupo; ligas reflejan el reto diario sin intentos propios | No se inventa un bloqueo ni una ventaja de acceso |

Los duelos consultan `POST /api/duelo`, acción `limite`; la interfaz no calcula disponibilidad a partir de monedas, victorias ni estadísticas locales. La oferta aclara que el cupo es compartido. Al cambiar de pantalla se descartan peticiones antiguas y nunca se inserta la promoción en una ronda activa. Abrir el plan desde portal o resumen cierra el contenedor correspondiente; el reto diario conserva su resumen bajo el perfil.

Las ofertas desaparecen para quien tiene Plus y se actualizan si cambia el plan, la cuenta o el precio. Solo muestran el precio que devuelve la integración existente. Sin cobro configurado invitan a descubrir el plan y explican la disponibilidad. No se crean descuentos, contadores, urgencia ni nuevas promesas de partidas ilimitadas.

El registro de una modalidad futura define su texto y política explícitamente; un modo desconocido usa texto genérico, sin prometer que Plus retire su límite. La guía [Modalidades y Plus](../modalidades-y-plus.md) y AGENTS.md hacen obligatorio reutilizar este componente al añadir un modo limitado.

## Límites que se conservan

El límite común de 400 faradios, el premio de bot, los rendimientos decrecientes de duelos, el cofre semanal de Traza, las compras diarias de cofres y las apuestas son reglas económicas, no accesos eliminables con Plus. Los desbloqueos por nivel, las propuestas semanales y la capacidad de las ligas tampoco se presentan como beneficios de pago. El límite de tres anuncios activos del mercado ya depende del plan, pero no es una modalidad ni una cuota diaria y queda en su flujo actual.

## Alternativas descartadas

- Una tarjeta distinta por juego: duplica textos, estilos y tratamiento del precio.
- Prometer más retos diarios con Plus: hoy el servidor no los ofrece.
- Fijar ahora un precio o un paquete nuevo: Álvaro los decidirá después.
- Publicidad en mitad de una ronda o ante cualquier fallo de red: interrumpe el juego y confunde fallos con límites.

## Consecuencias

Las futuras modalidades incorporan un contenedor y registran su contexto, en lugar de copiar el diseño. No hay migraciones ni dependencias nuevas. Persisten los pendientes de Stripe y las migraciones históricas de Traza.

La auditoría detecta además una discrepancia previa: el contador de duelos cuenta estados distintos de `waiting`, incluidas salas canceladas, aunque la 0076 describe que solo cuenta partidas iniciadas. Esta entrega muestra la cifra del servidor; su corrección se registra como mejora independiente.
