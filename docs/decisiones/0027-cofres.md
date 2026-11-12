# 0027. Cofres con premio al azar, ganados jugando o comprados con faradios

- **Estado:** propuesta (código en la rama `feat/cofres`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Cambia a:** el punto de la [0024](0024-avatar-faradios-y-misiones.md) que decía «no hacemos cajas de premios al azar», y sus cifras de premio por nivel, cofre diario y racha. El resto de la 0024 sigue igual: no hay ofertas con cuenta atrás, avisos que castiguen por no entrar, ventajas de pago ni monedas que caduquen.

- **Ampliada por:** la [0035](0035-seis-cofres.md), que deja seis cofres (añade Imán, Dinamo y Faraday) y cambia qué cofre dan algunos niveles y rachas. El apartado «Tres cofres» de abajo se conserva como estaba al decidirse.

## Contexto

Luis pidió un sistema de cofres como el de Clash Royale, EA FC o Rocket League, con una apertura muy cuidada (animación, luz y sonido), y permiso para reordenar la economía de faradios para que encaje.

Lo que había:

- Los faradios solo se gastaban en la tienda. El «cofre diario» era un texto con +20 faradios fijos.
- El premio por subir de nivel (`40 + 10 × nivel`) crecía sin techo y la racha dejaba de premiar en el día 7.
- La 0024 descartaba las cajas al azar. Luis decidió cambiarlo en esta sesión, sabiendo que juegan menores, con dos condiciones: **los faradios y los cofres no se compran nunca con dinero real** y el sistema lleva protecciones (abajo).

### Análisis con REA

El único juego de los pedidos instalado en el equipo era Rocket League (`C:\Program Files\Epic Games\rocketleague`). REA solo pudo leer nombres de archivo: existen un menú de contenedores (`GFX_PremiumContainerMenu_SF.upk`), un banco de sonidos de desbloqueo (`SFX_UI_Unlocks.bnk`) y paquetes `crateunlocked_*`. Su contenido tiene una entropía de 7,97–7,99 bits por byte (cifrado o comprimido) y no contiene nombres legibles. No se instrumentó el juego en marcha porque lleva antitrampas. Clash Royale y EA FC no estaban disponibles y no se descargaron de webs de terceros. **El diseño no sale de REA, sino de literatura y análisis públicos.**

### Qué dice la investigación

Lo que da emoción a una apertura (Kotaku sobre Overwatch y Hearthstone; *Juice it or lose it*, GDC Europe 2012; wiki de Hearthstone; guías del *walkout* de EA FC):

- Un objeto cerrado que «respira», tensión con un tono que sube, una pista de color de la rareza justo antes de revelar (Blizzard quitó de Overwatch unas luces que la daban demasiado pronto), un instante de silencio, un golpe de impacto y un resumen final.
- Revelar por pasos lo mejor: el *walkout* de EA FC enseña primero atributos sueltos y al final el jugador.
- El sonido crece con el premio: más notas y más capas cuanto mayor es.

Lo que hace daño, sobre todo a menores (Zendle y Cairns 2018 y 2019; Drummond y Sauer 2018; King y Delfabbro 2018; Clark 2009; Dixon y Harrigan 2010):

- El gasto en cajas botín se asocia a juego problemático, con más fuerza en adolescentes. Son estudios correlacionales.
- Casi-aciertos falsos, celebrar un premio peor que lo gastado, presión temporal, hacer creer que el jugador controla el resultado y ocultar las probabilidades.
- Gastar moneda a cambio de un resultado al azar. **Esto sí lo hacemos**, por decisión de Luis: es el riesgo que queda.

Regulación (no es asesoramiento legal): el proyecto de ley española de protección de menores en entornos digitales y el borrador de la *Digital Fairness Act* europea apuntan a las cajas botín de pago. Aquí los faradios no se compran con dinero, pero si algún día se venden hay que revisar o retirar los cofres comprables antes.

## Decisión

### Tres cofres

| Cofre | Premios | Garantía | Precio | Valor medio | Cómo se gana jugando |
|---|---|---|---|---|---|
| Chispa | 2 | — | 120 ≈ | 174 ≈ | Las 3 misiones del día, llenar la batería y subir de nivel |
| Rayo | 3 | 1 pieza rara o mejor | 450 ≈ | 682 ≈ | Las 3 misiones de la semana y los niveles múltiplos de 5 |
| Tormenta | 4 | 1 pieza épica o mejor | 1.100 ≈ | 1.611 ≈ | Rachas de 7, 14, 30, 50 y 100 días, y cada 50 después |

Cada premio es un lote de faradios o una pieza de la tienda que no se tiene. Probabilidad de cada premio normal:

| | Chispa | Rayo | Tormenta |
|---|---|---|---|
| Faradios | 55 % (20–50) | 50 % (30–70) | 40 % (60–120) |
| Común | 22 % | 15 % | 0 % |
| Especial | 17 % | 25 % | 25 % |
| Rara | 5,5 % | 8 % | 25 % |
| Épica | 0,5 % | 1,8 % | 8,5 % |
| Legendaria | 0 % | 0,2 % | 1,5 % |

El premio garantizado de Rayo es rara 85 %, épica 13 % o legendaria 2 %; el de Tormenta, épica 88 % o legendaria 12 %. Las rarezas son las de la tienda (`Avatar.rarity`, según el precio). Las piezas que se desbloquean por nivel no salen en cofres.

### Protecciones

- **Probabilidades a la vista**, en la pestaña Cofres, generadas de la misma tabla que usa el sorteo.
- **Sin duplicados:** solo se sortean piezas que faltan. Si no quedan de esa rareza, el premio es un lote de faradios (40, 90, 180, 380 u 800 según la rareza).
- **Garantía por mala suerte:** tras 10 cofres seguidos sin épica ni legendaria, el siguiente la trae.
- **Tope de compra:** 3 cofres comprados al día. Los ganados jugando no cuentan.
- **Nada de dinero real**, cuentas atrás, caducidad ni ofertas temporales.
- **Sin trucos en la animación:** el sorteo se hace y se guarda antes de animar; lo que se ve es lo que ha tocado. No hay cartas «casi premiadas» y los toques solo abren el cofre, no cambian el premio.
- **Celebración proporcional:** la fanfarria tiene una nota más por nivel de rareza; un lote de faradios no suena a premio gordo.

### Economía

- **Batería:** se carga jugando (reto de hoy +40, reto del archivo +10, duelo +20, o +5 pasado el tope diario de duelos y 0 en las prácticas repetidas con el bot). Al llegar a 100 da un cofre Chispa.
- **Nivel:** cada subida da 30 ≈ fijos y un cofre (antes `40 + 10 × nivel` faradios).
- **Misiones:** el cofre diario de +20 ≈ pasa a ser un cofre Chispa, y las tres semanales dan un cofre Rayo.
- **Racha:** siguen los 2 ≈ por día hasta 7, y además los hitos dan un cofre Tormenta.
- **Estreno:** todo jugador recibe un cofre Chispa la primera vez, también quien ya jugaba.
- La compra directa en la tienda sigue igual, para quien quiere elegir.

### La apertura

Cae el cofre → tres toques lo cargan (cada uno suena más agudo) → tensión de 1,1 s → la luz toma el color de la mejor rareza (0,4 s) → silencio (0,23 s) → estallido con destello, sacudida y partículas → cartas boca abajo con el brillo de su rareza → se giran de una en una → resumen con «Ponérmelo» y «Abrir otro». Las piezas épicas y legendarias se presentan por pasos: tipo de pieza → rareza → el avatar con la pieza puesta. Hay botón «Saltar», Escape cierra, la rareza se anuncia también en texto y con «reducir movimiento» se va directamente al resumen.

### Código

- `dist/chests.js`: reglas y sorteo, sin pantalla. `tests/cofres.test.mjs` las prueba con el catálogo real.
- `dist/chest-open.js` y `dist/chest.css`: la apertura y la pestaña.
- `dist/sound.js`: el sonido que antes vivía en `dist/duel.js`, ahora compartido, con ruido filtrado además de tonos.
- `dist/progress.js`: guarda los cofres, los concede y reparte los premios. Todo sigue en `localStorage`.

## Alternativas descartadas

- **Cofres con azar que solo se ganan jugando, sin compra.** Era la recomendación: quita el gasto a cambio de azar, que es lo que la investigación relaciona con el daño. Luis prefirió que se puedan comprar para dar a los faradios un sitio repetible donde gastarse.
- **Ceremonia sin azar** (elegir 1 de 3 piezas o contenido conocido). Respetaba la 0024, pero Luis quería la sorpresa.
- **Temporizadores de apertura y ciclo de cofres como Clash Royale.** Son presión temporal, que la 0024 sigue descartando.
- **«Mejorar» la rareza a toques** (Lucky Drops de Clash Royale, Starr Drops de Brawl Stars). Hace creer que el jugador controla un resultado ya decidido.
- **Sortear en el servidor.** No hay progreso en el servidor; llegará con las cuentas.

## Consecuencias

- **Riesgo con menores.** Gastar faradios por un resultado al azar es la mecánica que más se parece a una caja botín. Si llegan quejas, o antes de vender faradios, lo primero que hay que quitar es la compra de cofres (`BUY_CAP = 0` en `dist/chests.js` la desactiva).
- **La economía es más generosa.** Un jugador diario recibe al menos un cofre Chispa al día (unos 174 ≈ de valor) donde antes recibía 20 ≈. El catálogo (168 piezas de pago, 64.820 ≈) se completará antes. Conviene mirarlo cuando haya datos.
- **Se puede hacer trampa**, como con el resto del progreso: está en `localStorage`.
- **Los precios** de Rayo y Tormenta (450 y 1.100) son más altos que los del plan inicial (350 y 900) porque la pieza garantizada ya valía más que el cofre.
- Las cifras de la 0024 sobre el cofre diario y el premio por nivel quedan sustituidas por estas.

## Fuentes

- Zendle y Cairns (2018), *Video game loot boxes are linked to problem gambling*: https://eprints.whiterose.ac.uk/139116
- Zendle, Meyer y Over (2019), adolescentes: https://eprints.whiterose.ac.uk/146026
- Drummond y Sauer (2018), *Nature Human Behaviour*: https://www.nature.com/articles/s41562-018-0369-5
- King y Delfabbro (2018), *Predatory monetization schemes in video games*: https://researchnow.flinders.edu.au/en/publications/predatory-monetization-schemes-in-video-games-eg-loot-boxes-and-i/
- Clark y otros (2009), casi-aciertos y control: https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737
- Dixon, Harrigan y otros (2010), pérdidas disfrazadas de victorias: https://uwaterloo.ca/reasoning-decision-making-lab/sites/default/files/uploads/files/DixFugetal_10c.pdf
- Fiorillo, Tobler y Schultz (2003), dopamina e incertidumbre: https://www.pdn.cam.ac.uk/system/files/documents/2003-fiorillo-science.pdf
- Kotaku, *Why opening loot boxes feels like Christmas*: https://kotaku.com/why-opening-loot-boxes-feels-like-christmas-according-1793446800
- Jonasson y Purho, *Juice it or lose it* (GDC Europe 2012): https://gdcvault.com/play/1016789/Juice-It-or-Lose
- Sobres de Hearthstone: https://hearthstone.wiki.gg/wiki/Card_pack
- Lucky Drops de Clash Royale: https://mobilematters.gg/guides/clash-royale/clash-royale-lucky-drops
- Brawl Stars retira las cajas: https://gamedeveloper.com/business/supercell-pulls-loot-boxes-from-brawl-stars-in-favor-of-deterministic-rewards-
- Cajas de Rocket League: https://rocketleague.fandom.com/wiki/Crates
- Proyecto de ley española de protección de menores en entornos digitales: https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF
- Resolución del Parlamento Europeo de 18 de enero de 2023: https://www.cliffordchance.com/insights/resources/blogs/talking-tech/en/articles/2023/02/europe-calls-for-a-better-gaming-industry.html

Las duraciones de la apertura son estimaciones propias: casi ninguna fuente publica tiempos.
