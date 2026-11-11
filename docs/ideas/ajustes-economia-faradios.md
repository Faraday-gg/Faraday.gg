# Ajustes a la economía de faradios, misiones y niveles

- **Estado:** abierta
- **Fecha:** 2026-11-11
- **Propuesta por:** Luis, con Claude Code

## Qué

Ajustes pendientes tras analizar con REA cómo funcionan los niveles, las misiones y la tienda de GeoGuessr, Duolingo y Habitica (ver el apartado «Análisis con REA» de la [decisión 0024](../decisiones/0024-avatar-faradios-y-misiones.md)). El tope diario de los duelos y el premio reducido del bot ya están hechos; lo que sigue está sin decidir.

| Ajuste | Cambio propuesto | En qué se apoya |
| --- | --- | --- |
| Experiencia del duelo | Victoria 60 (hoy 100), primera del día +40 (hoy 50), 5 por ronda (hoy 10) | GeoGuessr mantiene el extra por primera victoria del día |
| Misiones por dificultad | Una fácil fija, una media y una difícil, sin repetir modo de juego; 15 / 20 / 30 faradios | Duolingo: tres huecos (`DAILY`, `CORE`, `HARD`) y sorteo sin repetir familia |
| Objetivo mensual | 30 misiones en el mes dan una pieza exclusiva | Duolingo: cada misión suma a un reto mensual con umbral 30 |
| Días jugados | Piezas en los días 3, 7, 14, 30, 50 y 100 acumulados, no seguidos | Habitica: calendario de accesos (1, 2, 3, 4, 5, 7, 10, 14… 500) que no castiga faltar |
| Protector de racha | Máximo 2; uno gratis al llegar a 3 días, el resto a 150 faradios | Duolingo (tope 2) y GeoGuessr (uno gratis a los 3 días de racha) |
| Bienvenida | Tres misiones iniciales de 40 faradios en vez de 100 de golpe | GeoGuessr: tres misiones de 48 horas con 100 monedas cada una y cofre final |
| Más en qué gastar | Conjuntos con descuento, recolores baratos y un título por nivel | Habitica (pieza 2 gemas, conjunto 5) y GeoGuessr (42 títulos de nivel) |

## Por qué

- **La experiencia de los duelos sigue descompensada.** Aun con el tope, tres victorias al día dan entre 540 y 900 XP; el reto del día con sus misiones, unos 80.
- **Las misiones diarias pueden obligar a jugar duelos.** El sorteo puede sacar «Juega un duelo» y «Gana un duelo» el mismo día, y sin ellas no hay cofre.
- **El catálogo se agota en unos dos meses.** Las 43 piezas de pago suman 8.520 faradios y un jugador diario gana 100–150 al día. Después los faradios no sirven para nada.
- **La racha deja de premiar en el día 7** y no hay ningún objetivo de más de una semana.

## Lo que no copiaríamos

- Cajas al azar (el armario encantado de Habitica, la caja misteriosa de GeoGuessr): la 0024 las descarta.
- La tienda diaria rotatoria de GeoGuessr: daría en qué gastar, pero roza las ofertas con cuenta atrás que también descartamos.
- Un pase de temporada con escalones reservados a quien paga.

## Dudas y riesgos

- El análisis fue solo del JavaScript público, sin iniciar sesión. Las reglas se ven en el código; casi todas las cifras (precios, monedas por misión, curva de nivel de GeoGuessr y Duolingo) llegan de sus servidores y no las conocemos. Los números de la tabla son nuestros, no copiados.
- Cambiar la experiencia del duelo no afecta a quien ya la tiene acumulada, pero sí al ritmo de quien juega sobre todo duelos.
- El protector de racha y los días jugados necesitan guardar más estado en `localStorage`, que sigue pudiéndose falsear.
