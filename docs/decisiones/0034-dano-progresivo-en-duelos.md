# 0034. Daño progresivo en los duelos

- **Estado:** propuesta (código en la rama `fix/dano-progresivo-duelos`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Cambia:** la tabla de la [0023](0023-duelos-1vs1.md) en la fila del multiplicador de daño.

## Contexto

En la 0023 el daño de una ronda era la diferencia de puntos ×1 en las rondas 1 a 3 y crecía +0,5 por ronda a partir de la cuarta. Con 6000 de vida y hasta 5000 puntos por respuesta, un 5000 a 0 en la primera pregunta quitaba el 83 % de la vida y la segunda ronda perdida acababa la partida. Un solo despiste al principio decidía el duelo. Luis pidió algo progresivo, como en GeoGuessr: partidas reñidas en las que el multiplicador de daño suba poco a poco a medida que avanzan las preguntas.

## Decisión

El multiplicador sube en **cada** ronda y empieza muy por debajo de 1 (`DAMAGE` en `lib/duelos.mjs`):

| Ronda | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Daño | ×0,2 | ×0,3 | ×0,4 | ×0,5 | ×0,6 | ×0,8 | ×1 | ×1,25 | ×1,5 | ×2 |

El resto no cambia: 6000 de vida, 0 a 5000 puntos por respuesta, pierde vida quien puntúa menos (la diferencia por el multiplicador) y tope de 10 rondas.

Qué supone, con la misma diferencia en todas las rondas:

| Diferencia por ronda | K.O. en la ronda |
|---|---|
| 5000 (uno clava y el otro no responde) | 4 |
| 3000 | 5 |
| 1500 | 8 |
| 800 | 10 |

Nadie puede caer en las tres primeras rondas (lo más que se pierde en ellas es 4500) y lo que se pierde al principio se puede remontar en las rondas finales, que valen mucho más.

En pantalla el multiplicador se ve siempre, también por debajo de ×1: «Ronda 1 · daño ×0,2» en la pregunta y en el marcador, el multiplicador junto al daño en el resultado y «Atención: en la siguiente ronda el daño sube a ×…» antes de cada ronda. La pantalla «VS» avisa: «El daño empieza flojo y sube en cada ronda».

## Alternativas descartadas

- **Subir la vida inicial** (por ejemplo, a 15 000) manteniendo el multiplicador antiguo: alarga las partidas fáciles, pero las primeras rondas siguen pesando tanto como las últimas y no da la sensación de tensión creciente.
- **Fórmula exponencial** (×0,2 · 1,3^(ronda−1)): da casi los mismos números, pero con multiplicadores como ×0,44 o ×1,63, difíciles de leer. La tabla usa valores redondos.
- **Tope de daño por ronda**: evita las palizas, pero también aplana las rondas finales, que son las que deben decidir.
