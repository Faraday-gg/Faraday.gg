# 0086. Gráficas ampliadas y partida extra en Traza la tendencia

- **Estado:** en revisión.
- **Fecha:** 2026-11-17.
- **Quién:** Álvaro, con Codex.
- **Amplía:** [decisión 0085](0085-traza-la-tendencia.md).

## Decisión

- El tramo oculto ocupa el 63 % del eje horizontal y se distingue del historial con una marca de corte. El gráfico divide cada intervalo en 16 segmentos de dibujo, dibuja guías y muestra fecha y valor mientras se arrastra. Se puntúa solo en las fechas que tienen observaciones reales.
- El avatar queda de pie a la izquierda en escritorio y encima de la gráfica en móvil. Durante el arrastre sigue el puntero o el dedo mediante el sistema de mirada del avatar. Al revelar, el resultado da uno de cinco niveles y el correspondiente gesto.
- El banco de juego tiene 102 gráficas. 75 son series mensuales de visitas a artículos de Wikipedia en español sobre videojuegos, música, cine, deporte y curiosidades, de [Wikimedia Analytics](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html), licencia CC0. Las 27 restantes son series WDI sobre Internet, viajes, energía y naturaleza. Se conserva el banco anterior para que un jugador que ya empezó la edición pueda terminarla.
- Tras completar las tres gráficas de la diaria se ofrece una partida extra de tres gráficas distintas. El servidor guarda un único desbloqueo por día y jugador. La suscripción activa lo concede sin publicidad. El flujo gratuito usa el anuncio de prueba de Faraday, con espera de 15 segundos. La comparación comunitaria sigue usando intentos reales de la misma gráfica.
- «Ver suscripción» abre el plan de Faraday. La contratación usa el flujo de Stripe disponible en el perfil cuando está configurado.

## Consecuencias

- Hace falta la migración `20261117130000_repeticiones_tendencias` después de `20261117120000_tendencias`.
- El anuncio de prueba simula la espera y permite ensayar el flujo. Queda pendiente la integración con publicidad real y la confirmación de impresiones del proveedor.
