# 0013 — Preguntas de cultura general, referentes conocidos y foto solo cuando ayuda

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
Las 297 preguntas escritas a mano (archivo del 9 de agosto al 8 de noviembre y piloto del 9 al 15 de noviembre) tenían todas foto y muchas eran demasiado españolas o locales: sitios poco conocidos fuera de su región o datos que casi nadie puede estimar. Luis quiere que cualquiera las entienda y se divierta.

## Decisión
- **Cultura general mezclada:** cada pregunta combina dos ideas que conoce todo el mundo, un objeto cotidiano y un referente famoso, con humor. Por ejemplo, ositos de gominola y la Estatua de la Libertad.
- **Referentes:** unas 2 de cada 3 son mundiales (71 %). Las hispanas tienen que ser muy conocidas por cualquier hispanohablante. Nada de sitios o eventos locales.
- **Preguntas específicas:** hay una más difícil aproximadamente cada tres días (34 en total), y tiene que ser interesante o graciosa.
- **Fotos:** solo entre el 15 y el 20 % de las preguntas llevan foto (ahora, 50 de 297), las que ayudan a imaginar la escala o algo que la gente no tiene en la cabeza. Si el referente lo conoce todo el mundo (un gorila, un balón), va sin foto. `tests/editorial.test.mjs` comprueba ese porcentaje.
- **Banco automático congelado:** el banco del 16 de noviembre al 14 de diciembre ya está publicado y no se revisa. Para que no cambie al reescribir el piloto, `content-engine.mjs` lo genera a partir de `content/banco-base.json`, una copia de las 21 preguntas del piloto tal como se publicaron.
- **Ids:** las preguntas del piloto que cambian llevan un id nuevo (`piloto-v3-<fecha>-<posición>`). Las del archivo conservan `archivo-<fecha>-<posición>`, porque aún no estaban en producción.

## Alternativas descartadas
- **Revisar también el banco automático:** Luis prefirió dejarlo como está y revisarlo aparte.
- **Mitad mundial y mitad hispano, o casi todo mundial:** se eligió una mayoría mundial con lo hispano muy conocido.
- **Una pregunta difícil al día:** eran demasiadas; Luis eligió una cada tres días.

## Consecuencias
- Sustituye en parte a la [decisión 0008](0008-categorias-y-archivo.md) en lo que se refiere a las fotos: ya no las lleva toda pregunta.
- Al publicar en producción se retiran de Supabase las preguntas antiguas del piloto que cambian de id. El 10 de noviembre no tenían respuestas; si las tienen al publicar, la publicación se detiene con un mensaje claro ([lib/publicar.mjs](../../lib/publicar.mjs)).
- Las fotos del repositorio bajan de unos 75 MB a 21 MB.
- Las reglas y el formato para escribir preguntas nuevas están en `research/revision-instrucciones.md`.
- **Actualización (2026-11-12):** la [decisión 0046](0046-preguntas-de-latinoamerica.md) cambia el reparto (ámbito sorteado: mundial, España o Latinoamérica, sin fórmula fija), pide español neutro y sustituye el banco congelado del 16 de noviembre al 14 de diciembre por jornadas escritas a mano.
