# 0083. Multiplicadores personales en los duelos

- **Estado:** propuesta
- **Fecha:** 2026-11-17
- **Quién:** Álvaro, con Codex
- **Actualiza** el daño por ronda de las decisiones [0034](0034-dano-progresivo-en-duelos.md) y [0082](0082-duelos-1vs1vs1.md) para los duelos entre jugadores.

## Contexto

Álvaro quiere que la ventaja aumente al ganar preguntas. Aplicar la subida a partir de la siguiente pregunta permite ver de antemano cuánto vale el daño de cada jugador.

## Decisión

En el 1v1 normal, el 1v1 clasificatorio y el 1v1v1, cada participante empieza con ×1. Se comparan las puntuaciones de la ronda. A cada jugador por debajo del primero se le resta de la vida la diferencia con la puntuación más alta, multiplicada por el factor de quien quedó primero. El servidor redondea el daño al entero más cercano y limita la vida a un mínimo de 0.

Ganar la ronda en solitario suma 0,5 al multiplicador personal para la siguiente pregunta. El jugador conserva lo acumulado aunque pierda otra ronda. En caso de empate arriba, los líderes conservan su vida y su multiplicador. Si queda alguien por debajo, se aplica el mayor multiplicador entre quienes empataron en cabeza.

El marcador muestra el multiplicador de cada participante junto a su vida. El resultado muestra el factor aplicado y, si la partida sigue, avisa de quién sube su multiplicador para la siguiente pregunta.

## Alternativas descartadas

El multiplicador global por número de ronda da el mismo factor a todos independientemente de su rendimiento. Contar los aciertos por proximidad a la cifra real permitiría sumar el bono a varios jugadores aunque uno de ellos obtuviera más puntos. Álvaro eligió la victoria por puntos como condición para aplicar el bono.

## Consecuencias

Los duelos de práctica y los que ya empezaron con la progresión por ronda siguen la [decisión 0034](0034-dano-progresivo-en-duelos.md). Los nuevos factores se guardan en el estado JSON de cada ronda, con el mismo control de versión que las respuestas y la vida.
