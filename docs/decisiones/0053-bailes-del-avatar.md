# 0053. Siete bailes del avatar, de pasos de baile social y programados desde cero

- **Estado:** propuesta (código en la rama `feat/bailes-avatar`)
- **Fecha:** 2026-11-14
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0028](0028-avatar-de-mujer-y-animaciones.md) (animaciones del avatar). No la sustituye.

## Contexto

Luis pidió estudiar Fortnite para inspirarse en sus bailes sin copyright e incorporarlos al avatar, y estudiar también Roblox para entender por qué la gente juega con un avatar y paga por cosméticos. Lo que se averiguó está en la [idea de bailes como cosméticos](../ideas/bailes-como-cosmeticos.md).

Lo que pesa para esta decisión:

- La Oficina de Copyright de EE. UU. no registra **pasos de baile social ni rutinas sencillas** (rechazó el «Floss» y el «Carlton»), y en 2022 un juez desestimó la demanda de un coreógrafo contra Epic por un emote de Fortnite porque los pasos cortos no se protegen por separado. **Sí** se protege una coreografía más larga y concreta.
- Lo que sí es de Epic son **sus animaciones** (la captura de movimiento, el ritmo exacto, la música y los nombres de los emotes). Por eso no se ha copiado nada del juego.
- No se ha hecho ingeniería inversa de Fortnite ni de Roblox: sus condiciones de uso lo prohíben, llevan antitrampas y, además, el código del juego no dice qué baile es libre.

## Decisión

- En `dist/avatar3d.js` se añaden **7 gestos de baile**, escritos a mano sobre el esqueleto de la 0028, con nombres genéricos en español:
  - **robot:** posturas fijas que cambian a golpes, con los codos en ángulo recto.
  - **aspersor:** una mano en la nuca y el otro brazo estirado, que barre a saltitos.
  - **disco:** el dedo al cielo en diagonal y luego hacia la cadera contraria.
  - **twist:** la cadera gira a un lado y los hombros al otro.
  - **balanceo:** los dos brazos estirados van juntos a un lado y la cadera al otro.
  - **dab:** la cara escondida en el codo y el otro brazo estirado hacia arriba.
  - **correr:** correr en el sitio, con los brazos bombeando.
- Cuándo salen:
  - **Celebrando** (cuando se gana un duelo): los 7 entran en el sorteo de celebraciones, junto al salto, el puño, el giro y el baile de antes.
  - **Tranquilo** (en la portada y el perfil): de vez en cuando hace el robot, el twist o el balanceo.
- `Avatar3D.dances` da la lista y `Avatar3D.play('robot')` lanza uno desde la consola.
- Con «reducir movimiento» activado no se baila, como el resto de los gestos.
- No se añade ninguna pieza a la tienda ni se cambia la economía. Que los bailes se ganen o se compren queda como [idea](../ideas/bailes-como-cosmeticos.md).

## Alternativas descartadas

- **Sacar las animaciones de Fortnite o Roblox** con ingeniería inversa: infringe sus condiciones de uso y sus derechos sobre la animación, aunque el paso de baile sea libre.
- **Reproducir emotes concretos con su nombre** (los de Fortnite): aunque el paso sea libre, el nombre y la versión concreta remiten al juego y a quien lo popularizó. Además, algunos creadores han ido a juicio por ellos.
- **Bailes con música:** la canción tiene sus propios derechos, aparte del paso, y el juego no tiene sonido.
- **Vender los bailes ya:** antes hace falta decidir la tienda de gestos y la economía ([idea](../ideas/bailes-como-cosmeticos.md)).

## Consecuencias

- El avatar celebra con más variedad: los duelos ganados alternan 11 gestos en vez de 4.
- Los brazos son cortos y la cabeza grande, igual que en la 0028. En el dab la cara se esconde detrás del brazo, y en el aspersor la mano de la nuca queda en parte tapada por el pelo.
- Riesgo legal bajo, pero no nulo: no se usan nombres de emotes ni música, y cada baile es un paso suelto, no una coreografía. Si algún día se añade una coreografía larga reconocible de alguien, hay que revisarlo.
- Sin pruebas automáticas del avatar: se ha comprobado a mano en el navegador, fotograma a fotograma.
