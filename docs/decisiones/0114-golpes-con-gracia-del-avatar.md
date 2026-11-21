# 0114. Golpes con gracia: quince reacciones más del avatar al tocarlo

- **Estado:** aceptada (código en la rama `feat/avatar-golpes-graciosos`)
- **Fecha:** 2026-11-21
- **Quién:** Luis, con Claude Code

## Contexto

Desde la [decisión 0070](0070-avatar-sigue-al-raton-y-dice-ay.md), al tocar al avatar animado hace uno de dos gestos cortos (`ay`, `ay2`) y dice «¡Ay!». Luis pidió más reacciones, graciosas y bien hechas: que a veces le duela tanto que dé una voltereta, se caiga al suelo y se levante poco a poco, y otras por el estilo, hasta quince, cada una con su sonido hecho como los que ya hay.

## Decisión

### Quince gestos nuevos (`dist/avatar3d.js`, `CLIPS`)

| Gesto | Qué hace |
|---|---|
| `voltereta` | Sale por los aires dando una vuelta y cuarto hacia atrás, encogido; cae de espaldas, rebota, ve las estrellas, se incorpora frotándose la cabeza, se pone en pie y vuelve a su sitio a saltitos. |
| `culetazo` | Se le van los pies y cae sentado, con rebote y polvo; se levanta dolorido. |
| `cojo` | Da una vuelta entera a la pata coja, braceando. |
| `trompo` | Gira como una peonza tres vueltas y se queda mareado, con los ojos dando vueltas. |
| `cohete` | Se encoge, sale disparado hacia arriba hasta salir del encuadre y vuelve a caer con un aplastón. |
| `gelatina` | Tiembla entero como un flan. |
| `tortuga` | Esconde la cabeza entre los hombros, mira a los lados y la saca de golpe. |
| `berrinche` | Patalea con una marca de enfado, se da la vuelta con los brazos cruzados y mira de reojo. |
| `llorera` | Se frota los ojos y llora a chorros; al final se seca. |
| `karate` | Se revuelve: guardia, dos puñetazos, una patada y un saludo. |
| `tronco` | Se queda tieso y cae de lado como un árbol; tumbado abre un ojo, y se levanta rígido, cimbreando. |
| `desinflar` | Se le va el aire y se queda pequeñito; protesta y se hincha en tres bombeos. |
| `calambre` | Le da la corriente: en estrella, vibrando entre rayos, y acaba echando humo. |
| `cosquillas` | No le duele: se retuerce de risa. |
| `matrix` | Esquiva el toque doblándose hacia atrás a cámara lenta y dice que no con el dedo. |

### Lo que hizo falta añadir al esqueleto

- **Piernas que se levantan** (canales `la`, `lb`, `oa`, `ob`). Antes las piernas solo seguían a la cadera con los pies clavados al suelo. Ahora cada una puede girar desde la cadera hacia delante o hacia fuera, con la zapatilla en la punta: sirve para sentarse, dar patadas, patalear y saltar en estrella.
- **Aplastarse y estirarse** (`sq`) conservando el volumen, y **tamaño del personaje entero** (`zm`).
- **Cabeza que se hunde** entre los hombros (`hd`).
- **Boca abierta** (`open`): un óvalo de tinta que sustituye a la boca mientras grita, llora o ríe.
- **Adornos de cómic** pintados en 2D encima del lienzo del avatar, con el mismo contorno de tinta (`effects`): estallido donde cae el toque, estrellas del mareo, lágrimas, rayos, marca de enfado y nubes de polvo o humo.
- La voltereta gira alrededor del centro del cuerpo usando el canal de caída que ya tenía el desmayo (`fall`, `gx`, `gy`), compensando el desplazamiento en el propio gesto.

### Cuál sale al tocarlo (`poke`)

- Tres grupos: el «¡Ay!» de siempre (`ay`, `ay2`), ocho golpes cortos y siete largos.
- En el primer toque sale un largo el 22 % de las veces; cada toque a menos de 7 s del anterior sube esa probabilidad 18 puntos, hasta el 80 %. Del resto, tres de cada cuatro son golpes cortos y uno el «¡Ay!». No se repite el mismo dos veces seguidas.
- Los largos no se pueden interrumpir con otro toque hasta que casi han acabado (`lock`).
- `voltereta` y `tronco` se tumban de lado y solo salen donde el lienzo es ancho (portada y reto diario); en el armario y los duelos, de encuadre estrecho, no.
- Mientras el avatar responde o espera el resultado (manos en la boca) y en los encuadres que no son de cuerpo entero, solo sale el «¡Ay!» corto.
- Con «reducir movimiento» sigue sin haber toque, como en la 0070.

### Sonido (`dist/sound.js`, `Sound.gag`)

Cada gesto tiene su sonido, hecho con las mismas piezas que el resto del juego y sin archivos: tonos que se deslizan, ruido filtrado y la voz por formantes de la 0070 (`Sound.voice`). Se programa entero al empezar, con los tiempos del gesto: el porrazo suena cuando toca el suelo, cada «¡ia!» con su puñetazo y cada sollozo con su hipo. Piezas comunes: bofetada, porrazo, pajaritos del mareo, muelle y soplido. Respeta el silencio y el volumen del juego.

## Alternativas descartadas

- **Rodillas y codos de verdad (huesos) para caer y levantarse:** más realista, pero obliga a rehacer el pantalón como malla con huesos en todos los modos (hoy solo existe para la escalada). Con las piernas girando desde la cadera basta para el tono de dibujo animado.
- **Adornos en 3D** (estrellas y rayos como objetos de la escena): más coste por fotograma y sombras que no vienen a cuento; en 2D quedan como onomatopeyas de tebeo y no pesan.
- **Elegir siempre al azar entre las diecisiete:** las largas duran hasta seis segundos; si salieran siempre, tocar al avatar cansaría. Por eso son menos probables al principio y más si se insiste.
- **Archivos de audio:** igual que en la 0070, el juego genera todos sus sonidos.

## Consecuencias

- Los canales nuevos valen cero en reposo: los gestos, bailes y reacciones que ya había no cambian.
- Los gestos nuevos están en `Avatar3D.gags` y sus sonidos en `Sound.gags`; se pueden probar desde la consola con `Avatar3D.play('voltereta')` y `Sound.gag('voltereta')`.
- Los sonidos no se han podido escuchar desde el agente: se comprobó que se programan sin errores y con los tiempos del gesto. Puede hacer falta ajustarlos de oído (volúmenes y tonos de voz).
- Si otro avatar animado se añade con un encuadre nuevo de cuerpo entero, hay que incluirlo en la lista de `poke` para que tenga las reacciones nuevas.
