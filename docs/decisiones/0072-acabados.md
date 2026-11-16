# 0072. Acabados: versiones cromada, holográfica y dorada que salen en cofres

- **Estado:** propuesta (código en la rama `feat/acabados`; no necesita migración)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la tercera entrega de la fase 3 («escasez»), después de las ediciones ([0067](0067-ediciones-de-coleccion.md)) y la fundición ([0071](0071-fundicion.md)).

## Contexto

La 0055 pide «versiones cromada, holográfica o dorada de piezas que ya existen, con poca probabilidad en cofres». Son la escasez que no necesita dibujar piezas nuevas: la forma es la de siempre y cambia el material.

## Decisión

### Qué es un acabado

- Tres acabados: **cromado**, **holográfico** y **dorado**.
- Los pueden llevar las piezas **de pago** de cuatro huecos: ropa, pantalón, zapatillas y cabeza (346 piezas hoy). No las gratuitas, las de nivel, las exclusivas ni las ediciones.
- La pieza con acabado es **otra pieza del armario**, además de la normal. Se llama igual con el acabado detrás («Sudadera gris · dorado») y lleva su etiqueta.
- Con acabado, la prenda pierde su color y se ve entera del material; el estampado se sigue viendo, en un tono más oscuro.

### Cómo se consiguen

Solo en cofres. Cada pieza de esos cuatro huecos que sale de un cofre puede traer **además** su versión con acabado:

| Acabado | Probabilidad por pieza |
|---|---|
| Cromado | 3 % |
| Holográfico | 1 % |
| Dorado | 0,3 % |

- En total, un 4,3 % de las piezas. Las probabilidades se enseñan en la pestaña Cofres, con las demás.
- El jugador recibe las dos: la normal y la del acabado. En la apertura se enseña la del acabado.
- El sorteo del acabado va después del de las piezas: no cambia qué piezas salen.
- No se compran, no se reciclan y no se funden. La normal sí: reciclarla no quita la del acabado.

### Cómo se guardan

- No hay piezas nuevas en el catálogo. Un acabado va en el identificador, detrás de dos guiones: `sud-gris--or` (`cr` cromado, `ho` holográfico, `or` dorado). `Avatar.find` lo entiende y devuelve la pieza normal con el acabado apuntado.
- En el inventario (`items`) es una fila más, con origen `cofre`. No hay migración: el identificador cabe en la regla que ya había.
- Los avatares que viajan a duelos, ligas, referidos y preguntas de la comunidad aceptaban piezas de hasta 24 caracteres; ahora, hasta 28.

### Cómo se pintan

`dist/avatar3d.js` usa para la prenda un material de tipo «matcap»: una bola pintada que dice qué color se ve según hacia dónde mira cada punto. Da brillo de metal sin luces ni reflejos de verdad, y el holográfico cambia de color al girar el avatar. La silueta plana de reserva (la que se ve antes de cargar el 3D) no distingue acabados.

### Código

- `dist/avatar.js`: `FINISHES`, `FINISH_SLOTS`, `finishable` y `find`. `dist/chests.js`: `FINISH_ODDS` y `finishOf`; `roll` apunta el acabado en el premio.
- `dist/avatar3d.js`: el material y en qué partes del modelo se aplica.
- `lib/comunidad.mjs`: al abrir un cofre apunta también la pieza con acabado. `lib/duelos.mjs`, `lib/ligas.mjs` y `lib/referidos.mjs`: el largo de las piezas.
- `dist/progress.js` y `dist/armario.css`: el armario enseña las que se tienen, con su etiqueta.
- `tests/acabados.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Que el acabado sustituya a la pieza normal.** El jugador se quedaría sin la pieza «por conseguir» pese a haberla sacado.
- **Añadir las 1.038 variantes al catálogo.** Triplicaría el armario con piezas que casi nadie tiene; así solo aparecen las que se tienen.
- **Un acabado como dato aparte de la pieza** (una columna o un hueco nuevo del avatar). Obliga a cambiar el esquema y todo lo que valida un avatar; en el identificador viaja solo.
- **Venderlos en la tienda o darlos por nivel.** Dejarían de ser escasos.
- **Acabados en pelo, gafas o collares.** Varios ya son dorados o no tienen superficie donde se note.

## Consecuencias

- **Quien tiene el catálogo casi completo apenas verá acabados:** un cofre solo da piezas que no se tienen. La fundición lo compensa: reciclar una pieza permite que vuelva a salir, con una nueva oportunidad de acabado.
- **No emiten faradios ni cuestan nada**: no cambian las cifras del simulador.
- **Son candidatos a venderse en el mercado** (fase 4). Hoy son una fila por jugador y pieza, sin número de serie; si se venden habrá que decidir si se numeran.
- **El servidor no comprueba lo que lleva puesto el avatar**, como ya estaba apuntado en [mejoras](../mejoras/README.md): con el navegador manipulado se puede aparecer con un acabado que no se tiene.
- **Las probabilidades son una primera cifra.** Con 4,3 % por pieza, un jugador que abre un cofre al día verá un acabado cada dos o tres semanas; un dorado, una vez al año más o menos.
- Queda de la fase 3 la colección de temporada, que necesita piezas con diseño propio.
