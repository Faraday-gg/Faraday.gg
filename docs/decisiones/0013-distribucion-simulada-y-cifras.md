# 0013 — Distribución simulada, multiplicador animado y cifras más legibles

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
Con pocos jugadores, el gráfico de cada respuesta salía casi vacío. Luis pidió poblarlo con estimaciones simuladas, animar el multiplicador, mostrar de dónde sale el dato y separar las cifras, que se veían apretadas.

## Decisión
- **Muestra simulada en el navegador, nunca en la base de datos.** Mientras una pregunta tenga menos de 30 respuestas reales, el gráfico usa 600 estimaciones simuladas, siempre las mismas para cada pregunta:
  - Siguen una campana en escala logarítmica alrededor de la cifra real: el 82 % con un ligero sesgo a quedarse corto y el 18 % con colas más anchas.
  - El gráfico lleva la etiqueta «simulación», y la posición dice «Más cerca que el X% · simulación».
  - Con 30 o más respuestas reales se usan las reales.
- **Rango fijo del gráfico:** de una décima a diez veces la cifra real. Si tu respuesta cae fuera, tu marca se queda en el borde («‹ Tú» o «Tú ›»).
- **Multiplicador animado:** sube desde 1× hasta su valor en escala logarítmica (de 0,7 a 1,6 s), así que 2× y 961.538× se ven igual de fluidos. No se anima si el sistema pide reducir el movimiento.
- **Fuente resumida** bajo la cifra real: el título de la primera fuente, enlazado.
- **Cifras en Manrope** (Google Fonts), con números tabulares y sin espaciado negativo, en el multiplicador, «Tú / Real» y el resumen.

## Alternativas descartadas
- **Insertar respuestas inventadas en Supabase:** los jugadores las verían como respuestas reales y se escribiría en la única base de datos, la de producción.
- **Mezclar respuestas reales y simuladas:** no dejaría claro qué es real.

## Consecuencias
- El porcentaje «Más cerca que…» es orientativo mientras se muestre la simulación.
- Hay una fuente web más (Manrope).
