# 0099. Anuncios ilimitados para continuar por modalidad

- **Estado:** implementada; migración preparada, pendiente de autorización para la base compartida.
- **Fecha:** 2026-11-19.
- **Quién:** Álvaro, con Codex.
- **Amplía:** [0097](0097-modulo-plus-por-modalidad.md) y [0091](0091-reanudar-trazos-y-partidas-extra.md).

## Contexto

El plan gratuito permite cinco duelos compartidos al día y una edición diaria de Traza y del reto de estimación. Álvaro pide continuar mediante anuncios sin tope, con un primer anuncio corto y los siguientes largos en cada modalidad, manteniendo la alternativa de suscripción.

## Decisión

El módulo común `Continuations` acompaña a `PlusOffers` cuando se agota el acceso gratuito. Cada anuncio completado desbloquea otra partida. El primero de cada modalidad y día de Madrid dura 15 segundos en la simulación; el segundo y todos los siguientes, 60 segundos. Cancelar no cuenta como visualización. Los contadores se separan en `daily`, `trends`, `duel`, `duel3`, `ranked` y `practice` (bot). Las cuatro variantes de duelo añaden créditos al cupo compartido, conservando sus requisitos de nivel, sala y premios. No hay máximo de anuncios; la lectura de duelos se pagina para no dejar de contar al superar 200.

El reto diario oficial conserva sus tres preguntas y su único resultado. La continuación crea una práctica de tres preguntas editoriales anteriores, con fuentes, explicaciones y avatar. Guarda el primer intento de cada pregunta y permite retomar la partida sin otro anuncio. No aporta respuestas a la distribución oficial, premios, experiencia, misiones, racha ni clasificación. El archivo y las prácticas gratuitas de Ascensión conservan su acceso ilimitado sin anuncios.

Plus abre directamente las partidas extra y los duelos sin anuncios. Sus límites económicos son los mismos: un anuncio o una suscripción no elimina topes de emisión, premios, cofres o desbloqueos. No se fija precio nuevo ni se activa contratación.

El servidor identifica al jugador mediante cuenta o cookie HttpOnly, calcula la fecha y mide el tiempo mínimo. Los recibos son idempotentes y las actualizaciones filtran la versión anterior para resolver concurrencia. Un recibo usado no desbloquea otra partida; una respuesta perdida o un fallo al guardar permiten recuperar el desbloqueo. La tabla privada `continuation_states` separa entornos y solo permite acceso al servidor. La migración es nueva y aditiva; no se aplica por el merge de Vercel.

Las modalidades futuras con cupo deben registrar el modo en el servidor y conectar su continuación al componente compartido. Los modos sin límite mantienen su acceso gratuito y una invitación general a Plus; no necesitan un anuncio artificial.

## Proveedor real

La interfaz identifica los anuncios como simulados. El temporizador del servidor solo valida esta simulación, no acredita una impresión comercial. Al integrar un proveedor, el desbloqueo debe depender de su confirmación de recompensa completada; no basta con un contador del navegador. La creatividad, el inventario y la configuración del proveedor determinarán la duración disponible: no se garantizan piezas reales de exactamente 15 o 60 segundos. La [documentación oficial de Ad Placement](https://developers.google.com/ad-placement/apis?hl=en) describe la aceptación voluntaria y los eventos `adViewed` y `adDismissed`.

## Alternativas descartadas

- Aumentar el cupo del reto oficial: alteraría la competición y sus premios. Se añaden prácticas aparte.
- Contar anuncios en el navegador: recargar o cambiar el reloj permitiría reiniciar el escalado o reclamar créditos.
- Límite de una partida extra: contradice la continuidad ilimitada solicitada.
- Forzar anuncios en prácticas que ya son gratuitas: introduce una restricción ajena al encargo de ampliar cupos.

## Comprobaciones y pendientes

Pruebas de reglas y API: duración mínima, cancelación, aislamiento por jugador/modalidad/día, más de 25 anuncios, concurrencia, persistencia, recuperación, cuotas compartidas, Plus y prácticas sin premios. Prueba del diálogo con reloj simulado y revisión real en escritorio y 375 px. Postgres local verifica esquema, RLS, permisos privados y actualización por versión. La migración compartida y el proveedor real quedan pendientes; no se insertan jugadores de prueba en Supabase.
