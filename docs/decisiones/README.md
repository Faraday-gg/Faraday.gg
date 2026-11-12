# Decisiones

Registro de decisiones tomadas. Cada una en un archivo numerado `NNNN-titulo-breve.md`, que no se reescribe: si una decisión cambia, se crea otra nueva que la sustituye y se enlazan entre sí.

| Nº | Decisión | Estado | Fecha |
| --- | --- | --- | --- |
| [0001](0001-supabase-un-solo-entorno.md) | Supabase con un solo entorno (`main`), sin preprod | Aceptada | 2026-11-09 |
| [0002](0002-acceso-a-supabase-solo-desde-el-servidor.md) | Acceso a Supabase solo desde el servidor | Aceptada | 2026-11-09 |
| [0003](0003-despliegue-en-vercel.md) | Despliegue en Vercel con una función que usa el esquema de Supabase | Aceptada (en parte sustituida por 0006) | 2026-11-09 |
| [0004](0004-repositorio-publico-en-organizacion.md) | Repositorio público en la organización `Faraday-gg` | Aceptada | 2026-11-09 |
| [0005](0005-contenido-servido-desde-supabase.md) | El contenido se sirve desde Supabase | Aceptada | 2026-11-09 |
| [0006](0006-vercel-hobby-en-la-cuenta-de-alvaro.md) | Vercel Hobby en la cuenta de Álvaro, con el repositorio público en la organización `Faraday-gg` | Aceptada (en parte sustituida por 0007) | 2026-11-09 |
| [0007](0007-preview-de-vercel-sin-login.md) | Despliegues de Vercel sin Vercel Authentication | Aceptada | 2026-11-09 |
| [0008](0008-categorias-y-archivo.md) | Categorías con icono y archivo desde el 9 de agosto de 2026 | Aceptada (fotos sustituidas por 0013) | 2026-11-10 |
| [0009](0009-jugador-sin-registro-con-cookie.md) | Jugador sin registro: cookie propia con el identificador anónimo | Aceptada | 2026-11-10 |
| [0010](0010-juego-a-pantalla-completa.md) | Juego a pantalla completa, centrado en la pregunta | Aceptada; la parte de pantalla completa la sustituye la 0011 | 2026-11-10 |
| [0011](0011-juego-en-tarjeta.md) | El juego dentro de una tarjeta | Aceptada | 2026-11-10 |
| [0012](0012-tarjeta-de-respuesta-clara.md) | Tarjeta de respuesta: solo lo que importa | Aceptada (acciones y panel revisados en 0021) | 2026-11-10 |
| [0013](0013-preguntas-de-cultura-general.md) | Preguntas de cultura general, referentes conocidos y foto solo cuando ayuda | Aceptada | 2026-11-10 |
| [0014](0014-distribucion-simulada-y-cifras.md) | Distribución simulada, multiplicador animado y cifras más legibles | Aceptada (cifras y animación revisadas en 0020) | 2026-11-10 |
| [0015](0015-portada-sencilla.md) | Portada sencilla: el reto de hoy y los tres pasos | Aceptada | 2026-11-10 |
| [0016](0016-menu-y-archivo-en-calendario.md) | Menú hamburguesa en el juego y archivo en calendario | Aceptada | 2026-11-10 |
| [0017](0017-jornada-diaria-generada-con-openai.md) | La jornada de cada día se genera sola con la API de OpenAI | Aceptada (pendiente de configurar) | 2026-11-10 |
| [0018](0018-color-de-la-pregunta-por-categoria.md) | Color de la tarjeta de pregunta según su categoría (seis tonos) | Aceptada | 2026-11-10 |
| [0020](0020-multiplicador-suave-y-cifras-geist.md) | Multiplicador suave y cifras en Geist | Aceptada | 2026-11-10 |
| [0021](0021-explicacion-en-tarjeta-y-seguir-jugando.md) | «Cómo se calcula» dentro de la tarjeta, foto ampliable y «Seguir jugando» | Aceptada | 2026-11-10 |
| [0022](0022-inicio-de-sesion-desde-el-servidor.md) | Inicio de sesión opcional con código por correo o Google, hecho desde el servidor | Aceptada (pendiente de configurar) | 2026-11-11 |
| [0023](0023-duelos-1vs1.md) | Duelos 1 vs 1 con vida, al estilo GeoGuessr | Propuesta (migración sin aplicar) | 2026-11-11 |
| [0024](0024-avatar-faradios-y-misiones.md) | Avatar personalizable, faradios y misiones | Propuesta | 2026-11-11 |
| [0025](0025-avatar-3d.md) | Avatar en 3D con estética de calle | Propuesta | 2026-11-11 |
| [0026](0026-marcas-reales-en-la-tienda.md) | Piezas de marcas reales en la tienda, con su logotipo | Propuesta | 2026-11-11 |
| [0027](0027-cofres.md) | Cofres con premio al azar, ganados jugando o comprados con faradios | Propuesta | 2026-11-12 |
| [0028](0028-avatar-de-mujer-y-animaciones.md) | Avatar de hombre o de mujer, con su colección, y animaciones más naturales | Propuesta | 2026-11-12 |
| [0029](0029-calculo-por-pasos.md) | «Cómo se calcula» como una cuenta por pasos, con el resultado resaltado | Propuesta | 2026-11-12 |
| [0031](0031-ligas-de-amigos.md) | Ligas de amigos con clasificación semanal | Propuesta (migración sin aplicar) | 2026-11-12 |
| [0032](0032-tarjeta-para-stories.md) | Tarjeta para stories al compartir el resultado del día | Propuesta | 2026-11-12 |

## Plantilla

```markdown
# NNNN. Título

- **Estado:** propuesta | aceptada | sustituida por NNNN
- **Fecha:** AAAA-MM-DD
- **Quién:** nombres

## Contexto
Qué problema había y qué limitaciones.

## Decisión
Qué hacemos.

## Alternativas descartadas
Qué otras opciones había y por qué no.

## Consecuencias
Qué implica, riesgos y cuándo revisarla.
```
