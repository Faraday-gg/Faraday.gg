# 0045. Camisetas de selección con las banderas de los países hispanohablantes y de Europa

- **Estado:** propuesta (código en la rama `feat/banderas-cosmeticos`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code

## Contexto

Luis pide cosméticos con las banderas de todos los países hispanohablantes y de algunos europeos, para que cada jugador pueda llevar la de su país.

## Decisión

- **33 camisetas nuevas por cuerpo** (66 piezas en total; el catálogo pasa de 394 a 460), en el hueco **Ropa**, con el nombre del país: «Camiseta España» en el cuerpo de hombre y «Top España» en el de mujer.
  - **Los 21 países hispanohablantes:** España, México, Colombia, Argentina, Perú, Venezuela, Chile, Ecuador, Guatemala, Cuba, Bolivia, República Dominicana, Honduras, Paraguay, El Salvador, Nicaragua, Costa Rica, Panamá, Uruguay, Puerto Rico y Guinea Ecuatorial.
  - **12 europeos:** Francia, Italia, Portugal, Alemania, Reino Unido, Irlanda, Países Bajos, Bélgica, Grecia, Suiza, Suecia y Polonia.
- **Diseño de camiseta de selección:** la prenda lleva el color del equipo, la bandera en el pecho y, a la espalda, las siglas del país (ESP, MEX, ARG…, las de la FIFA) con una bandera pequeña encima.
- **Banderas simplificadas, dibujadas en `dist/avatar3d.js`** (`FLAGS` y `drawFlag`): franjas, triángulos, cruces y estrellas con sus colores; los escudos se resumen en una forma sencilla (un círculo, un recuadro). No se descarga ninguna imagen.
- **Precio único de 200 faradios** (rareza «especial»): son piezas de identidad, no de prestigio, y conviene que cualquiera pueda comprar la de su país pronto. Salen también en los cofres, como el resto de piezas con precio.
- En el catálogo (`dist/avatar.js`), una camiseta de bandera lleva el estampado `'#código'` (código ISO de dos letras: `'#es'`, `'#mx'`…). Los identificadores son `bandera-<código>` y `mj-bandera-<código>`.

## Alternativas descartadas

- **Un hueco nuevo «Bandera»** (parche, capa o banderín que se suma a cualquier prenda): más vistoso, pero necesita formas 3D nuevas y tocar los huecos que acepta el servidor (`AVATAR_SLOTS`). Se puede hacer más adelante.
- **Banderas como imágenes** (SVG o PNG descargados): más fieles en los escudos, pero añaden archivos y licencias; a este tamaño la versión simplificada se reconoce igual.
- **Escudos detallados** (México, España, Ecuador…): no se distinguen en el pecho del avatar y complican el dibujo.

## Consecuencias

- La lista de **Ropa** crece de 73 a 106 piezas por cuerpo. Si se hace larga de recorrer, convendrá un filtro o un apartado «Selecciones» en la tienda.
- Algunas banderas se parecen (Honduras, El Salvador y Nicaragua; Colombia y Ecuador): se distinguen por el emblema del centro y por las siglas de la espalda.
- Las banderas son símbolos oficiales de los Estados, no marcas: no tienen el riesgo legal de las piezas de marca ([0026](0026-marcas-reales-en-la-tienda.md)). Sí pueden despertar discusiones (por ejemplo, territorios o países que falten); para añadir uno basta con una línea en `FLAGS` de los dos archivos.
- Sin pruebas automáticas de dibujo: las 33 banderas y las camisetas (delante y detrás, en los dos cuerpos) se han comprobado a mano en el navegador.
