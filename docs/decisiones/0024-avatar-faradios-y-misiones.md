# 0024. Avatar personalizable, faradios y misiones

- **Estado:** propuesta (código en la rama `feat/avatar-tienda-misiones`, que parte de `feat/duelos-1vs1`)
- **Fecha:** 2026-11-11
- **Quién:** Luis, con Claude Code

> **Nota:** el avatar por capas en SVG, sus piezas, los fondos y la lista de piezas por nivel de esta decisión quedan sustituidos por la [0025](0025-avatar-3d.md) (avatar en 3D). Los faradios, las misiones, los niveles y la racha siguen como aquí se describen.
>
> **Nota (2026-11-12):** la [0027](0027-cofres.md) cambia el punto de «no hacemos cajas de premios al azar» (ahora hay cofres) y las cifras del cofre diario, del premio por nivel y de la racha.

## Contexto

Luis quiere un avatar con personalidad (tomó como referencia el muñeco de GeoGuessr), con ropa y cosméticos que se compren con puntos ganados al jugar, subir de nivel y completar misiones diarias y semanales. El objetivo es que apetezca volver cada día, que a la larga pueda dar ingresos y que aporte algo al jugador.

Limitaciones: no hay cuentas ([0009](0009-jugador-sin-registro-con-cookie.md)), no hay pagos, no hay dependencias de npm y la web es HTML, CSS y JavaScript sin empaquetador.

Luis pidió analizar aplicaciones parecidas con REA (`morluto/rea`, una herramienta de ingeniería inversa que se instala como servidor MCP del agente). El primer diseño se hizo sin ella, apoyado en mecánicas públicas y conocidas de juegos diarios y de duelos. Después Luis la instaló y se usó para contrastar el diseño: ver «Análisis con REA» más abajo.

## Decisión

- **Avatar propio por capas, en SVG** (`dist/avatar.js`). Un muñeco cabezón de trazo grueso, del estilo de las ilustraciones del juego, no una copia del de GeoGuessr. Nueve huecos: piel, peinado, color de pelo, ropa, pantalón, gorro, gafas y más, objeto en la mano y fondo. Unas 75 piezas. Sin librerías ni imágenes: cada pieza son unas líneas de SVG y añadir una nueva es añadir una entrada al catálogo.
- **Faradios (≈), la moneda del juego** (`dist/progress.js`). Solo se ganan jugando y solo compran piezas de aspecto. No dan ventaja en las preguntas ni en los duelos.
- **De dónde salen:**

  | Acción | Faradios | Experiencia |
  | --- | --- | --- |
  | Bienvenida (una vez) | 100 | — |
  | Cada respuesta del reto diario o del archivo | — | 5 |
  | Completar el reto de hoy | 20, + hasta 15 por precisión, + 2 por día de racha (máx. 14) | 30 |
  | Completar un reto del archivo (una vez por reto) | 5 | 10 |
  | Duelo ganado / empatado / perdido | 15 / 8 / 5 | como en la [0023](0023-duelos-1vs1.md) |
  | Duelo a partir del cuarto del día | el 25 % | el 25 % |
  | Duelo contra Faraday-bot | solo el primero del día | la mitad |
  | Subir de nivel | 40 + 10 × nivel | — |
  | Misión diaria (3 al día) | 15 a 25 | 10 |
  | Cofre diario (las tres misiones del día) | 20 | — |
  | Misión semanal (3 a la semana) | 60 u 80 | 10 |

- **Precios:** piezas sencillas 40–80, especiales 100–300, raras 400–600 y las mejores 900–1200. Un jugador diario gana unos 100–150 faradios: una pieza sencilla cada día, una rara en una semana. Varias piezas no se compran: se desbloquean gratis al llegar a un nivel (bata en el 3, birrete en el 5, trofeo en el 8, aureola en el 10 y corona en el 15).
- **Misiones:** las mismas para todo el mundo, elegidas a partir de la fecha. Las diarias cambian a medianoche de Madrid e incluyen siempre «Completa el reto de hoy»; las semanales cambian el lunes. Mezclan el reto diario, el archivo y los duelos para que cada modo lleve a los otros. La recompensa se recoge a mano en el perfil, que avisa con un punto en la portada.
- **Racha diaria:** días seguidos completando el reto de hoy. Da un pequeño extra de faradios; perderla no quita nada.
- **Se prueba antes de comprar:** al tocar una pieza que no se tiene, el avatar se la pone y aparece el botón de compra con el precio o lo que falta.
- **Todo en el navegador** (`localStorage`, clave `casi-casi:progreso`). En los duelos, el servidor solo recibe los identificadores de las piezas, los limpia y se los pasa al rival; no comprueba que se hayan comprado.

## Análisis con REA

El 11 de noviembre de 2026 se analizó con REA el JavaScript que sirven públicamente GeoGuessr, Duolingo y Habitica, sin iniciar sesión, sin crear cuentas y sin llamar a sus API. Las reglas se ven en el código; casi todas las cifras (precios, monedas por misión, curvas de nivel de GeoGuessr y Duolingo) llegan de sus servidores y siguen sin conocerse.

- **GeoGuessr:** recompensa de monedas y piezas por nivel que se reclama a mano, 42 títulos de nivel, cinco rarezas de pieza, monedas diarias gratis, topes de reclamación diarios y semanales y de monedero, extra por primera victoria del día, un protector de racha gratis a los 3 días, tres misiones de bienvenida de 100 monedas y un pase de 40 escalones con la mitad reservada a suscriptores.
- **Duolingo:** tres misiones diarias en huecos de dificultad creciente sorteadas sin repetir familia, reto mensual con umbral de 30 misiones, hitos de racha (7, 14, 30, 50, 75, 100… 365), máximo de 2 protectores de racha y meta diaria de 10, 20, 30 o 50 XP a elegir.
- **Habitica:** experiencia por nivel `25 × nivel` hasta el 4 y después una cuadrática suave, nivel máximo 100, calendario de recompensas por días de acceso acumulados (no seguidos), cosméticos a 2 gemas la pieza y 5 el conjunto, y un «armario» de premio al azar (60 % equipo, 20 % comida, 20 % experiencia).

Al contrastarlo con nuestro código salieron dos fallos que se corrigen en esta misma rama (`dist/duel.js`):

- **Tope diario de duelos.** Una victoria daba 180–300 XP frente a los 45 del reto del día, sin límite. Ahora los tres primeros duelos del día premian entero y los siguientes al 25 % (experiencia y faradios).
- **Faraday-bot.** Premiaba igual que una persona y se podía repetir sin fin. Ahora da la mitad de experiencia y faradios solo en el primer duelo contra él de cada día.

La pantalla final del duelo lo avisa («Tope diario: premio al 25 %», «Práctica con el bot: mitad de XP»). El resto de ajustes que sugiere el análisis está sin decidir en la idea [ajustes-economia-faradios.md](../ideas/ajustes-economia-faradios.md).

## Qué buscamos y qué evitamos

Lo que engancha de forma sana: una razón corta para volver cada día (el reto y tres misiones), progreso visible (nivel, racha, armario) y algo propio que enseñar a los demás (el avatar en los duelos).

Lo que no hacemos: cajas de premios al azar (cambiado por la [0027](0027-cofres.md)), ofertas con cuenta atrás, avisos que castiguen por no entrar, ventajas de pago en el juego ni monedas que caduquen.

## Alternativas descartadas

- **Usar una librería de avatares de GitHub** (DiceBear, Avataaars y similares). Traen estilos ajenos al del juego, licencias distintas por estilo y una dependencia que el proyecto no tiene. Dibujarlo aquí cuesta poco y deja el catálogo en nuestras manos.
- **Avatar en 3D** como el de la referencia. Pide un motor, modelos y mucho más peso para un juego que es una página ligera.
- **Guardar faradios y compras en el servidor.** Sin cuentas no hay a quién asociarlos. Queda para cuando haya inicio de sesión ([idea](../ideas/login-con-supabase.md)).

## Consecuencias

- **Se puede hacer trampa**: quien edite su `localStorage` se pone los faradios o las piezas que quiera. Mientras no haya dinero de por medio no importa; antes de vender nada hay que pasar el progreso al servidor con cuentas.
- El progreso no viaja entre dispositivos y se pierde si se borran los datos del navegador.
- El nivel y la experiencia de los duelos pasan a `progress.js`; quien ya tenía experiencia de duelos la conserva.
- Cómo podría dar ingresos sin romper lo anterior está en la idea [monetizacion-cosmeticos.md](../ideas/monetizacion-cosmeticos.md). No hay nada de pago implementado.
