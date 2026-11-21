# 0112. Skins completas de personajes

- **Estado:** propuesta (código en la rama `feat/skins-de-personajes`)
- **Fecha:** 2026-11-21
- **Quién:** Luis, con Claude Code
- **Amplía:** el [avatar en 3D](0025-avatar-3d.md) y las [marcas reales en la tienda](0026-marcas-reales-en-la-tienda.md), con el mismo riesgo legal que aquella, aquí más alto.

## Contexto

Hasta ahora el avatar solo se vestía: ropa, pantalón, zapatillas, gorro, peinado. Luis quiere skins completas de personajes que todo el mundo reconoce (Sulley, Iron Man, Spider-Man, Stitch), hechas con el mismo estilo que el avatar para que no desentonen.

## Decisión

- **Hueco nuevo «Skins» (`costume`) en el catálogo** (`dist/avatar.js`). Una skin sustituye al muñeco entero (cuerpo, cabeza y cara) mientras se lleva puesta. Vale para los dos cuerpos. «Ninguna» la quita, y ponerse cualquier otra pieza del armario también, porque debajo de la skin no se vería.
- **Cuatro skins**, todas legendarias: Sulley y Stitch (2.500 faradios), Spider-Man (3.000) y Iron Man (3.500). Se compran en el armario y pueden salir en cofres, como cualquier pieza de pago. El catálogo pasa a sumar 153.860 faradios.
- **Dibujadas por nosotros, con el estilo del avatar** (`dist/avatar-skins.js`, archivo nuevo): cabeza de cubo redondeado, contorno de tinta, sombreado por tonos y detalles pintados en un lienzo. Son formas básicas de Three.js; no hay modelos, imágenes ni trazados copiados.
  - Sulley: pelaje turquesa con manchas moradas por la espalda, cuernos, cola que se balancea, garras y mechones.
  - Stitch: orejas grandes con muesca e interior rosa (se balancean), antifaz y barriga claros, marcas oscuras en la nuca y la espalda.
  - Spider-Man: telaraña que nace entre los ojos, araña en el pecho y en la espalda, y ojos de la máscara que se entornan al parpadear.
  - Iron Man: metal pulido (el mismo brillo de los [acabados](0072-acabados.md), teñido de rojo y dorado), careta, reactor del pecho y ojos encendidos.
- **Mismo esqueleto que el avatar normal.** Cada skin devuelve las mismas partes que `buildModel`, así que funcionan sin tocar nada los gestos, los bailes, las reacciones, la mirada que sigue al ratón, la escalada de Ascensión y la primera persona de Archivo Vivo.
- **El servidor acepta el hueco** (`lib/duelos.mjs`, `AVATAR_SLOTS`), de modo que el rival y el grupo de la liga ven la skin. Sigue sin comprobar que la pieza se haya comprado, igual que con el resto.
- Sin migraciones ni cambios en Supabase: el look se guarda como antes, con un campo más.

## Alternativas descartadas

- **Personajes propios que recuerden a los famosos.** Es lo seguro, pero el atractivo está en que se reconozcan.
- **Modelos 3D descargados.** Los de estos personajes no tienen licencia que permita servirlos en un repositorio público, pesan mucho y no tendrían el estilo del avatar.
- **Vestir al muñeco de disfraz** (un mono azul con capucha de cuernos). Se hace con lo que ya hay, pero no es una skin completa: se seguiría viendo la cara del avatar.
- **Skins solo de pago con dinero real.** Descartado de plano por el riesgo legal (ver abajo).

## Consecuencias

- **Riesgo legal, mayor que el de las marcas de la 0026.** Sulley y Stitch son personajes de Disney y Pixar; Spider-Man e Iron Man, de Marvel (también Disney). Están protegidos por derechos de autor y por marca, y no tenemos licencia. Que los dibujos sean nuestros y estén estilizados no cambia eso: son obras derivadas reconocibles, con el nombre real en la tienda, en un repositorio y una web públicos. Disney reclama este tipo de usos con frecuencia. Mientras solo se consigan con faradios ganados jugando el riesgo es menor, pero **no se pueden vender por dinero real, ni usar en publicidad o capturas promocionales, ni incluir en la suscripción**. Antes de pasar a `main` conviene que lo confirmen Luis y Álvaro.
- **Retirarlas es fácil:** basta con borrar su línea del catálogo en `dist/avatar.js` (y, si se quiere, su función en `dist/avatar-skins.js`). Los looks guardados vuelven solos a «Ninguna». Quien la hubiera comprado se quedaría sin ella: habría que devolverle los faradios.
- **La economía queda al límite.** La prueba del simulador (`tests/economia.test.mjs`) exige que el jugador diario gaste entre el 80 % y el 95 % de lo que gana pasado un año; con estos precios da justo por debajo del 95 %. Con 3.000, 3.000, 3.500 y 4.000 faradios se pasaba (95,2 %), y por eso se bajaron. Cualquier pieza de pago nueva puede volver a hacerla fallar ([mejoras](../mejoras/README.md)).
- Con una skin puesta no se ven ni la ropa ni los acabados ni la medalla del pecho; tampoco hay versión con acabado de las skins.
- La silueta plana de reserva (la que se ve hasta que carga el 3D) toma los colores de la skin.
- Sin pruebas automáticas del dibujo: las skins se han comprobado a mano en el navegador.
