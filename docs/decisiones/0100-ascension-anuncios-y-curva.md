# 0100. Anuncios de continuación y curva normal en Ascensión

- **Estado:** implementada.
- **Fecha:** 2026-11-19.
- **Quién:** Álvaro, con Codex.
- **Amplía:** [0098](0098-ascension-respuestas-raras.md), sustituyendo su acceso a nuevas prácticas sin anuncio.

## Contexto

Álvaro señala dos omisiones de Ascensión: la alternativa de continuar con anuncios y la curva sobre las barras de distribución. La primera entrega permitía prácticas sin publicidad y solo dibujaba las barras.

## Decisión

Tras la diaria, cada nueva práctica gratuita requiere un anuncio compartido de prueba: primero de 15 segundos por modalidad y día, siguientes de 60, conforme a la [0099](0099-anuncios-para-continuar.md). No hay límite diario de anuncios. La cuenta Plus, comprobada desde la identidad del servidor, accede sin anuncios. Recuperar una práctica ya abierta no exige otro anuncio. La clasificación sigue reservada a la primera diaria y no cambian puntuaciones, premios o cosméticos.

`preparar-practica` prepara un recibo con el servicio común `lib/continuaciones.mjs`. El componente `dist/continuations.js` presenta el anuncio y confirma su finalización en `/api/continuacion`; `practica` exige y consume el recibo para el número exacto de partida. No se confía en campos `plus` o `watched` del navegador. Cancelar no cuenta como anuncio completado y no concede recibo. Inserción única y actualización por versión mantienen el flujo seguro ante peticiones repetidas, preparación en dos pestañas y reinicio. Los recibos y contadores se guardan mediante un adaptador en `state.continuationAds`, en el JSON privado existente de Ascensión: no requiere migración ni nuevos permisos y funciona aunque siga pendiente la migración general de anuncios. No se mezclan recibos de otros modos ni sus cuotas de duelos.

La interfaz reutiliza `Continuations` y `Ads.rewarded`, muestra que el anuncio es simulado y conserva el resultado si se cierra. El botón final del anuncio permanece oculto y no acepta clics hasta terminar. La publicidad real y los comprobantes de un proveedor no están integrados; el mínimo transcurrido no se presenta como prueba de exposición a publicidad real. El perfil y la oferta común de Plus incluyen ahora la ventaja de Ascensión sin anuncios.

El gráfico mantiene los 14 intervalos reales de puntuación y superpone una curva normal ajustada a media y desviación típica de los resultados ajenos exactos. La propia respuesta queda excluida del ajuste y se marca aparte con «Tú». Curva y barras utilizan la misma escala de frecuencias. Con menos de cinco resultados ajenos o desviación cero se muestran las barras y un aviso; no se genera una campana ni una muestra ficticia. El ajuste es descriptivo y no implica que los datos sigan realmente una distribución normal.

## Alternativas descartadas

- Abrir prácticas solo al pulsar un botón de anuncio: se valida también el plazo en el servidor.
- Anuncio al retomar una partida: penaliza recargas y cierres sin crear otra práctica.
- Campana decorativa fija o inferida de los centros de las barras: no representaría la media y dispersión exactas de los resultados.
- Añadir proveedor o tablas de anuncios: el componente existente y el estado privado bastan para este flujo de prueba.

## Comprobaciones

48 suites aprobadas tras integrar la PR #147. Pruebas de anuncio preparado, cancelación, 14.999/15.000 ms y 60 segundos, recibos completados y consumidos, reinicio, reintentos, concurrencia, plan confirmado/caducado y ausencia de clasificación en prácticas. Pruebas del gráfico para ajuste exacto, marcador, muestra pequeña, cero dispersión y extremos. Revisión visual local en escritorio y a 375 px con puntuaciones sintéticas, sin datos remotos.
