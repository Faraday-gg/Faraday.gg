# 0035. Seis cofres, cada uno con su cualidad y su precio

- **Estado:** propuesta (código en la rama `feat/seis-cofres`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0027](0027-cofres.md). Sustituye su apartado «Tres cofres» y sus reglas de qué cofre dan los niveles y las rachas. Todo lo demás de la 0027 (protecciones, batería, apertura, sin dinero real) sigue igual.

## Contexto

Había tres cofres (Chispa, Rayo y Tormenta) que solo se diferenciaban en ser cada uno mejor y más caro que el anterior. Luis pidió seis en total, con cualidades y precios distintos acordes a las piezas y rarezas que existen, y dejó abierta la posibilidad de crear otra rareza.

El catálogo que puede salir en cofres (piezas de pago, sin las de nivel ni la de «Casi casi») tiene hoy 329 piezas que suman 129.160 ≈. Cada cuerpo ve unas 168. Por rareza (`Avatar.rarity`, según el precio):

| Rareza | Precio | Piezas | Por cuerpo | Precio medio |
|---|---|---|---|---|
| Común | menos de 100 ≈ | 25 | 16 | 69 ≈ |
| Especial | 100–249 ≈ | 116 | 58 | 170 ≈ |
| Rara | 250–599 ≈ | 120 | 60 | 361 ≈ |
| Épica | 600–1.399 ≈ | 52 | 26 | 735 ≈ |
| Legendaria | 1.400 ≈ o más | 16 | 8 | 1.638 ≈ |

## Decisión

### Los seis cofres

De más barato a más caro. Los tres nuevos son Imán, Dinamo y Faraday; Chispa, Rayo y Tormenta no cambian.

| Cofre | Precio | Premios | Cualidad | Valor medio | Cómo se gana jugando |
|---|---|---|---|---|---|
| Chispa | 120 ≈ | 2 | El de cada día: barato y sin garantía | 174 ≈ | Las 3 misiones del día, llenar la batería y subir de nivel |
| **Imán** | 320 ≈ | 3 | **Solo piezas:** nunca trae lotes de faradios. Sobre todo comunes y especiales | 502 ≈ | A los 3 días de racha |
| Rayo | 450 ≈ | 3 | 1 pieza rara o mejor garantizada | 682 ≈ | Las 3 misiones de la semana y los niveles múltiplos de 5 |
| **Dinamo** | 750 ≈ | 6 | **El que más premios trae**, sin garantía | 965 ≈ | Los niveles múltiplos de 10 (en vez del Rayo) |
| Tormenta | 1.100 ≈ | 4 | 1 pieza épica o mejor garantizada | 1.611 ≈ | Rachas de 7, 14, 30 y 50 días, y de 150, 250, 350… |
| **Faraday** | 2.500 ≈ | 5 | **1 legendaria segura** y ningún premio común | 3.121 ≈ | Rachas de 100 días y cada 100 después (en vez de la Tormenta) |

Probabilidad de cada premio normal (el garantizado va aparte):

| | Chispa | Imán | Rayo | Dinamo | Tormenta | Faraday |
|---|---|---|---|---|---|---|
| Faradios | 55 % (20–50) | 0 % | 50 % (30–70) | 45 % (40–90) | 40 % (60–120) | 30 % (100–200) |
| Común | 22 % | 40 % | 15 % | 10 % | 0 % | 0 % |
| Especial | 17 % | 45 % | 25 % | 27 % | 25 % | 15 % |
| Rara | 5,5 % | 13 % | 8 % | 15 % | 25 % | 35 % |
| Épica | 0,5 % | 1,8 % | 1,8 % | 2,7 % | 8,5 % | 17 % |
| Legendaria | 0 % | 0,2 % | 0,2 % | 0,3 % | 1,5 % | 3 % |

Premio garantizado: Rayo, rara 85 %, épica 13 % o legendaria 2 %; Tormenta, épica 88 % o legendaria 12 %; Faraday, legendaria 100 %.

### Cómo se han puesto los precios

El valor medio de un cofre es la suma de sus premios, contando cada pieza por el precio medio de su rareza en la tienda. Todos los cofres rinden entre 1,25 y 1,57 veces su precio: comprar un cofre sale mejor de media que comprar en la tienda, a cambio de no elegir, pero nunca llega al doble. `tests/cofres.test.mjs` exige que cada cofre quede entre 1,15 y 2 con el catálogo real, así que si cambian los precios de las piezas la prueba avisa.

Los cofres caros rinden algo menos (Faraday 1,25; Dinamo 1,29) que los baratos (Imán 1,57; Chispa 1,45): lo que se paga en ellos es la garantía o la cantidad, no un descuento mayor.

### Cambios en lo que se gana jugando

Solo hay mejoras; ningún premio anterior empeora:

- **Racha de 3 días:** hito nuevo, da un cofre Imán. Es el primer premio de racha, pensado para quien empieza.
- **Niveles múltiplos de 10:** dan Dinamo en vez de Rayo.
- **Racha de 100 días y cada 100 después:** dan Faraday en vez de Tormenta.

### Protección añadida

Un cofre con premio garantizado **no se puede comprar si ya se tienen todas las piezas de las rarezas que garantiza** (para el cuerpo que se lleva puesto): el premio seguro sería un lote de faradios que vale menos que el cofre. El botón de compra pasa a decir «Ya lo tienes todo». Afecta sobre todo a Faraday: solo hay 8 legendarias por cuerpo. Los cofres ya ganados se pueden abrir igual.

### Sin rareza nueva

Se valoró una sexta rareza («mítica») por encima de la legendaria y se descartó:

- Las rarezas salen del precio de la pieza. Partir la legendaria (1.400–2.000 ≈) dejaría 2 piezas míticas por cuerpo: un cofre que las garantizara se agotaría en dos aperturas y el resto de las veces daría faradios.
- Las cinco rarezas ya separan bien los seis cofres: cada garantía (rara, épica, legendaria) tiene su cofre, y los otros tres se distinguen por otra cosa (precio, solo piezas, cantidad).
- Cuando haya más piezas de 1.800 ≈ o más, se puede añadir sin tocar los cofres: basta un tramo más en `Avatar.rarity` y una columna en las tablas.

### Código

- `dist/chests.js`: los seis cofres, `streakChest(días)` (sustituye a `streakMilestone`) y `levelChest(nivel)`.
- `dist/progress.js`: los hitos de racha y de nivel usan esas dos funciones; la pestaña Cofres enseña la cualidad de cada cofre, bloquea la compra del que ya no puede dar su premio seguro y parte las probabilidades en dos tablas de tres cofres para que quepan en el móvil.
- `dist/chest.css`: colores de los tres cofres nuevos y la disposición de cinco y seis cartas (y premios en el resumen), tres por fila.
- `tests/cofres.test.mjs`: los seis cofres, sus cualidades, los hitos y el valor frente al precio.

## Alternativas descartadas

- **Seis cofres en escalera** (cada uno mejor y más caro que el anterior): no da motivos para elegir uno u otro, solo para ahorrar. Con cualidades distintas, quien quiere completar el armario elige Imán y quien busca una legendaria, Faraday.
- **Un cofre solo de faradios:** pagar faradios para recibir una cantidad de faradios al azar es una apuesta pura, justo lo que la 0027 intenta limitar.
- **Un cofre por tipo de pieza** (solo zapatillas, solo gorras): con una sola pieza por tipo en algunas rarezas se agotaría enseguida.
- **Rareza «mítica»:** ver arriba.
- **Que los cofres nuevos solo se pudieran comprar:** apoyaría todavía más la mecánica de gastar a cambio de azar. Cada cofre tiene al menos una forma de ganarse jugando.

## Consecuencias

- **Más formas de gastar faradios al azar.** El riesgo con menores de la 0027 sigue y crece: hay más cofres comprables y uno caro (2.500 ≈). El tope de 3 compras al día, las probabilidades a la vista y `BUY_CAP = 0` para desactivar la compra siguen valiendo para los seis.
- **Economía algo más generosa** por el Imán del tercer día y las mejoras de los hitos. Los hitos mejorados son poco frecuentes (cada 10 niveles, cada 100 días).
- **Faraday se agota:** con 8 legendarias por cuerpo, un jugador puede comprarlo como mucho 8 veces por cuerpo (menos si le tocan legendarias en otros cofres). Habrá que añadir legendarias si se quiere que siga teniendo sentido.
- **El dibujo es el mismo cofre en seis colores.** Si se quiere que se distingan más, cada uno puede llevar su propio emblema en `ChestOpen.art`.
- Quien tenga progreso guardado no pierde nada: los cofres nuevos empiezan en cero y los que ya tenía siguen ahí.
