# 0129. Celebraciones y emotes como categorías del armario, y amigos con avatar

- **Estado:** prototipo para revisión
- **Fecha:** 2026-11-27
- **Quién:** Luis, con Claude

## Contexto

Las celebraciones ([0096](0096-celebraciones-por-resultado.md)) estaban detrás de un botón suelto encima del armario que lo sustituía entero. Luis las quiere como una categoría más de la barra deslizable (como Peinado, Skins o Ropa) y con filtros. Además, el bloque «Con amigos» de la portada solo tenía atajos: no enseñaba quién está conectado ni su avatar.

## Decisión

### Armario

- **«Celebraciones» y «Emotes» son las dos últimas categorías de la barra del armario**, con su icono y su contador. Desaparece el botón suelto; los enlaces antiguos a `celebraciones` llevan a la categoría.
- **Celebraciones:** lo de antes (qué gesto hace el avatar en cada resultado, por modo) con filtros: modo, tipo de momento (resultados, final de duelo, otros), «solo las que he cambiado» y buscador.
- **Emotes:** el catálogo de gestos en cartas, con vista previa en el probador. Filtros: buscador, tipo (celebración, baile, decepción, neutro) y todos / favoritos / en uso.
- **Favoritos:** hasta 10, en orden. Son la **rueda de emotes del jugador en el lobby** ([0124](0124-lobby-publico-al-entrar.md)); sin favoritos, la rueda es la de siempre. Se guardan con el progreso (`state.emotes`) y viajan a la cuenta. `Progress.emoteWheel()` los devuelve.
- **No hay economía nueva:** todos los gestos siguen incluidos para todos, sin precio, rareza ni dueño (0096). No se tocan el catálogo ni los premios.

### Amigos

- **«Con amigos» en la portada lista a los amigos** en dos grupos, «En línea (n)» y «Desconectados (n)», con la cara del avatar en un círculo pequeño (como el chip de «Tu perfil»), un punto de estado y la actividad. Hasta 6 por grupo y «Ver todos». En móvil es una tira de caras.
- El cajón «Amigos y ligas» usa los mismos grupos y avatares.
- **El servidor guarda el aspecto del avatar** en el perfil social (`social_profiles.look`, migración `20261126120100_amigos_aspecto`, pendiente de aplicar): el navegador lo envía en su pulso y la acción `amigos` lo devuelve. Si la columna no existe todavía, la lista funciona con el avatar por defecto.

## Alternativas descartadas

- **Meter los emotes en `Avatar.SLOTS` o en el catálogo:** entrarían en la tienda y en sus pruebas como piezas con precio.
- **Poner precio o rareza a los emotes** para tener más filtros: contradice la 0096 y exige inventario comprobado en el servidor.
- **Avatares animados en cada carta de emote:** 23 lienzos a la vez.

## Consecuencias

- La rueda del Salón no usa todavía los favoritos (su código no se ha tocado); el lobby sí.
- «En línea» sigue siendo «visto en los últimos dos minutos y medio», como antes.
- `README.md` y `ARQUITECTURA.md` describían el botón antiguo; se actualizan en esta misma PR.
