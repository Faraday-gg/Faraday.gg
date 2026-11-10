# 0018 — Color de la tarjeta de pregunta según su categoría

- **Fecha:** 2026-11-10
- **Quién:** Luis, con Claude Code

## Contexto
Todas las tarjetas de pregunta eran coral (decisión 0010), así que las tres preguntas de un reto se veían iguales. Luis pidió unos seis colores vivos y llamativos, según la categoría, conservando el coral.

## Decisión
- La pantalla de pregunta toma su fondo del campo `tone` de la categoría en `dist/categories.js`. Seis tonos agrupados por tema:

  | Tono | Fondo | Categorías | Contraste del texto tinta |
  | --- | --- | --- | --- |
  | coral | `#ff6548` | lugares, arquitectura | 5,2:1 |
  | mostaza | `#ffb627` | comida, dinero | 8,7:1 |
  | verde | `#2fd67b` | naturaleza, cuerpo humano | 8,0:1 |
  | cian | `#3fc5f0` | espacio, transporte, tecnología | 7,6:1 |
  | violeta | `#b49bff` | cultura, historia | 6,6:1 |
  | rosa | `#ff7aa8` | deportes, vida cotidiana | 6,2:1 |

- El texto sigue en tinta `#202630` y el acento en azul noche `#23395b`, así que la cadena de la 0010 (el acento de la pregunta es el fondo de la respuesta) se mantiene. La respuesta y el resultado final no cambian.
- Una categoría sin `tone` (o desconocida) usa coral.

## Alternativas descartadas
- Un color distinto por cada una de las 13 categorías: demasiados tonos parecidos entre sí.
- Usar el amarillo `#ffdb70` como tono: se confundiría con el resultado final.
- Tonos oscuros con texto claro: rompían la cadena con el azul noche de la respuesta.

## Consecuencias
- Al añadir una categoría hay que darle un `tone` de la tabla.
- Modifica la fila «Pregunta» de la paleta de la decisión 0010.
