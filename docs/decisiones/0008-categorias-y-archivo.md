# 0008 — Categorías con icono y archivo desde el 9 de agosto de 2026

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
La portada no decía de qué iban las preguntas del día y solo había jornadas desde el 9 de noviembre. Luis pidió un icono por tipo de pregunta y preguntas de los tres meses anteriores, día a día.

## Decisión
- Cada pregunta lleva `category`, una de 13: deportes, comida, espacio, naturaleza, lugares, arquitectura, cultura, historia, transporte, tecnologia, cuerpo, dinero y hogar. Están en `dist/categories.js` con iconos propios. Las tres preguntas de un día tienen categorías distintas.
- Los retos se numeran desde el 9 de agosto de 2026 (Nº 1). La portada muestra el número y los iconos de las tres preguntas.
- El archivo vive en `content/archivo/AAAA-MM-DD.json`, una jornada por archivo: 92 días y 276 preguntas con fuentes, foto con licencia libre de Wikimedia Commons y razonamiento, como las del piloto. En Supabase se guarda con `source = piloto`.
- El archivo de la web muestra solo días pasados, del más reciente al más antiguo. El calendario manda completas las jornadas de los últimos 30 días y solo un resumen de las anteriores, que se cargan al abrirlas.

## Alternativas descartadas
- Hacer las 276 preguntas sin foto (más rápido) o por tandas en varias PR: Luis prefirió todas de golpe y con la misma calidad.
- Meter el archivo en `dist/questions.json`: cambiaría los índices del banco editorial de `content-engine.mjs` y engordaría `questions.js`, que carga cada visita.
- Un valor `archivo` en `days.source`: obligaba a una migración en producción.

## Consecuencias
- Al fusionar en `main`, el build de producción publicará 92 jornadas, 276 preguntas y 276 fotos nuevas en Supabase.
- Las fotos añaden unos 65 MB al repositorio.
- Algunas cifras dependen de fuentes secundarias o antiguas; se apuntan en [mejoras](../mejoras/README.md) para revisarlas.
