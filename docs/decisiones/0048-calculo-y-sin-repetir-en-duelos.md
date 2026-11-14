# 0048 — «Cómo se calcula» y preguntas sin repetir en los duelos

- **Fecha:** 2026-11-14
- **Quién:** Luis, con Claude Code
- **Modifica:** los duelos de la [decisión 0023](0023-duelos-1vs1.md) (también las clasificatorias, que son duelos) y reutiliza el panel de la [decisión 0029](0029-calculo-por-pasos.md)

## Contexto
En el reto diario, tras responder se puede abrir «Cómo se calcula». En los duelos (con amigos, partida rápida, clasificatoria y contra el bot) solo se veía la cifra real y la fuente.

Además, cada duelo barajaba las ~290 preguntas de días pasados sin mirar las partidas anteriores. En tres duelos seguidos es normal que se repitan dos o tres preguntas (con 10 de 290 por duelo, cada par de duelos comparte de media una tercera parte de una pregunta, y se acumula con el número de partidas y con las del rival).

## Decisión
- **Cálculo:** al terminar cada ronda, el servidor manda el cálculo de la pregunta (`calc`, razonamiento, cuenta de referencia, supuestos y fuentes) en `round.explain`. Durante la pregunta no viaja. El duelo lo pinta con el mismo `explainMarkup` del reto diario, plegado en «Cómo se calcula». Como el resultado de la ronda solo dura 10 s, al final del duelo hay un **repaso**: cada pregunta con la cifra real, las dos respuestas y su cálculo, plegada.
- **Sin repetir:** al empezar un duelo se miran las preguntas de los últimos 25 duelos de **cada** jugador (`RULES.memory`). Salen primero, al azar, las que ninguno de los dos ha visto; si no llegan a diez, las que se vieron hace más tiempo. Las del creador se guardan en el duelo mientras espera rival (`state.seen`) y se borran al empezar.
- En Supabase se piden solo los ids (`select=questions:state->questions`), sin el estado entero. Sin migración.

## Alternativas descartadas
- **Guardar en cada jugador la lista de preguntas vistas.** Haría falta una tabla o columna nueva; los propios duelos ya guardan qué preguntas salieron.
- **Pausar el resultado de la ronda mientras el cálculo está abierto.** Cambia el ritmo para el rival; el repaso final cubre el caso.
- **Evitar también las del reto diario.** El servidor no sabe qué días ha jugado cada uno con el mismo identificador; queda como idea.

## Consecuencias
- Con 25 duelos de memoria y ~290 preguntas, un jugador ve unas 250 distintas antes de que se repita ninguna.
- La búsqueda por jugador en `duels` usa contención en `state` sin índice; si la tabla crece, conviene un índice (ver mejoras).
