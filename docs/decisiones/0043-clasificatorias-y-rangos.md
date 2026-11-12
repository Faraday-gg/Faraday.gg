# 0043. Clasificatorias y rangos en los duelos, de Bronce a Científico

- **Estado:** propuesta (código en la rama `feat/clasificatorias-rangos`; migración `20261112200000_rangos` **sin aplicar**)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Amplía:** la [0023](0023-duelos-1vs1.md), que dejaba fuera «divisiones y clasificación por puntos».

## Contexto

Luis quiere partidas clasificatorias en los duelos 1 vs 1, con rangos al estilo de Rocket League, Valorant o League of Legends: tres divisiones por rango (III → II → I), desde Bronce hasta un rango máximo, Científico, que se ordena por puntos. Los puntos de rango (PR) suben al ganar y bajan al perder, con ajuste por el nivel del rival, y el cálculo lo hace el servidor. Se desbloquean en el **nivel 10**, el mismo umbral que las apuestas de faradios.

## Decisión

### Rangos

Ocho rangos. Los tres primeros son los de siempre, para que se entiendan sin explicación; los siguientes siguen el tono del juego (estimaciones y ciencia), entre la broma y lo serio.

| Rango | Valoración | Por qué ese nombre |
| --- | --- | --- |
| Bronce III · II · I | 0 – 299 | Todo el mundo empieza contando con los dedos. |
| Plata III · II · I | 300 – 599 | Ya sabes si algo son cientos o millones. |
| Oro III · II · I | 600 – 899 | Aciertas el orden de magnitud casi siempre. |
| Calculista III · II · I | 900 – 1199 | Haces la cuenta de cabeza antes de que el rival abra la calculadora. |
| Estimador III · II · I | 1200 – 1499 | Lo tuyo es el ≈: no sabes la cifra, pero la clavas. |
| Doctorando III · II · I | 1500 – 1799 | Cuatro años de tesis para responder «depende», pero con intervalo de confianza. |
| Eminencia III · II · I | 1800 – 2099 | Te citan en las sobremesas: «lo ha dicho una eminencia». |
| Científico | 2100 o más | La cumbre: sin divisiones; se muestran los PR por encima de 2100 y la clasificación de los 10 mejores. |

Cada división son 100 PR. Por dentro, cada jugador tiene una sola cifra (`rating`), y el rango sale de ella: `tier = floor(rating / 100)`.

### Puntos de rango (PR)

Elo simple, con la valoración que tenía cada uno **al empezar** el duelo (la que se vio en pantalla):

```
esperado = 1 / (1 + 10^((rival − tú) / 400))
cambio   = redondeo(K × (resultado − esperado))     resultado: 1 gana, 0 pierde
K = 36   (ganar a un igual: +18; perder: −18)
```

- **Límites:** ganar siempre suma al menos 6 y perder resta al menos 6; nunca más de 40 (80 en posicionamiento). Nunca por debajo de 0.
- **Empate:** neutro, 0 PR (cuenta como partida jugada).
- **Abandono:** cuenta como derrota para quien se va y victoria para el otro.
- **Colchón:** al subir de división se tienen 3 partidas en las que perder no te devuelve a la división anterior (te quedas en 0 PR de la nueva).
- **Posicionamiento:** las 5 primeras partidas mueven el doble (K = 72) desde Plata III (300) y el rango no se enseña hasta terminarlas («Sin clasificar»).

### Emparejamiento

- El jugador elige **Normal** o **Clasificatoria** en el portal del duelo. Por debajo del nivel 10 la opción sale con candado y «Se desbloquea en el nivel 10».
- `buscar` con `mode: 'ranked'` solo se empareja con duelos en espera también clasificatorios. Si hay varios, elige el de valoración más parecida; si solo hay uno, juega con él aunque esté lejos (con poca gente, mejor partida que espera).
- No cuentan para clasificatoria: el bot, los duelos por código o enlace entre amigos y las revanchas. Un duelo clasificatorio no se puede unir por código.

### El servidor manda

- `lib/rangos.mjs` calcula todo. La valoración de cada jugador se guarda en el duelo al emparejarse (`players[].rank`), y al terminar el duelo se apuntan los PR de los dos.
- **Un duelo solo cuenta una vez:** cada ficha guarda los últimos 30 duelos apuntados con su resultado (`seen`). Si dos peticiones intentan apuntar el mismo duelo, la segunda recibe el mismo resultado sin tocar nada. Además, el duelo queda marcado (`rankSettled`) con control de versión.
- **Persistencia:** tabla nueva `ranks` en Supabase (migración `20261112200000_rangos`, **sin aplicar**) y `runtime/rangos.json` en local. Si la tabla no existe o falla, la clasificatoria responde 503 y los duelos normales siguen funcionando; los PR de un duelo terminado se reintentan en la siguiente consulta.

### Interfaz

- Insignias propias en SVG (escudo con el color del rango, un icono distinto por rango y puntos de división: III = 1, II = 2, I = 3; Científico lleva corona). Sin imágenes externas ni marcas.
- Rango en el portal del duelo (tarjeta con barra de PR), en la presentación «VS», en el marcador (en móvil, solo la insignia) y en el perfil, debajo del nivel.
- Pantalla final con «+18 PR» / «−12 PR», barra que se llena y animación al subir (la insignia salta con un destello y suena un arpegio) o bajar (tiembla y se apaga). Respeta «reducir movimiento».

## Limitación: el nivel lo declara el navegador

El nivel vive en el navegador (`dist/progress.js`, `levelOf(xp)`) y llega al servidor con el perfil del duelo, como hasta ahora. El servidor **sí** rechaza `buscar` en clasificatoria con nivel menor que `RANKED_MIN_LEVEL = 10` (403), pero no puede comprobar que ese nivel sea verdad: quien edite su `localStorage` puede entrar antes. Se arreglará cuando el progreso viva en el servidor (ver [idea de inicio de sesión](../ideas/login-con-supabase.md)).

## Alternativas descartadas

- **Rango y PR en el navegador**, como el nivel: se falsea con editar `localStorage` y no sirve para emparejar.
- **Glicko o TrueSkill:** más precisos con pocas partidas, pero más difíciles de explicar y de probar. El posicionamiento con K doble cubre lo principal.
- **Emparejar solo dentro de una franja de valoración:** con los jugadores que hay ahora, la cola de clasificatoria se quedaría vacía. Se prefiere al más parecido, sin excluir.
- **Columnas nuevas en `duels`** (por ejemplo `mode`) para filtrar en la base de datos: el filtro por modo se hace en el servidor sobre los 5 duelos en espera más recientes, que es suficiente con poco tráfico.
- **Contar los duelos por código entre amigos:** facilita subir de rango jugando contra uno mismo o contra un amigo que se deja ganar.

## Consecuencias

- Hasta que se aplique la migración, la clasificatoria no funciona en Vercel (503); en local, sí.
- Alguien con dos navegadores puede buscar clasificatoria a la vez desde los dos y ganarse a sí mismo. No se intenta impedir por ahora (sin cuentas no hay forma fiable); si pasa, se puede limitar los PR contra el mismo rival en el mismo día.
- La búsqueda mira solo los 5 duelos en espera más recientes de los dos modos. Si hubiera mucha gente en partida rápida normal, una clasificatoria en espera podría no verse: entonces conviene filtrar por modo en la consulta.
- No hay temporadas ni reinicio de rangos. Si se añaden, basta con bajar `rating` hacia la media al empezar cada temporada.
