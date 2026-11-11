# 0022. Avatar personalizable, faradios y misiones

- **Estado:** propuesta (código en la rama `feat/avatar-tienda-misiones`, que parte de `feat/duelos-1vs1`)
- **Fecha:** 2026-11-11
- **Quién:** Luis, con Claude Code

## Contexto

Luis quiere un avatar con personalidad (tomó como referencia el muñeco de GeoGuessr), con ropa y cosméticos que se compren con puntos ganados al jugar, subir de nivel y completar misiones diarias y semanales. El objetivo es que apetezca volver cada día, que a la larga pueda dar ingresos y que aporte algo al jugador.

Limitaciones: no hay cuentas ([0009](0009-jugador-sin-registro-con-cookie.md)), no hay pagos, no hay dependencias de npm y la web es HTML, CSS y JavaScript sin empaquetador.

Luis pidió analizar aplicaciones parecidas con el repositorio REA (`morluto/rea`, una herramienta de ingeniería inversa que se instala como servidor MCP del agente). **No se ha usado**: instalarla cambia la configuración de Claude Code de Luis y exige reiniciar la sesión, y aplicarla a aplicaciones de terceros puede chocar con sus condiciones de uso. El diseño se apoya en mecánicas públicas y conocidas de juegos diarios y de duelos (rachas, misiones, niveles, cosméticos), sin contrastarlas de nuevo con cada aplicación. Si Luis instala REA, queda como análisis pendiente ([mejoras](../mejoras/README.md)).

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
  | Duelo ganado / empatado / perdido | 15 / 8 / 5 | como en la [0021](0021-duelos-1vs1.md) |
  | Subir de nivel | 40 + 10 × nivel | — |
  | Misión diaria (3 al día) | 15 a 25 | 10 |
  | Cofre diario (las tres misiones del día) | 20 | — |
  | Misión semanal (3 a la semana) | 60 u 80 | 10 |

- **Precios:** piezas sencillas 40–80, especiales 100–300, raras 400–600 y las mejores 900–1200. Un jugador diario gana unos 100–150 faradios: una pieza sencilla cada día, una rara en una semana. Varias piezas no se compran: se desbloquean gratis al llegar a un nivel (bata en el 3, birrete en el 5, trofeo en el 8, aureola en el 10 y corona en el 15).
- **Misiones:** las mismas para todo el mundo, elegidas a partir de la fecha. Las diarias cambian a medianoche de Madrid e incluyen siempre «Completa el reto de hoy»; las semanales cambian el lunes. Mezclan el reto diario, el archivo y los duelos para que cada modo lleve a los otros. La recompensa se recoge a mano en el perfil, que avisa con un punto en la portada.
- **Racha diaria:** días seguidos completando el reto de hoy. Da un pequeño extra de faradios; perderla no quita nada.
- **Se prueba antes de comprar:** al tocar una pieza que no se tiene, el avatar se la pone y aparece el botón de compra con el precio o lo que falta.
- **Todo en el navegador** (`localStorage`, clave `casi-casi:progreso`). En los duelos, el servidor solo recibe los identificadores de las piezas, los limpia y se los pasa al rival; no comprueba que se hayan comprado.

## Qué buscamos y qué evitamos

Lo que engancha de forma sana: una razón corta para volver cada día (el reto y tres misiones), progreso visible (nivel, racha, armario) y algo propio que enseñar a los demás (el avatar en los duelos).

Lo que no hacemos: cajas de premios al azar, ofertas con cuenta atrás, avisos que castiguen por no entrar, ventajas de pago en el juego ni monedas que caduquen.

## Alternativas descartadas

- **Usar una librería de avatares de GitHub** (DiceBear, Avataaars y similares). Traen estilos ajenos al del juego, licencias distintas por estilo y una dependencia que el proyecto no tiene. Dibujarlo aquí cuesta poco y deja el catálogo en nuestras manos.
- **Avatar en 3D** como el de la referencia. Pide un motor, modelos y mucho más peso para un juego que es una página ligera.
- **Guardar faradios y compras en el servidor.** Sin cuentas no hay a quién asociarlos. Queda para cuando haya inicio de sesión ([idea](../ideas/login-con-supabase.md)).

## Consecuencias

- **Se puede hacer trampa**: quien edite su `localStorage` se pone los faradios o las piezas que quiera. Mientras no haya dinero de por medio no importa; antes de vender nada hay que pasar el progreso al servidor con cuentas.
- El progreso no viaja entre dispositivos y se pierde si se borran los datos del navegador.
- El nivel y la experiencia de los duelos pasan a `progress.js`; quien ya tenía experiencia de duelos la conserva.
- Cómo podría dar ingresos sin romper lo anterior está en la idea [monetizacion-cosmeticos.md](../ideas/monetizacion-cosmeticos.md). No hay nada de pago implementado.
