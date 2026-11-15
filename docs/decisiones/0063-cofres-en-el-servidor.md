# 0063. El servidor lleva los cofres: cuándo se ganan, la compra y el sorteo

- **Estado:** propuesta (código en la rama `feat/cofres-servidor`; sin migración nueva)
- **Fecha:** 2026-11-15
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la entrega 4b de la fase 1 ([0062](0062-tienda-y-pistas-en-el-servidor.md)).
- **Cambia a:** la [0027](0027-cofres.md), que descartaba «sortear en el servidor» porque no había progreso allí. Con cuenta, ahora se sortea en el servidor. Las reglas de los cofres (0027 y [0036](0036-seis-cofres.md)) no cambian.

## Contexto

Los cofres eran lo último grande que el navegador decidía solo: cuándo se ganaba uno, qué salía al abrirlo y cuánto costaba comprarlo. Con el navegador manipulado se podían fabricar cofres o elegir el premio. Para el mercado de la 0055, las piezas tienen que salir de un sorteo que el jugador no controle.

## Decisión

- **Con cuenta, el servidor lleva los cofres sin abrir de cada jugador**, su batería, su racha y su cuenta de mala suerte, dentro de `player_progress.stats`. No hace falta migración.
- **Cuándo da un cofre el servidor**, con las mismas reglas que el navegador:

  | Cofre | Cuándo |
  |---|---|
  | Chispa | Al llenarse la batería: el reto de hoy carga 40, un reto del archivo 10 y un duelo 20 (5 pasado el tope diario; nada al abandonar ni al repetir contra el bot) |
  | Chispa / Rayo | Al recoger las tres misiones del día / de la semana |
  | Chispa, Rayo o Dinamo | Al subir de nivel (según el nivel) |
  | Imán, Tormenta o Faraday | En los hitos de racha (3, 7, 14, 30, 50, 100…) |

- **Comprar** (`action: 'comprar-cofre'`): el servidor cobra el precio y apunta el cofre. Tope de 3 al día, contado en el libro.
- **Abrir** (`action: 'abrir-cofre'`): **el sorteo se hace en el servidor**, con la misma función que usaba el navegador (`dist/chests.js`, cargado tal cual). Solo salen piezas que el jugador no tiene, del cuerpo que lleva puesto. Las piezas van al inventario (`items`, origen `cofre`) y los lotes de faradios al saldo, con el cofre como referencia. El navegador recibe los premios y solo los enseña.
- **La primera vez** se parte de lo que declara el navegador, con tope: hasta 30 cofres de cada tipo, la batería, la racha y **las piezas que ya tenía**, que pasan al inventario (origen `inicial`). Hacen falta para no sortear una pieza repetida.
- **`action: 'estado'`** devuelve también los cofres, la batería y la racha. El navegador los copia de ahí; con cuenta ya no apunta cofres por su cuenta.
- **El navegador ya no puede declarar los motivos `cofres` y `cofres-compra`.** Solo le quedan `bienvenida`, `referidos` y `otros`.
- Sin cuenta, todo sigue igual.

### Lo que queda declarado: los referidos

> **Nota (2026-11-15):** cerrado por la [0064](0064-premios-del-circuito-en-el-servidor.md): los premios del Circuito los reparte el servidor y `regalo-cofre` ya no existe.

Los premios del Circuito de amigos ([0038](0038-circuito-de-amigos.md)) los sigue repartiendo el navegador. Sus faradios se declaran con el motivo `referidos`, y sus cofres con `action: 'regalo-cofre'`: el servidor apunta el cofre sin poder comprobarlo, solo Rayo o Tormenta y **como mucho 2 al día**. Es un hueco conocido y acotado; se cierra cuando los referidos pasen al servidor.

### Las entregas de la fase 1

| Entrega | Estado |
|---|---|
| 1 a 4a | Hechas (0057 a 0062) |
| **4b. Cofres** | Esta |
| 4c. Referidos: sus faradios y sus cofres, calculados por el servidor | Pendiente |
| 5. Cierre: dejar de aceptar el saldo y las ganancias declaradas | Pendiente |

### Código

- `lib/cofres.mjs` (nuevo): carga `dist/chests.js` y lleva las cuentas de cofres, batería y racha.
- `lib/comunidad.mjs`: `withStats` inicia los cofres e importa las piezas; los premios de jornadas, duelos, misiones y nivel dan sus cofres; acciones `comprar-cofre`, `abrir-cofre` y `regalo-cofre`. `lib/stores.mjs`: `addItems`.
- `vercel.json`: `dist/chests.js` entre los archivos de la función.
- `dist/progress.js`: con cuenta, abrir y comprar preguntan al servidor (`showChest` enseña lo que llega), los cofres se copian del servidor (`syncServer`, `applyServer`) y los de regalo se piden con `gift`.
- `tests/cofres-servidor.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Sortear en el navegador y que el servidor solo compruebe.** No se puede comprobar un sorteo sin repetirlo; quien manda el resultado lo elige.
- **Copiar las reglas de los cofres al servidor.** Como con el catálogo: se carga el mismo archivo y no hay dos tablas de probabilidades que mantener iguales.
- **Una tabla para los cofres sin abrir.** Son seis números por jugador; caben en `stats` y se guardan con la misma protección que la experiencia.
- **No importar las piezas que ya tenía el jugador.** El primer cofre podría dar una pieza repetida.
- **Pasar ya los referidos al servidor.** Sus premios se reparten entre `lib/referidos.mjs` y el navegador (los escalones los calcula el navegador); es un trabajo aparte.

## Consecuencias

- **Abrir y comprar cofres necesita conexión** con cuenta, y tarda uno o dos segundos antes de empezar la animación.
- **Menos avisos inmediatos.** Sin cuenta, el aviso dice al momento «¡Batería llena: cofre Chispa!». Con cuenta, el cofre llega al sincronizar y el aviso es «¡Tienes un cofre nuevo!».
- **El cofre de regalo del Circuito no se abre solo** con cuenta: aparece en la pestaña de cofres unos segundos después.
- **La «corriente compartida»** del Circuito (+15 de batería) no carga la batería del servidor hasta la entrega 4c.
- **La regla «no se puede comprar un cofre si ya tienes todas las piezas que garantiza»** la sigue aplicando solo el navegador (desactiva el botón). El servidor no la comprueba: quien la salte recibe faradios en vez de la pieza, que valen menos que el cofre.
- **Lo declarado la primera vez sigue siendo declarado:** cofres (hasta 30 por tipo), piezas, saldo y experiencia. Es lo que cierra la entrega 5.
- **Depende de que `dist/chests.js` y `dist/avatar.js` estén en la función de Vercel.** Si faltan, los cofres responden «no disponibles» y el resto sigue.
- Sin migración nueva. Las cuatro anteriores ya están aplicadas.
