# 0070. El avatar sigue al ratón con la mirada y dice «¡Ay!» si lo tocan

- **Estado:** propuesta (código en la rama `feat/avatar-sigue-raton`)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code

## Contexto

El avatar 3D animado (portada, perfil, reto diario, duelos y cofres) respira, parpadea y hace gestos por su cuenta, pero no reacciona a quien lo mira. Luis pidió que siguiera al ratón con la cabeza y con los ojos, de forma suave, y que al hacer clic encima hiciera un gesto de dolor y dijera «¡Ay!» con una voz muy aguda, de niño pequeño.

## Decisión

- **Mirada (`dist/avatar3d.js`, función `gaze`).** Se guarda la última posición del puntero. Cada avatar proyecta su cara en pantalla en cada fotograma y calcula hacia dónde queda el ratón, como si el espectador estuviera a un palmo de la pantalla; descuenta hacia dónde está girado el cuerpo.
  - La dirección se suaviza despacio y después pasa por los canales normales de la animación: los ojos llegan antes y la cabeza les sigue con calma. La cintura ayuda un poco en los giros grandes.
  - Los ojos se mueven ahora también arriba y abajo (canal nuevo `eyeY`).
  - Si el ratón se queda quieto 4,5 s o sale de la ventana, el avatar vuelve poco a poco a lo suyo. Mientras está atento no hace los gestos de mirar a los lados ni de pensar.
  - Durante los gestos grandes (bailes, celebraciones, el «¡Ay!») la cabeza apenas se desvía; los ojos sí siguen. No mira cuando está desmayado, cuando se le arrastra en el perfil ni cuando está de espaldas.
  - En el móvil no hay ratón: mira hacia donde se toca.
- **Toque (`poke`).** Un clic o un toque sin arrastrar **encima del dibujo** (se comprueba el píxel del lienzo, no el aire de alrededor) lanza uno de dos gestos nuevos: `ay` (respinga con los ojos apretados y se frota la cabeza) o `ay2` (se encoge con las dos manos en la cabeza). Al tocarlo varias veces seguidas no se reinicia antes de 0,35 s.
- **Portada.** El avatar está dentro del botón que abre el armario. El toque sobre el personaje ya no abre el armario: dice «¡Ay!». El resto de la tarjeta (nivel, saldo, «Personalizar →» y el hueco alrededor del personaje) lo abre como antes, y con el teclado el botón funciona igual.
- **Voz (`dist/sound.js`, `Sound.voice` y `Sound.ay`).** Se sintetiza con Web Audio por formantes, sin archivos: una onda de diente de sierra con un tono muy alto (unos 600–780 Hz, que sube y cae como una exclamación, con un temblor ligero) pasa por tres filtros con las resonancias de las vocales de un niño, que se deslizan de una vocal a otra. Hay tres variantes al azar: «¡Ay!», «¡Auu!» y «¡Ay, ay!». Respeta el ajuste de silencio del juego.
- Con «reducir movimiento» no hay mirada ni toque.

## Alternativas descartadas

- **Síntesis de voz del navegador (`speechSynthesis`)** con el tono al máximo: dice la palabra de verdad, pero la voz depende del sistema (en muchos equipos no hay voz en español), suena a adulto acelerado y tarda en arrancar.
- **Un archivo de audio grabado:** más natural, pero añade peso, una grabación y su licencia; el juego genera todos sus sonidos.
- **Seguir al ratón solo con los ojos:** con la cabeza quieta parecía un muñeco; la cabeza que llega con retardo es lo que lo hace suave.

## Consecuencias

- `Sound.voice(vocales, opciones)` sirve para darle más frases cortas al avatar con la misma voz.
- La voz no se ha podido escuchar desde el agente: se comprobó renderizándola sin altavoces (duración, volumen y tono). Puede necesitar ajustes de oído.
