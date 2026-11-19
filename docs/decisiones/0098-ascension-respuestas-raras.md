# 0098. Ascensión: respuestas raras y una montaña con avatar

- **Estado:** implementada; integración hacia `preprod` en la rama `feat/ascension-respuestas-raras`.
- **Fecha:** 2026-11-19.
- **Quién:** Álvaro, con Codex.
- **Amplía:** [0096](0096-celebraciones-por-resultado.md). Aprueba la [propuesta de Ascensión](../ideas/ascension-respuestas-raras.md).

## Contexto

Álvaro encarga un juego de respuestas poco evidentes inspirado en la experiencia observada de Krillion, con diseño de Faraday y el avatar como protagonista. La referencia se revisó mediante una diaria autorizada, distintos niveles de puntuación, una respuesta inválida en práctica, su clasificación y los compañeros desbloqueables por racha. Se utiliza para estudiar la experiencia; el banco y los gráficos de Faraday son propios.

## Decisión

El avatar escala una montaña con repisas. Cada respuesta válida mueve el paisaje, anima la escalada y la llegada, y termina con el emote elegido en el armario. La ropa permanece visible. Se recorren campo base, bosque, nubes, arista, nieve y cima. La alternativa con movimiento reducido presenta directamente altura y postura final.

Una partida contiene siete categorías distintas, con un máximo de dos por tema en el banco inicial. Hay 25 segundos por respuesta, medidos en el servidor. Los puntos editoriales son 10, 30, 60, 85 y 100; pasar o agotar el tiempo suma cero. Cada punto equivale a diez metros, hasta 700 puntos y 7.000 m. Toda categoría permite una respuesta de 100. La rareza es una valoración editorial fija, explícitamente diferenciada de la popularidad entre jugadores.

El banco inicial reúne 28 categorías y 2.637 entradas por categoría, con nombres alternativos, normalización y fuentes. Favorece conjuntos cerrados: territorios, conceptos del repertorio emoji, laureados, elementos, constelaciones, provincias, entidades mexicanas, lenguas y monedas con corte temporal. Los conjuntos se solapan: la cifra total no representa entidades únicas. No se anuncia cobertura de respuestas abiertas ilimitadas. Preparación reproducible, límites y licencias en [las fuentes](../../research/ascension-fuentes.md).

La categoría se revela al comenzar el plazo. Una respuesta desconocida permite reintentar sin cambiarlo; una errata de una edición solo propone corrección si es inequívoca y requiere confirmación. La API revela la respuesta canónica y hasta cinco ejemplos de la categoría después de resolver. No persiste el texto rechazado ni entrega el banco al navegador.

La diaria es común para todos y cambia a medianoche de Madrid. La partida debe completarse antes del cambio. El servidor guarda la copia privada de sus categorías y una huella de edición para conservar los intentos frente a actualizaciones editoriales. La clasificación agrupa fecha, versión y entorno; incluye únicamente diarias terminadas, con posición, empates, percentil y distribución real. Si falta muestra, se comunica sin inventar jugadores. Tras completar la diaria hay prácticas ilimitadas, excluidas de la clasificación y sin premios económicos.

La identidad proviene de cuenta o cookie HttpOnly. `ascension_runs` guarda diaria y prácticas con clave compuesta, versión optimista y reloj persistido: recargar, duplicar peticiones o abrir dos pestañas no reinicia el tiempo ni duplica puntos. `preview` y `publico` están separados dentro del Supabase compartido. La tabla tiene RLS, sin acceso de `anon` ni `authenticated`, y permisos exclusivos de servidor. Álvaro autorizó aplicar la migración, registrada como `20261119055720_ascension`.

El armario incorpora Ascensión con seis huecos: 100, 85, 60, 30, 10 y 0 puntos. Cada uno hereda la selección general o permite una excepción, el original o ningún gesto. Los 22 gestos existentes siguen incluidos. Nuevos emotes de cofres, tienda o mercado requieren un catálogo de inventario validado por servidor; se mantiene esa evolución pendiente. Ningún cosmético modifica puntos o plazos. El resumen monta el módulo común de Plus con invitación general, oculta para suscriptores y sin alterar las prácticas gratuitas.

## Alternativas descartadas

- Pared continua: deja al avatar de espaldas y dificulta mostrar ropa y bailes. Las repisas permiten celebrar de pie.
- Vuelo o cohete: el vehículo ocultaría parte del personaje. La montaña hace visible al propio avatar.
- Puntuación dependiente de frecuencias en vivo: cambiaría el valor de una respuesta dentro de la misma competición y necesita una muestra suficiente.
- Validación mediante IA durante la partida: introduce latencia, coste e inconsistencias. El banco revisado fija pertenencia y puntos.
- Copia del banco o de los recursos de Krillion: se construye un catálogo propio con fuentes primarias y escenario original.

## Comprobaciones y evolución

Las suites de reglas, banco y HTTP comprueban edición, aliases, reloj, reintentos, corrección confirmada, concurrencia, persistencia, clasificación, prácticas, identidad y adaptador Supabase. Las 44 suites del proyecto pasan tras integrar las PR #144 y #145 de Plus. La migración se validó también en Postgres local y se comprobaron RLS y permisos tras aplicarla. La revisión visual cubre escritorio y móvil, partida y personalización.

El primer banco requiere seguir ampliando categorías y revisar calibración editorial antes de añadir recompensas o vender emotes. Su número de entradas y fuentes es público en el repositorio: no se promete protección frente a quien busque las respuestas fuera del juego. El ranking evita manipulación directa desde el navegador; no verifica que un jugador haya respondido sin ayuda externa.
