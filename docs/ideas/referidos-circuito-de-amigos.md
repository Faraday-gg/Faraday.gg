# Referidos: el «Circuito» de amigos

- **Estado:** aprobada: [decisión 0038](../decisiones/0038-circuito-de-amigos.md), con estas reglas. Los avisos para invitar tras un «¡Casi casi!» o un duelo ganado y la racha en pareja quedan para más adelante.
- **Fecha:** 2026-11-12
- **Propuesta por:** Luis, con Claude Code

## Qué

Un programa de referidos en el que **quien invita y quien es invitado ganan los dos**, siempre con lo que ya tiene valor en el juego (cofres, faradios y piezas exclusivas del avatar), nunca con dinero. Lo llamamos **Circuito**, por el tema eléctrico: cada amigo que se engancha es una conexión más de tu circuito.

Hay cuatro piezas, de más a menos importante:

1. **Cada vez que compartes, invitas.** Tu código va dentro de todos los enlaces que ya compartimos: la tarjeta para stories, el resultado del día, los duelos y las ligas. No hace falta un botón nuevo para que funcione.
2. **El reto como anzuelo.** Quien abre tu enlace ve «Luis ha jugado el reto de hoy. ¿Te acercas más que él?». Tu resultado se le enseña **después** de que juegue, para no destriparle las cifras.
3. **Premio doble, por escalones y con tope**, que se cobra cuando el invitado ha jugado de verdad, no cuando solo hace clic.
4. **Corriente compartida.** Durante 30 días, los días que jugáis los dos os carga a ambos un poco más la batería. Así el premio depende de que el amigo se quede, no de que entre.

## Por qué

Ahora mismo el juego tiene buenos motivos para volver (reto diario, racha, misiones, cofres, ligas), pero ninguno para traer a nadie, salvo las ligas y los duelos con código. Esas dos funciones ya demuestran que la gente comparte enlaces. Falta premiarlo y hacer que cada enlace compartido cuente.

## Qué hacen otras aplicaciones

### Análisis con REA (12 de noviembre de 2026)

Se analizó con REA el JavaScript y el HTML que sirven públicamente Duolingo, GeoGuessr y Chess.com, **sin iniciar sesión, sin crear cuentas y sin llamar a sus API**. Como en el análisis de la [decisión 0024](../decisiones/0024-avatar-faradios-y-misiones.md), las reglas se ven en el código, pero muchas cifras llegan de sus servidores y no se conocen.

**Duolingo** (bundle `app-*.js` y tabla de textos)

- El enlace de invitación es `/referred?user_invite=…&inviter_id=…`. Si el visitante no tiene cuenta, el código se guarda en el navegador y se envía al crear la cuenta (`inviteCode`, `referralSource`). Si ya tiene cuenta, se le lleva al perfil de quien invita.
- **El invitado** recibe un «Super Pass». El valor de prueba que aparece en el código es `reward_type:"super_14d"`, es decir, 14 días de la suscripción. Solo vale para cuentas nuevas y se canjea una vez («This Super pass is for new users only», «…has been claimed!»).
- Para quien invita hay textos de recompensa en semanas, meses o años de Super. Lo que gana de verdad y el tope vienen del servidor (`referralInfo`).
- La oferta aparece en la barra lateral (`showReferralOffer`) y en el perfil.
- Lo social pesa tanto como el premio:
  - **Friend Streak**, una racha compartida con plazas limitadas («You've filled all your Friend Streaks!»).
  - **Friends Quests**, misiones semanales en pareja.
  - El plan familiar para 6 personas.

**GeoGuessr** (página `/referral-program`; es el caso más claro)

- **Escalones:**
  - con **1 amigo**, mejora de suscripción para ti y tus amigos;
  - con **5 amigos**, **un año gratis**.
- **Tope de 5** (`maxUsesCount ?? 5`), con una barra de progreso de 5 casillas que se van llenando con **la foto y el apodo de cada amigo** que entra, y un aviso al llegar al máximo.
- Se explica en tres pasos: copia el enlace → hasta cinco amigos se suscriben con él → los dos pagáis menos.
- Es un referido **de pago**. El invitado tiene que suscribirse y quien invita debe tener una suscripción activa. Las reglas de quién puede invitar están en el código (`IneligibleTrialSubscription`, etc.).

**Chess.com**

- Sin sesión no hay ningún programa de referidos de jugadores; solo una cookie de afiliados.
- Lo que sí hay son invitaciones a clubes y un plan «Friends & Family» para hasta 3 personas.
- Conclusión: hay apps grandes que crecen por lo social (clubes, partidas con amigos) más que con premios por invitar.

### Fuentes públicas

Casi todo lo publicado viene de blogs de herramientas de referidos, así que sus cifras son orientativas. El caso más citado es Dropbox: espacio extra para los dos y crecimiento enorme del boca a boca. En lo que sí coinciden:

- Funciona mejor **premiar a los dos**, y con algo del propio producto, no con dinero.
- El premio debe llegar **enseguida**: si tarda semanas, la gente olvida que invitó.
- Hay que pedir al invitado **una acción real** (abrir y jugar, no solo instalar) para evitar invitaciones falsas.
- Los **escalones con barra de progreso** hacen que no se pare en la primera invitación.
- Hay que medir si los invitados **se quedan** comparados con los que llegan solos.

Enlaces: [GrowSurf, ejemplos de apps móviles](https://growsurf.com/examples/mobile-app-referral-programs/), [Game Developer, crecer con referidos](https://www.gamedeveloper.com/business/how-to-grow-your-game-with-referrals), [Megacool, recompensas en juegos móviles](https://megacool.medal.tv/blog/rewards-and-incentives-for-referral-programs-in-mobile-games/amp/), [Duolingo, Friends Quests](https://blog.duolingo.com/friends-quests/), [Duolingo, Friend Streak](https://blog.duolingo.com/friend-streak/).

## Propuesta en detalle

### 1. Código y enlace

- Cada jugador tiene un código corto y permanente, de 6 caracteres como los de las ligas. El servidor lo guarda junto al hash del jugador, nunca junto a su identificador.
- Todos los enlaces que ya compartimos añaden `&de=CÓDIGO` (o `?de=CÓDIGO`): la tarjeta y el resultado del reto, `?duelo=`, `?liga=` y el nuevo enlace del perfil.
- Al abrir un enlace con `de=`, el navegador guarda el código. El servidor apunta el vínculo **solo si ese jugador es nuevo**, es decir, si no tiene ninguna respuesta guardada. Nadie puede invitarse a sí mismo y cada jugador tiene un único padrino.

### 2. Cuándo cuenta un amigo

Un invitado pasa a ser **conexión** cuando juega el reto del día en **3 días distintos dentro de sus primeros 14 días**. Lo comprueba el servidor con `daily_results`, que ya se rellena al completar el reto. El navegador no puede inventárselo.

Mientras tanto, quien invita lo ve como «pendiente: 1 de 3 días», con el avatar del amigo en gris.

### 3. Premios

**Para el invitado**

- Al terminar su primer reto, un **cofre Rayo de bienvenida**, que es más que el Chispa de estreno que reciben todos.
- La pieza exclusiva **«Enchufe»**, que no se compra ni sale en cofres. Sirve para que se note que llegó por un amigo.
- Al hacerse conexión (3 días), **150 ≈**.

**Para quien invita**, por cada conexión: **un cofre Rayo** y, además, los escalones del Circuito:

| Conexiones | Premio del escalón |
|---|---|
| 1 | Pieza exclusiva **«Cable pelado»** (común, solo por invitar) |
| 3 | **Cofre Tormenta** |
| 5 | Pieza épica exclusiva **«Bobina de Tesla»** (aura con chispas en el avatar 3D) |
| 10 | Pieza legendaria exclusiva **«Jaula de Faraday»** y título «Electricista» |

- **Tope:** los cofres Rayo por conexión se dan hasta **10 conexiones**. A partir de la 11, cada conexión da 50 ≈, como mucho 20 al mes. Así un buen embajador sigue ganando algo, pero no compensa fabricar cuentas.
- Por comparar: el cofre Rayo vale de media unos 680 ≈ ([decisión 0027](../decisiones/0027-cofres.md)), así que cada amigo vale más o menos lo mismo que las tres misiones de una semana. Es mucho para que apetezca, pero no rompe la tienda.

**La pantalla del Circuito**, en el perfil y como pestaña junto a Cofres:

- Una barra con 10 enchufes que se llenan con el **avatar 3D de cada amigo**, como hace GeoGuessr con las fotos.
- Los escalones marcados en la barra.
- El botón «Invitar» y el texto «Los dos ganáis un cofre».

### 4. Corriente compartida (lo que hace que se queden)

- Durante los **30 días** siguientes a la invitación, cada día que **juegan los dos** el reto, a ambos se les carga la batería **+15** además de lo normal.
- En el resultado del reto aparece «⚡ Corriente con Marta: +15». Es un recordatorio diario y amable de que el otro existe.
- Opcional en una segunda fase: una **«racha en pareja»** como la Friend Streak de Duolingo, con plazas limitadas, por ejemplo 3.

### 5. Cuándo pedir que inviten

Siempre en momentos buenos y nunca encima de una partida:

- después de un **«¡Casi casi!»**;
- al **ganar un duelo**;
- al **abrir un cofre** con buena pieza («Enséñaselo a alguien: si se une, los dos ganáis un Rayo»);
- en el **resumen del lunes** de las ligas («Tu liga tiene 4. Invita a 2 más»);
- en la **tarjeta para stories**, que ya lleva el enlace.

Como mucho, una sugerencia al día y fácil de cerrar.

## Lo que no hacemos

Va en la línea de la [decisión 0024](../decisiones/0024-avatar-faradios-y-misiones.md):

- sin dinero real ni descuentos;
- sin cuentas atrás ni campañas de «solo esta semana»;
- sin pedir acceso a la agenda de contactos;
- sin premiar el clic o la instalación;
- sin castigar a quien no invita.

## Cómo se haría (resumen técnico)

- **Base de datos:** una migración con la tabla `referrals`, con estas columnas:
  - `code`, `inviter_hash` e `invitee_hash` (único);
  - `created_at` y `connected_at`;
  - qué premios se han reclamado.

  Se aplica **solo con confirmación de Luis** y se documenta en `docs/base-de-datos.md`.
- **API:** `POST /api/referido`, con las acciones `codigo`, `abrir`, `estado` y `reclamar`, en un `lib/referidos.mjs` como `lib/ligas.mjs`. En local se guarda en `runtime/referidos.json`.
- **Navegador:** `dist/circuito.js` añade el `de=` a los enlaces y pinta la pantalla del Circuito. `progress.js` entrega los premios cuando el servidor dice que hay algo por reclamar, y el servidor lo marca para que no se cobre dos veces.
- **Trampas:** los faradios siguen en el navegador, así que quien edite su `localStorage` puede ponerse lo que quiera, como ya pasa hoy. Lo que sí protege el servidor es el **vínculo y la validación**. Para fabricar una conexión falsa hay que jugar 3 días con otro navegador, y el tope de 10 hace que no merezca la pena. Cuando haya dinero de por medio, conviene exigir sesión iniciada al invitado.

## Cómo sabremos si funciona

- Qué parte de los jugadores comparte algún enlace a la semana.
- Clics por enlace compartido, y de esos clics, cuántos juegan el primer reto y cuántos llegan a conexión.
- **Retención a 7 y 30 días** de los invitados frente a los que llegan solos.
- **Factor K**: conexiones nuevas por jugador activo y mes. Por encima de 0,2 ya se nota en el crecimiento.

## Dudas y riesgos

- **Cifras:** ¿3 días en 14 es demasiado exigente? Se puede empezar con 2 días y medir.
- **Valor de los premios:** si el Rayo por amigo infla la economía, se puede pasar a Chispa + 100 ≈. Encaja con lo pendiente en [ajustes-economia-faradios.md](ajustes-economia-faradios.md).
- **Privacidad:** el invitado verá el apodo y el avatar de quien invita, y quien invita verá los de sus conexiones. Nunca sus resultados sin jugar, ni sus identificadores.
- **Orden de trabajo sugerido:**
  1. Enlaces con `de=` y reto como anzuelo, que no necesitan premios.
  2. Validación y premios.
  3. Corriente compartida y racha en pareja.
