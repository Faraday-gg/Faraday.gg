# Integrar Plus en una modalidad

Este contrato aplica a las modalidades actuales revisadas y a todas las modalidades futuras, también si no tienen cupo diario. Todo modo nuevo registra su contexto y monta la oferta en un momento adecuado, como el resumen; en modos sin límite, la invitación es general y no inventa bloqueos. El precio y el paquete comercial definitivo se deciden por separado. La interfaz refleja lo que hace el servidor, sin añadir ventajas por su cuenta.

## Antes de añadir la oferta

1. Declara si el modo tiene cupo de partidas, edición diaria fija, continuación con anuncio o acceso sin límite.
2. Identifica la respuesta del servidor que confirma disponibilidad y suscripción. No deduzcas el cupo de premios o victorias locales.
3. Explica qué cambia realmente con Plus. Si todavía no está decidido o implementado, usa texto genérico y no prometas quitar ese límite.

## Componente compartido

`dist/plus-offers.js` y `dist/plus-offers.css` se cargan en `dist/index.html`. Una modalidad futura registra su texto y pone un contenedor:

```js
PlusOffers.register('nuevo-modo', {
  title: '¿Te apetece seguir explorando?',
  description: 'Descubre las opciones de Faraday Plus desde tu perfil.'
});
```

```html
<div data-plus-slot="nuevo-modo"></div>
```

El componente detecta también los contenedores añadidos después de cargar la página. Si la pantalla ya se construye con JavaScript, puede usar `PlusOffers.render('nuevo-modo', opciones)`. Las opciones admiten `limit`, `remaining`, `exhausted`, `compact` y `plus` cuando lo confirma el servidor. Un dato desconocido se omite; no se convierte en cero ni en falso. Tras modificar atributos de un contenedor se puede llamar a `PlusOffers.refresh()`.

Los contextos existentes son `daily`, `trends`, `duel`, `duel3`, `ranked`, `practice`, `ascension` y `archivo-vivo`. El registro desconocido tiene un texto de respaldo sin beneficios inventados. No crees otra copia de la tarjeta ni un botón de pago directo en cada modo.

| Modalidad | Acceso real | Momento y contexto de la oferta | Condiciones que conserva |
| --- | --- | --- | --- |
| Ascensión | Una edición diaria competitiva; prácticas después de completarla: una por anuncio simulado (primero de 15 s, siguientes de 60 s) sin límite diario, o sin anuncios con Plus; reanudación gratuita | Resumen terminado de la diaria y de cada práctica, contexto `ascension` registrado por `dist/ascension.js` | Ventaja real: prácticas sin anuncios. La acción gratuita «Ver anuncio de prueba y jugar» permanece visible para cuentas gratuitas, con duración confirmada por API. La suscripción y el tiempo de desbloqueo se comprueban en el servidor. Ver [0100](decisiones/0100-ascension-anuncios-y-curva.md). |
| Archivo Vivo | Colección fija de tres fotos, gratuita y repetible | Resumen, contexto `archivo-vivo` registrado por `dist/archivo-vivo.js` | Oferta general. La repetición es gratuita. |

La acción común abre `Progress.openPlan({mode})`. Antes emite `faraday:before-plan`, cancelable: el juego puede cerrar o suspender su contenedor, o impedir la apertura si hay una ronda en marcha. Traza cierra su diálogo y los duelos cierran únicamente portal o resumen. Ascensión solo permite abrir el plan desde el resumen terminado: cierra su diálogo antes de mostrar el perfil y bloquea la navegación durante las demás fases o peticiones. La navegación nunca debe abandonar una partida al pulsar una oferta.

## Continuación con anuncios

Los modos con cupo montan también el componente común, junto a Plus, cuando pueden ofrecer otra partida:

```html
<div data-continue-slot="nuevo-modo"></div>
```

```js
Continuations.register('nuevo-modo', async offer => {
  // La API de la modalidad valida y consume offer.ticket antes de abrir la partida.
});
```

Antes hay que registrar el modo en `lib/continuaciones.mjs` y en las etiquetas del cliente. Si usa el almacén general, amplía la restricción de su tabla mediante una migración autorizada. Ascensión utiliza el mismo servicio y componente con un adaptador a su JSON privado existente; no amplía esa tabla. La política vigente es primer anuncio completado por modo/día de Madrid de 15 s y todos los siguientes de 60 s en pruebas, sin máximo. El servidor devuelve duración, recibo, plan y partida recuperable. Cancelar no avanza el contador. Un recibo no se reutiliza para otra partida; los reintentos recuperan el desbloqueo. El componente acepta un tercer argumento de preparación si la modalidad necesita validar su última partida antes del anuncio, como Traza.

Las variantes de duelo comparten cinco partidas base y los créditos de sus anuncios, con contadores de duración independientes. El reto diario ofrece prácticas de tres preguntas después de terminar la oficial; no repite su resultado ni paga premios adicionales. Plus evita los anuncios. El archivo sigue libre. Por petición expresa de Álvaro, Ascensión añade esta continuación común después de su diaria; su contador y recibos viven en el JSON privado existente de la modalidad ([0100](decisiones/0100-ascension-anuncios-y-curva.md)). Nunca copies temporizadores o contadores por juego ni uses el contador del navegador como prueba de recompensa real.

Prueba siempre primer anuncio, siguiente largo, cancelación, reintento sin duplicado, recarga y continuación, cambio de cuenta, cambio de día y acceso Plus. Ejecuta `node tests/anuncios.test.mjs`, `node tests/continuaciones.test.mjs` y las pruebas del modo. [Decisión 0099](decisiones/0099-anuncios-para-continuar.md).

## Estados que comprobar

- Invitado y cuenta gratuita; con cobro configurado y sin él.
- Cupo disponible y agotado, obtenido de la API; rechazo de inicio por límite y respuesta tardía.
- Cuenta Plus: no debe seguir recibiendo la oferta de mejora.
- Cuenta o plan que cambia con el módulo visible, sin duplicar tarjetas ni perder el foco.
- Escritorio y móvil de 375 px: texto, acciones y alternativa gratuita legibles.
- Eliminar la cuota de juego no debe alterar límites de emisión, cofres, apuestas, nivel o clasificaciones.

Ejecuta `node tests/plus-offers.test.mjs` y las pruebas de la modalidad. Revisa la pantalla antes de entregar. Al introducir otra política de acceso, actualiza la [decisión 0097](decisiones/0097-modulo-plus-por-modalidad.md) o crea su sucesora.
