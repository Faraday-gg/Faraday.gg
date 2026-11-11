# 0023. Avatar en 3D con estética de calle

- **Estado:** propuesta (código en la rama `feat/avatar-tienda-misiones`)
- **Fecha:** 2026-11-11
- **Quién:** Luis, con Claude Code
- **Sustituye a:** la parte del avatar de la [0022](0022-avatar-faradios-y-misiones.md) (muñeco por capas en SVG). Los faradios, las misiones y los niveles de la 0022 siguen igual.

## Contexto

El avatar en SVG de la 0022 se veía plano y demasiado infantil. Luis quiere que el avatar tenga peso en el juego, como en GeoGuessr: en 3D, grande en varias pantallas, sin fondos y con ropa de calle (gorra plana, chaqueta universitaria, pantalón ancho, zapatillas gruesas).

Se buscaron alternativas ya hechas. Ready Player Me cerró el 31 de enero de 2026; los sustitutos comerciales crean avatares realistas a partir de un selfie, no un muñeco con tienda propia. Hay personajes base con licencia CC0 (Quaternius), pero no se encontró ropa de calle 3D gratuita, y la de pago obliga a revisar si su licencia permite servir los modelos en un repositorio público.

## Decisión

- **Personaje propio construido en el código** (`dist/avatar3d.js`), con Three.js. Cabeza de cubo redondeado, ojos altos con párpado caído, cejas y media sonrisa; contorno de tinta y sombreado por tonos, tipo cómic. No hay modelos descargados: el cuerpo son formas básicas y la ropa se pinta en un lienzo que envuelve el torso (broches, parches, dorsales, estampados).
- **No es una copia del avatar de GeoGuessr.** Comparte el género (muñeco cabezón de cuerpo entero), pero la cara, las proporciones y las marcas son nuestras: ≈ y FRDY. No se reproducen logotipos ni diseños de marcas reales (por ejemplo, el chándal lleva dos franjas, no tres).
- **Un solo contexto 3D para toda la página.** `dist/avatar.js` escribe huecos `<span class="avatar-view">` con el look ya traducido y una silueta plana de reserva; `avatar3d.js` los rellena. Los avatares pequeños (marcador, avisos, tienda) son una imagen fija que se dibuja una vez y se guarda; los grandes (portada, perfil, duelo) se animan a unos 30 fotogramas por segundo. Así no se agota el límite de contextos 3D del navegador.
- **Catálogo nuevo: 153 piezas en 11 huecos** (`dist/avatar.js`): ropa, pantalón, zapatillas, cabeza, peinado, color de pelo, gafas, cuello, extras, gesto y piel. Ya no hay fondos ni objetos en la mano. Precios por rareza: común hasta 99 faradios, especial desde 100, rara desde 250, épica desde 600 y legendaria desde 1.400. Todo el catálogo suma 34.900 faradios, cuatro veces más que el de la 0022.
- **Piezas por nivel:** camiseta ≈ dorada (3), gorra dorada (5), diente de oro (8), aureola (10) y corona (15).
- **El avatar en grande:** en la portada (lleva al armario), en el perfil (se gira arrastrando), en el portal del duelo, al encontrar rival, en el resultado de cada ronda (el que pierde se sacude, el que gana salta) y al final.
- **Faraday-bot** tiene su propio aspecto de robot (piel de metal, cascos y gafas oscuras) y sigue llamándose siempre «Faraday-bot».
- **Sonido y animaciones del duelo** (`dist/duel.js`, sin archivos de audio): golpe de tensión al encontrar rival; música tranquila mientras se piensa; campana de dos golpes cuando llega la primera respuesta de la ronda, y música rápida que sube de tono mientras corre el reloj de 30 segundos. El botón de sonido lo apaga todo.

## Alternativas descartadas

- **Modelos comprados o descargados.** Dan prendas con más detalle, pero añaden megas, licencias que revisar y un flujo de trabajo en Blender que no tenemos.
- **Un contexto 3D por avatar.** Es lo más sencillo, pero la tienda enseña decenas de piezas a la vez y los navegadores limitan los contextos activos.
- **Mantener el SVG como alternativa completa.** Obligaba a dibujar cada pieza dos veces. Queda solo una silueta de reserva para cuando el 3D no carga.

## Consecuencias

- **Primera dependencia del proyecto.** Three.js (licencia MIT) se carga ahora desde la CDN jsDelivr, lo que añade un servicio externo en cada visita. Hay que traer la librería al repositorio antes de pasar a producción ([mejoras](../mejoras/README.md)).
- La página pesa más: la librería ronda los 700 KB. Se carga después del resto y no bloquea el juego.
- Si el navegador no tiene WebGL o la librería no carga, se ve la silueta plana y el juego funciona igual.
- La ropa es sencilla: siluetas, colores y estampados. No hay pliegues de tela ni zapatillas con detalle fino.
- Los looks guardados con el catálogo en SVG no valen: las piezas desconocidas vuelven a las de por defecto. Esa versión no llegó a `preprod`, así que no afecta a ningún jugador.
- El servidor de duelos acepta los huecos nuevos (`lib/duelos.mjs`) y sigue sin comprobar que las piezas se hayan comprado.
- Sin pruebas automáticas: el avatar y el sonido solo se han comprobado a mano en el navegador.
