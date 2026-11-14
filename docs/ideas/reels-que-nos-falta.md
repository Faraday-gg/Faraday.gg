# Reels de Casi Casi: qué nos falta para producir los mejores vídeos

- **Estado:** abierta
- **Fecha:** 2026-11-14
- **Propuesta por:** Álvaro (investigación y redacción de Claude Code)
- **Amplía a:** la [idea de reels animados](reels-animados-instagram.md), que recoge las cuentas de referencia y el formato propuesto.

## Qué

Un análisis de carencias, frente por frente, para producir reels con alta probabilidad de viralizarse a partir del contenido diario del juego. La conclusión corta: **la animación no es lo que nos falta**. Con las skills de Remotion, el avatar y la tarjeta de stories podemos producir vídeos técnicamente al nivel del mercado en días. Lo que falta está en siete frentes, y la mayoría no son de software: una cuenta con identidad de serie, música y voz licenciadas, un pipeline que publique y mida solo, y un proceso de iteración con datos.

## Por qué

Para no gastar el esfuerzo en pulir la animación mientras quedan sin resolver los bloqueos que de verdad deciden si un vídeo llega a alguien: licencias de audio, tipo de cuenta, medición y constancia.

## 1. Inventario: qué tenemos ya

| Pieza | Estado | Sirve para el vídeo |
| --- | --- | --- |
| Contenido diario | 3 preguntas al día con foto, fuente, categoría y unidad en `content-engine.mjs`; distribución real en Supabase | Sí: es el guion de cada reel sin escribir nada |
| Tarjeta de stories | `dist/share-card.js`, 1080 × 1920 en canvas, zona segura de 200 px, colores por categoría ([decisión 0032](../decisiones/0032-tarjeta-para-stories.md)) | Sí: es la versión estática del reel |
| Avatar 3D | `dist/avatar3d.js`, Three.js con 7 bailes y celebraciones ([decisión 0053](../decisiones/0053-bailes-del-avatar.md)) | Sí, como personaje; Three.js aún se carga desde una CDN |
| Identidad visual | DM Sans, Geist para cifras y Space Grotesk vía Google Fonts; paleta por categoría | Sí, con licencia libre |
| Fotos | 86 en `dist/assets/` con autor y licencia | Sí; exigen atribución en el vídeo |
| Audio | Ninguno: ni música, ni efectos, ni voz, ni logo sonoro | No |
| Cuentas de Instagram, TikTok o YouTube | Ninguna documentada en el repositorio | No |
| Proyecto Remotion | Ninguno; las skills están instaladas en Claude Code | No |

## 2. Las carencias, por frente y en orden de peso

### Frente 1. Cuenta e identidad de serie (lo más urgente)

- No hay cuenta ni decisión de personaje, nombre de la serie, tono o duración. Las cuentas que crecen de forma sostenida son series reconocibles a simple vista, no virales sueltos.
- El dato que asusta: en 2026 solo el **21 %** de las cuentas de menos de 10.000 seguidores crecieron, y el alcance de los reels cayó un **35 %** interanual (Metricool, 24 millones de publicaciones). Entrar con un formato genérico es perder.
- Hace falta decidir: tipo de cuenta (**Creator**, no Business: la Business solo accede a la Sound Collection de Meta), personaje (el avatar como mascota, al estilo de Duolingo, cuya primera viralidad llegó solo cuando apareció la mascota) y un banco de 30 ganchos probados antes de producir.

### Frente 2. Música, voz y sonido (bloqueante legal)

- Los reels publicados por la API **no pueden llevar música de la biblioteca de Instagram**: Meta solo permite etiquetar audio original. La música tiene que ir embebida en el archivo y licenciada por nosotros.
- La música «royalty-free» no evita silenciamientos automáticos; hay que guardar la licencia para apelar. Opciones: Uppbeat (gratis con atribución, 3 descargas al mes), Artlist (unos 15 $ al mes), Epidemic Sound (unos 18 $ al mes, derechos ligados a la suscripción). La música generada con IA (Suno) tiene riesgo legal real: un tribunal de Múnich falló contra Suno en el caso de GEMA.
- Voz en español: no hay comparativa fiable en castellano. ElevenLabs es la mejor valorada y la más cara; OpenAI gpt-4o-mini-tts y Google Chirp 3 HD cuestan entre 7 y 30 $ por millón de caracteres; Kokoro es gratis y local. Un guion de 25 s son unos 400 caracteres: el coste es irrelevante, la calidad no. Falta una **prueba ciega con nuestros guiones**.
- Faltan efectos de sonido (whoosh, pop, tic del contador) y un logo sonoro de 1 s para el «¡Casi casi!». Más de la mitad del público ve sin sonido: el sonido suma, pero el vídeo tiene que funcionar mudo.

### Frente 3. Pipeline de producción

- No existe el proyecto Remotion ni la plantilla. Hay que construir una composición que lea el JSON del día y la distribución de Supabase, con 5 escenas: pregunta, pausa con «comenta tu cifra», histograma animado, cifra real con contador y fuente, y llamada a jugar.
- Especificaciones a cumplir: MP4 H.264, AAC a 48 kHz, 23–60 fps, 9:16, máximo 300 MB y 15 min; portada JPEG aparte. Zonas seguras que Meta recomienda para anuncios: ~14 % arriba y ~35 % abajo (unos 270 y 670 px). La tarjeta actual usa 200 px, insuficiente para el reel.
- Avatar en el vídeo: Remotion renderiza Three.js, pero Lambda no tiene GPU y lo hace por software. Dos salidas: renderizar en GitHub Actions o en local, o pre-renderizar los bailes del avatar como clips con transparencia y reutilizarlos. Antes hay que traer Three.js al repositorio (ya está en [docs/mejoras](../mejoras/README.md)).
- Licencia de Remotion: gratis hasta 3 personas en la empresa. Somos 2; si entra un tercero externo que renderice, cuenta.
- Coste de render: GitHub Actions gratis y suficiente para 1 vídeo al día; Lambda unos 0,02 $ por minuto de vídeo si hiciera falta escalar.
- Control de calidad automático: legibilidad sin sonido y puerta de render (`remotion-qa`), niveles de audio (`audio-bed-check`) y extracción de fotogramas con ffmpeg para revisar antes de publicar.

### Frente 4. Publicación

- Instagram sí se puede automatizar: la Graph API publica reels (contenedor → estado `FINISHED` → publicar) y acepta **`trial_params`**: cada vídeo puede salir como Trial Reel solo a no seguidores y graduarse a mano o por rendimiento. Requiere cuenta Creator o Business vinculada a una página, el permiso `instagram_content_publish` y, para nuestra propia cuenta, una app de Meta sin revisión pública. Límites: 400 contenedores y entre 50 y 100 publicaciones por 24 h.
- TikTok y YouTube **no**: sus APIs sin auditoría solo publican en privado. Al principio se publica a mano o con un programador (Metricool, Buffer o Postiz, que es libre). Hay que subir el archivo limpio en cada red: la marca de agua de otra plataforma penaliza.
- Multiplataforma es obligatorio: TikTok fue la red donde más cuentas crecieron en 2026 (17 %) y los reels de Instagram tienen ~30 % menos vistas que los vídeos de TikTok. En Instagram, los carruseles consiguen 9 veces más guardados que las imágenes: una versión carrusel del mismo contenido es casi gratis.
- Pie de foto: las publicaciones con pregunta tienen un 36,7 % más de comentarios y las que piden comentar un 202,8 % más; los hashtags restan un 31,7 % de vistas. El pie debe ser una pregunta, sin hashtags.

### Frente 5. Medición y bucle de aprendizaje

- Sin medición no hay viralidad repetible. La API de Insights da por reel: `views`, `reach`, `saved`, `shares`, `comments`, `likes`, `ig_reels_avg_watch_time`, `total_interactions` y `reels_skip_rate` (en desarrollo). Los datos llegan con hasta 48 h de retraso.
- Falta una tabla en Supabase que guarde esas métricas por vídeo y por variante, y un panel. Las métricas que mandan, según Mosseri: tiempo de visionado, likes por alcance y **envíos por alcance** (los envíos deciden si llegas a no seguidores).
- Falta conectar vídeo con juego: un enlace propio del tipo `faraday.gg/reel` para medir jugadores nuevos que vienen de los vídeos. La viralidad sin conversión es el problema que los analistas señalan en Duolingo.

### Frente 6. Legal y normas de la plataforma

- Fotos CC BY: la atribución debe ir en el vídeo y en el pie (título, autor, fuente, licencia). La tarjeta ya lo hace; el reel también debe.
- Etiquetas de IA: la etiqueta obligatoria de perfil solo aplica a perfiles con personas generadas por IA; el avatar dibujado no entra. Si usamos voz sintética o imágenes generadas, la etiqueta «AI info» por publicación es lo prudente. Mosseri ha dicho que 2026 favorece lo imperfecto y humano frente a lo pulido: un acabado demasiado de plantilla puede jugar en contra.
- Nunca datos personales de jugadores en el vídeo; la distribución anónima sí vale.

### Frente 7. Equipo y proceso

- Dos personas. La producción puede ser automática, pero la iteración no: hace falta una revisión diaria de 10 minutos antes de publicar y una retro semanal con métricas.
- Falta un periodo de prueba acotado: **30 días con un formato fijo**, cambiando solo el gancho, antes de juzgar. Las cuentas de referencia producen de 2 a 30 vídeos al día; nosotros tenemos 3 preguntas diarias, es decir, hasta 3 reels sin inventar nada.

## 3. Qué hacer primero (30 días)

1. **Semana 1.** Abrir la cuenta Creator y vincularla a una página; decidir nombre de serie, personaje y duración; elegir música (Uppbeat o Artlist) y hacer la prueba ciega de voz con tres guiones reales. Traer Three.js al repositorio.
2. **Semana 2.** Plantilla Remotion con las 5 escenas y zonas seguras de 270/670 px; render diario en GitHub Actions; puerta de calidad automática; 10 vídeos de prueba revisados fotograma a fotograma.
3. **Semana 3.** Publicación por API como Trial Reel; tabla de métricas en Supabase; carrusel derivado para Instagram; publicación manual en TikTok y YouTube Shorts.
4. **Semana 4.** Tres variantes de gancho por vídeo, elegidas por envíos por alcance y tiempo de visionado; retro con datos y decisión de seguir, cambiar o parar.

Coste estimado del mes: música 0–18 $, voz menos de 1 $, render 0 $ con GitHub Actions. El coste real es tiempo: unas 20 horas de montaje la primera quincena y 1 hora diaria después.

## Dudas y riesgos

- Las cifras de Metricool y de los trackers son globales y de cuentas de marca; nuestra audiencia (español, España y Latinoamérica) puede comportarse distinto. Hay que medir lo nuestro.
- La publicación por API exige una app de Meta y una página de Facebook vinculada; si da problemas, publicar a mano el primer mes no invalida la prueba.
- La prueba ciega de voz puede concluir que ninguna voz sintética convence; la alternativa es grabar la voz de uno de los dos.
- Si el formato no funciona a los 30 días, la decisión debe ser explícita: cambiar el gancho, el personaje o parar.

## Fuentes

Metricool (estudio de Instagram 2026 y estudio de redes 2026), Meta (referencia de publicación de media REELS e Insights de media), «Instagram Ranking Explained» (about.instagram.com), Social Media Today (Mosseri, enero de 2025), TechCrunch (etiqueta de perfiles generados con IA, agosto de 2026), Tubefilter (memo de Mosseri de fin de año), Remotion (licencia, coste de Lambda, GPU, SSR y GitHub Actions), Epidemic Sound y terms.law (música con IA y derechos de Suno), Front Desk Review (licencias de música), Soundstripe (biblioteca de música de Instagram), Hoopr (reels silenciados), DEV y Coval (comparativas de TTS 2026), TikTok (Content Sharing Guidelines), guías de la YouTube Data API, Billo (zonas seguras de Meta), Creative Commons (buenas prácticas de atribución), Brand24 y Marketing Brew (Duolingo y mascotas), Buffer (audio en tendencia), fish.audio (efectos de sonido), Kinovela (retención 2026).
