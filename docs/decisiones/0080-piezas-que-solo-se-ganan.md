# 0080. Piezas del avatar que solo se ganan: de rango y de medalla

- **Estado:** propuesta (código en la rama `feat/piezas-que-se-ganan`; sin migración)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0024](0024-avatar-faradios-y-misiones.md) (piezas por nivel), la [0030](0030-momento-casi-casi.md) (pieza por «Casi casi»), la [0035](0035-medallas-e-insignias.md) (medallas) y la [0043](0043-clasificatorias-y-rangos.md) (rangos).

## Contexto

Luis quiere que el avatar pese más: que la gente juegue para conseguir cosas y luego pueda enseñarlas, pensando en streamers e influencers. Al comparar con Fortnite, Roblox, Rocket League y Valorant, lo que más se presume en esos juegos **no se compra**: son las recompensas de rango y de logro, porque dicen algo de quien las lleva. El análisis completo y el resto de pasos están en la [idea «El avatar como escaparate»](../ideas/avatar-como-escaparate.md).

En nuestro armario casi todo salía de la tienda o de los cofres. Solo se ganaban ocho piezas (por nivel, por 10 «Casi casi» y por el Circuito), y ninguna decía lo bueno que es alguien jugando: el rango de las clasificatorias y las medallas no se veían en el avatar.

## Decisión

Dos condiciones nuevas en el catálogo (`dist/avatar.js`), junto a `level`, `casi` y `circuito`:

- **`rango`**: la pieza se tiene al llegar a ese rango en las clasificatorias. **No se pierde al bajar**: cuenta el rango más alto alcanzado.
- **`medalla`**: la pieza se tiene al conseguir esa medalla o insignia.

Ni se compran, ni salen en cofres, ni tienen acabados, ni se funden, ni se venden en el mercado.

### Las primeras piezas (10 por cuerpo)

| Pieza | Se gana con |
|---|---|
| Universitaria Oro, Calculista, Estimador, Doctorando, Eminencia y Científico | Llegar a ese rango. Negra, con el color del rango, su escudo en el pecho y su nombre a la espalda. |
| Átomo (cabeza) | Llegar a Científico. Tres órbitas doradas sobre la cabeza, como el icono del rango. |
| Sudadera Corriente continua | Medalla «Corriente continua» de oro (30 días seguidos). |
| Sudadera En el clavo | Insignia «En el clavo» (una respuesta a menos de 1,01×). |
| Sudadera Duelista | Medalla «Duelista» de oro (50 duelos ganados a personas). |

Bronce y Plata no dan pieza: es donde empieza todo el mundo. Las sudaderas de medalla llevan la medalla en un disco dorado en el pecho y su nombre a la espalda.

### Cómo se ve

- En el armario salen con el candado y la condición («Rango Oro», «Corriente continua · Oro»). Al probarlas se explica cómo se consiguen.
- La ficha de cada medalla dice qué pieza da.
- Al subir a un rango con pieza o conseguir la medalla sale un aviso: «Pieza nueva en tu armario».

### Código

- `dist/avatar.js`: `RANKS`, las piezas (`rankPieces`, `medalPieces`) y `Avatar.earned(pieza)`, que reúne todas las condiciones de «se gana».
- `dist/avatar3d.js`: estampados `%rango` y `&medalla` y el sombrero `atomo`.
- `lib/rangos.mjs`: lo que ve el navegador de un rango lleva `best`, el rango más alto alcanzado (sale de `peak`, que ya se guardaba). `dist/ranked.js` lo recuerda y avisa con el evento `faraday:rango`.
- `dist/progress.js`: quién tiene cada pieza, el candado, la explicación y los avisos. `lib/catalogo.mjs` usa `Avatar.earned`.
- `tests/ganadas.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Quitar la pieza al bajar de rango.** Sería más «verdad», pero rompe la regla de la 0035 (nada se pierde, juegan menores) y castiga seguir jugando clasificatorias.
- **Un aura o efecto alrededor del avatar.** Es lo que más se vería, pero pide un hueco nuevo en el look y trabajo en el dibujo 3D. Queda en la idea.
- **Piezas para todas las medallas y niveles.** Diez piezas bastan para probar si a la gente le importa; cada pieza nueva es una línea en el catálogo.
- **Piezas de temporada que caducan.** Darían escasez, pero ya decidimos no usar cuentas atrás ni miedo a perderse algo.
- **Un título bajo el nombre** («El del clavo»). Encaja, pero toca lo que viaja en duelos y ligas; queda en la idea.

## Consecuencias

- **Las piezas de rango son de fiar**: el rango lo calcula y lo guarda el servidor.
- **Las de medalla no lo son todavía**: las medallas siguen declaradas por el navegador ([0065](0065-cierre-de-la-economia-en-el-servidor.md)), así que con el navegador manipulado alguien puede ponérselas. Lo arregla llevar las medallas al servidor ([mejoras](../mejoras/README.md)).
- **Lo que lleva puesto un jugador sigue sin comprobarse al enseñarlo a otros** (ya apuntado en la [0067](0067-ediciones-de-coleccion.md)): vale también para estas piezas.
- **El rango más alto cuenta desde las partidas de posicionamiento**, donde la valoración se mueve el doble: alguien puede quedarse con la pieza de un rango que solo rozó en esas cinco partidas.
- **Quien ya tenía rango** recibe sus piezas al abrir el perfil o los duelos, con el aviso.
- Los umbrales (medallas de oro, no de diamante) están puestos a ojo para que alguien las tenga pronto. Revisar con datos.
- Sin pruebas automáticas del dibujo: se ha mirado a mano en el navegador.
