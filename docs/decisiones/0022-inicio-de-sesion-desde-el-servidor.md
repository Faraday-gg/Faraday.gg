# 0022 — Inicio de sesión opcional con correo o Google, hecho desde el servidor

- **Fecha:** 2026-11-11
- **Quién:** Luis, con Claude Code
- **Estado:** aceptada (pendiente de configurar en Supabase y Google: ver [pasos](../mejoras/activar-inicio-de-sesion.md))

## Contexto
No había forma de entrar en la app. El jugador se reconocía solo por un UUID anónimo en `localStorage` y en la cookie `faraday_jugador` ([decisión 0009](0009-jugador-sin-registro-con-cookie.md)), que no sirve para pasar de un dispositivo a otro. Luis pidió inicio de sesión por correo o con Google. Estaba apuntado como [idea](../ideas/login-con-supabase.md).

## Decisión
- **Opcional.** Se sigue pudiendo jugar sin cuenta. En la portada hay un botón «Entrar» arriba a la derecha y en el menú, una sección «Tu cuenta».
- **Correo con código de 6 cifras**, sin contraseña. Supabase envía el código y el jugador lo escribe en la app. Se eligió frente al enlace mágico porque funciona aunque el correo se abra en otro dispositivo o en otro navegador.
- **Google** con OAuth y PKCE. El botón solo aparece cuando Google está activado en Supabase (la API lo consulta en `/auth/v1/settings`).
- **Todo pasa por nuestro servidor** (`lib/auth.mjs` y las rutas `/api/auth/*` de `lib/api.mjs`), que llama a la API REST de Supabase Auth con la clave secreta. Así se mantiene la [decisión 0002](0002-acceso-a-supabase-solo-desde-el-servidor.md): el navegador no habla con Supabase, no hay clave publicable en `dist/`, no hacen falta políticas RLS y no se añade ninguna dependencia.
- **La sesión vive en cookies `HttpOnly`** puestas por el servidor: `faraday_sesion` (token de acceso, 1 hora) y `faraday_refresco` (token de refresco, 60 días). Cuando el de acceso caduca, el servidor lo renueva solo. El JavaScript de la página nunca ve los tokens. Para Google, el verificador PKCE va 10 minutos en `faraday_pkce`.
- **La cuenta se enlaza con el jugador**, sin tocar el esquema: la primera vez que se entra, el servidor guarda el UUID del jugador de ese dispositivo en `app_metadata.jugador` del usuario de Supabase (solo lo puede escribir la clave secreta). Las respuestas siguen en `answers` con el mismo `player_hash`.
- **En otro dispositivo**, al entrar, `POST /api/jugador` devuelve el jugador de la cuenta y su progreso. El progreso de la cuenta sustituye al local y los días de los últimos 30 que se jugaron allí sin cuenta se suben a ella.
- **Al cerrar sesión** el dispositivo recibe un jugador anónimo nuevo y se borra el progreso local, que queda guardado en la cuenta. Así otra persona que use el mismo dispositivo no sigue con la partida de la cuenta. El bloc (notas e historial) no se toca.

## Alternativas descartadas
- **Enlace mágico:** falla si el enlace se abre en un navegador distinto del que lo pidió (por ejemplo, la app de correo del móvil).
- **Correo y contraseña:** más fricción y obliga a hacer la recuperación de contraseña.
- **`supabase-js` en el navegador con la clave publicable:** más rápido de montar, pero rompe la decisión 0002, obliga a escribir políticas RLS y añade una dependencia.
- **Tabla de perfiles con migración:** no hace falta mientras la cuenta solo guarde el jugador. `app_metadata` evita aplicar una migración en la única base de datos (producción).
- **Apple:** estaba en la idea, pero necesita una cuenta de Apple Developer de pago. Se deja para más adelante.

## Consecuencias
- Hasta que se configure Supabase (plantilla del correo con `{{ .Token }}`, URL de redirección, SMTP propio) y Google Cloud, el botón «Entrar» abre el diálogo, pero el correo no llega con código o Google no aparece. Los pasos están en [mejoras/activar-inicio-de-sesion.md](../mejoras/activar-inicio-de-sesion.md).
- Por primera vez guardamos datos personales (el correo, y el nombre con Google) en `auth.users`. Antes de anunciarlo hace falta una política de privacidad y una forma de borrar la cuenta.
- Supabase tiene un solo entorno: probar el inicio de sesión en una Preview de Vercel crea usuarios reales en producción.
- Las Preview de Vercel tienen otra URL: hay que añadir `https://*-faraday-gg.vercel.app/**` (o la que corresponda) a las URL de redirección de Supabase para que Google funcione en ellas.
- Si la cookie de jugador o la cuenta se usaran para algo más que guardar la partida (analítica, publicidad), habría que revisar la decisión 0009 y el aviso de cookies.
