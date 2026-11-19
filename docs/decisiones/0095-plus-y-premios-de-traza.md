# 0095. Plus visible y premios de precisión en Traza

- **Estado:** implementada; integración en `preprod`. El cobro real sigue sujeto a la configuración de la 0077.
- **Fecha:** 2026-11-19
- **Quién:** Álvaro, con Codex.
- **Concreta:** [0055](0055-tokenomics-suscripcion-y-mercado.md), [0066](0066-cifras-de-la-economia-nueva.md), [0077](0077-cobro-con-stripe.md) y [0091](0091-reanudar-trazos-y-partidas-extra.md).

## Contexto

«Ver suscripción» era una acción secundaria junto al anuncio. El perfil todavía describía una sola partida extra, aunque Traza ya admite partidas ilimitadas. Traza tampoco daba premios en la economía común. Álvaro pide mejorar la monetización y premiar el acierto.

La economía existente emite faradios por retos, duelos, misiones, niveles y cofres; los gasta en cosméticos, cofres, pistas, votos, ediciones, protector y cambios de misión. Hay un límite común de 400 faradios ganados jugando al día. Los lotes de cofres y los premios de nivel quedan fuera, según la 0066. Plus no vende moneda ni mejora los premios.

## Plan y ejecución

1. **Explicar el valor en el momento de querer seguir.** Panel amarillo con la pregunta «¿Y si la siguiente fuera tu mejor curva?», beneficios inmediatos y acción «Quiero jugar sin anuncios» cuando el cobro está disponible. El perfil detalla Traza y duelos ilimitados, piezas de suscriptor y anuncios de venta sin tope. Corrige la promesa antigua de una partida extra.
2. **Mostrar condiciones reales.** El precio viene de Stripe. Se explica la renovación automática y cómo cancelar. Sin cobro configurado se muestra «Descubrir Plus» y su disponibilidad, sin inventar un precio, descuento, plazo, existencias ni prueba gratis. Se conserva una alternativa visible para seguir gratis con anuncios de prueba ilimitados. Se mantiene el Checkout alojado ya existente: [documentación de Stripe](https://docs.stripe.com/payments/checkout).
3. **Premiar la diaria, sin fomentar emisión ilimitada.** Recompensa de la cuenta calculada de sus tres trazos persistidos. No se aceptan puntuación, cantidad o cofre declarados por el cliente. La interfaz la recoge al abrir el resumen y permite reintentar si falla. Sin cuenta se enseña el premio potencial y se invita a entrar para guardarlo. Al cerrar antes del resumen se puede volver a abrir ese mismo día.
4. **Simular antes de fijar los límites.** Se añade `scripts/simular-traza.mjs`, sin red ni datos personales, y una opción de Traza en el simulador económico existente. Se prueban también puntuaciones perfectas todos los días.

### Premios

| Puntos de las tres gráficas | Faradios | Cofre |
| --- | ---: | --- |
| 0–1.799 | 10 | — |
| 1.800–2.399 | 15 | — |
| 2.400–2.699 | 25 | — |
| 2.700–3.000 | 35 | Chispa, si aún no se obtuvo el de precisión esa semana |

- Un premio de moneda por cuenta y día de Madrid; cuenta dentro de los 400. Los extras sirven para practicar y comparar y no emiten premios.
- Máximo **un cofre de precisión por semana**, de lunes a domingo de Madrid. Se concede aun si ya se alcanzó el tope de moneda.
- Mismos umbrales para gratuito y Plus. Pagar evita anuncios; no compra acierto, faradios ni cofres.
- La referencia contable es la fecha, sin distinguir Preview de producción, para impedir cobrar dos veces con la misma cuenta. Ambos entornos comparten el progreso existente.
- Los faradios usan `ledger`, motivo `traza`. El índice único de motivo y referencia impide duplicados. El cofre usa la versión optimista de `stats`, con recibo diario y semana del último cofre. Si falla el pago después de guardar el cofre, el reintento lo recupera sin duplicarlo. El importe ya pagado se lee del apunte para mostrar correctamente premios recortados por el límite.
- Sin migraciones ni dependencias nuevas: se reutilizan `player_progress.stats`, `stats_version`, el inventario de cofres y el libro contable.

### Simulación reproducible

`node scripts/simular-traza.mjs`. Se puntúan 7.200 partidas sintéticas: 200 perfiles de los cuatro modelos de tendencia existentes sobre las 36 ediciones del banco. Solo se usa el historial visible para generar las curvas. Promedio: **1.715,69 puntos, 12,70 faradios por partida**, y 0,097 % de partidas alcanza el umbral de cofre. No representa la distribución de habilidad de jugadores reales.

Después se simulan 365 días y 40 semillas por perfil con las reglas `PROPUESTA` existentes. Se supone que juega Traza los días que juega el reto. Estas reglas incluyen gastos propuestos del mercado; por tanto, el resultado no es una medida de la economía en producción.

| Perfil | Emisión diaria base → con Traza | Gasto/emisión, últimos 60 días, con Traza |
| --- | ---: | ---: |
| Ocasional | 59,74 → 68,00 | 101 % (puede gastar saldo anterior) |
| Diario | 222,96 → 233,23 | 85 % |
| Intenso | 330,04 → 343,43 | 90 % |

El perfil diario aumenta su emisión un 4,6 %. Completa el catálogo hacia el día 223 frente a 246 de base. En el estrés de 3.000 puntos todos los días emite 263,86 diarios y absorbe el 76 % en los últimos 60 días: queda por debajo del objetivo del 80–95 % de la 0055. **No se da por validado ese escenario extremo**; exige seguimiento antes de ampliar premios. Con cofre diario, el mismo estrés emitía 313,03 y completaba el catálogo hacia el día 132: se descarta. El límite semanal lo retrasa hacia el día 190.

## Alternativas descartadas

- Urgencia artificial, descuento no configurado, reloj o garantía de conversión: no hay una oferta real que los justifique. El incentivo es seguir jugando sin interrupciones.
- Cofres diarios de precisión o premios en todas las partidas extra: aceleran demasiado la colección y permiten emisión repetida.
- Más moneda para Plus: contradice la separación entre suscripción y moneda de la 0055.
- Pagar una cantidad declarada desde el navegador: la fuente son las respuestas del servidor.

## Consecuencias y seguimiento

- No hay garantía de que una mayoría pulse Plus. Antes de afirmar una mejora de conversión harán falta impresiones de la oferta, clics, altas completadas, renovaciones y abandono. No se añade un servicio de analítica ni telemetría individual en esta entrega.
- `ledger_daily`, motivo `traza`, permite auditar emisión real. Revisar los umbrales si el perfil diario supera el objetivo de gasto, aumenta la frecuencia de cofres o se acorta excesivamente la colección. No aumentar premios para corregir falta de clics en Plus.
- Siguen pendientes la cuenta/configuración de Stripe, una prueba de cobro real y las condiciones de venta de la 0077. Tampoco se aplican las migraciones históricas de Traza en la base compartida: su disponibilidad en Vercel depende de ellas.
- El tope común usa la comprobación y el pago separados que ya existían: dos fuentes distintas cobradas a la vez pueden sobrepasarlo. El premio de Traza y su cofre sí son idempotentes bajo concurrencia. Se registra el cierre atómico del tope como mejora aparte.
