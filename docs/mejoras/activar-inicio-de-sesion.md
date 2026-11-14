# Activar el inicio de sesión (correo, Google, Apple, Discord y Twitch)

- **Estado:** a medias. Google activado y probado en la Preview de `preprod` el 2026-11-14 (pasos 1, 4 y 5, ver [bitácora](../bitacora/2026-11.md)). Faltan la plantilla del correo (paso 2), el SMTP (paso 3), «Publicar app» en Google, Apple (paso 7, pendiente por el coste del Apple Developer Program) y pasar a producción. Discord y Twitch están activados en Supabase desde el 2026-11-14.
- **Código:** en `preprod` desde la PR #34, [decisión 0022](../decisiones/0022-inicio-de-sesion-desde-el-servidor.md)

El código usa las variables que ya existen (`SUPABASE_URL` y `SUPABASE_SECRET_KEY`): no hay que añadir nada en Vercel. Lo que falta se configura en los paneles de Supabase y de Google. Todo esto toca producción (solo hay un entorno de Supabase): apúntalo en la [bitácora](../bitacora/2026-11.md) al hacerlo.

## 1. Supabase: URL del sitio y de redirección
Panel de Supabase → proyecto `Faraday Game` → **Authentication → URL Configuration**:

- **Site URL:** la URL de producción de la app.
- **Redirect URLs:** añade
  - `https://<dominio de producción>/api/auth/callback`
  - la de las Preview de Vercel, con comodín, por ejemplo `https://*-faraday-gg.vercel.app/api/auth/callback`
  - `http://127.0.0.1:4173/api/auth/callback` y `http://localhost:4173/api/auth/callback` para probar en local con `.env`

Sin esto, al volver de Google Supabase manda al jugador a la Site URL en vez de a `/api/auth/callback` y la sesión no se inicia.

## 2. Supabase: correo con código
**Authentication → Sign In / Providers → Email:** activado. Se puede desactivar «Confirm email» (el código ya confirma el correo).

**Authentication → Emails → Templates → Magic Link:** la plantilla por defecto manda un enlace. Cámbiala para que mande el código, por ejemplo:

```html
<h2>Tu código para entrar en Faraday.gg</h2>
<p>Escribe este código en la app:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Caduca en una hora. Si no lo has pedido tú, ignora este correo.</p>
```

Haz lo mismo en **Confirm signup** (es la que se usa la primera vez que alguien entra con un correo nuevo). Asunto sugerido: «Tu código de Faraday.gg».

La longitud del código está en **Authentication → Sign In / Providers → Email → Email OTP Length**: la app acepta de 6 a 10 cifras y entra sola al escribir la sexta, así que lo más cómodo es dejarlo en 6.

## 3. Supabase: SMTP propio (imprescindible antes de abrirlo a jugadores)
El servidor de correo que trae Supabase solo envía a las direcciones del equipo del proyecto y unos pocos correos por hora. Para jugadores reales hay que configurar un SMTP propio en **Authentication → Emails → SMTP Settings** (por ejemplo, Resend, Brevo o Amazon SES, con un dominio propio verificado). Después, sube el límite en **Authentication → Rate Limits**.

Mientras tanto, se puede probar con los correos de Luis y Álvaro.

## 4. Google Cloud: cliente OAuth
En [Google Cloud Console](https://console.cloud.google.com/):

1. Crea un proyecto (por ejemplo, «Faraday.gg») o usa uno que ya exista.
2. **APIs y servicios → Pantalla de consentimiento de OAuth** (Google Auth Platform → Branding): tipo **Externo**, nombre de la app «Faraday.gg», correo de asistencia y logotipo opcional. Ámbitos: solo `email`, `profile` y `openid`. Mientras esté «En pruebas», solo podrán entrar los usuarios de prueba que añadas; para abrirlo a todos, pulsa **Publicar app** (con esos ámbitos no hace falta la verificación de Google).
3. **Credenciales → Crear credenciales → ID de cliente de OAuth**, tipo **Aplicación web**:
   - **Orígenes de JavaScript autorizados:** la URL de producción.
   - **URI de redirección autorizados:** `https://umiqvlccxxafvafroxii.supabase.co/auth/v1/callback` (es la de Supabase, no la nuestra).
4. Copia el **ID de cliente** y el **secreto de cliente**. No los pegues en el chat de un agente ni en el repositorio.

## 5. Supabase: activar Google
**Authentication → Sign In / Providers → Google:** actívalo y pega el ID y el secreto de cliente. Desde ese momento el botón «Continuar con Google» aparece solo en la app (la API lo comprueba cada minuto).

## 6. Comprobar
1. Abre la app de producción, pulsa **Entrar**, escribe tu correo y comprueba que llega un código (no un enlace) y que al escribirlo aparece tu inicial arriba a la derecha.
2. En otro navegador o en el móvil, entra con el mismo correo: deben aparecer los retos que jugaste en el primero.
3. Prueba **Continuar con Google** (y Apple, Discord o Twitch si están activados) y **Cerrar sesión**.
4. En Supabase, **Authentication → Users**: los usuarios llevan `jugador` en `app_metadata`.

## 7. Apple, Discord y Twitch
El código está en la rama `feat/inicio-sesion-apple-discord-twitch` ([decisión 0054](../decisiones/0054-inicio-de-sesion-con-apple-discord-y-twitch.md)). Los tres usan la misma URL de vuelta, la de Supabase: `https://umiqvlccxxafvafroxii.supabase.co/auth/v1/callback`. No hay que tocar las Redirect URLs del paso 1. Como con Google, el ID y el secreto de cada uno van directos del panel del proveedor al de Supabase: ni al chat de un agente ni al repositorio. Cada botón aparece solo en la app un minuto después de activarlo en Supabase.

### Discord (gratis, 5 minutos)
1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → nombre «Faraday.gg».
2. **OAuth2** → **Redirects** → **Add Redirect** → la URL de Supabase de arriba → **Save Changes**.
3. En la misma página, copia el **Client ID** y pulsa **Reset Secret** para ver el **Client Secret**.
4. Supabase → **Authentication → Sign In / Providers → Discord**: actívalo, pega el ID y el secreto → **Save**.

### Twitch (gratis, 5 minutos)
1. La cuenta de Twitch tiene que tener la verificación en dos pasos activada.
2. [Twitch Developer Console](https://dev.twitch.tv/console/apps) → **Register Your Application**:
   - **Name:** «Faraday.gg» (si está cogido, otro parecido: tiene que ser único en Twitch).
   - **OAuth Redirect URLs:** la URL de Supabase de arriba.
   - **Category:** Website Integration. **Client Type:** Confidential.
3. **Create** → **Manage** → copia el **Client ID** y pulsa **New Secret** para el **Client Secret**.
4. Supabase → **Authentication → Sign In / Providers → Twitch**: actívalo, pega el ID y el secreto → **Save**.

### Apple (de pago, unos 20 minutos más la espera del alta)
1. Hace falta el [Apple Developer Program](https://developer.apple.com/programs/) (99 USD al año). El alta puede tardar uno o dos días.
2. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers**:
   - **+** → **App IDs** → App → descripción «Faraday.gg», Bundle ID `gg.faraday.app` y marca **Sign in with Apple** → **Register**.
   - **+** → **Services IDs** → descripción «Faraday.gg web», identificador `gg.faraday.web` → **Register**. Ábrelo, marca **Sign in with Apple** → **Configure**: App ID principal el de antes, **Domains** `umiqvlccxxafvafroxii.supabase.co` y **Return URLs** la URL de Supabase de arriba → **Save**.
3. **Keys** → **+** → nombre «Faraday.gg Sign in with Apple», marca **Sign in with Apple** → **Configure** → el App ID → **Register** → **Download** el archivo `.p8` (solo se puede descargar una vez; guárdalo fuera del repositorio). Apunta el **Key ID** y tu **Team ID** (arriba a la derecha de la cuenta).
4. Supabase → **Authentication → Sign In / Providers → Apple**: actívalo. En **Client IDs** pon `gg.faraday.web`. En **Secret Key (for OAuth)** va un JWT generado con el `.p8`, el Key ID, el Team ID y el Services ID: Supabase enlaza desde ese mismo panel a su herramienta para generarlo → **Save**.
5. **El JWT caduca a los 6 meses como mucho.** Apunta la fecha en la bitácora y regenéralo antes, o el botón de Apple dejará de funcionar.

## Pendiente después de activarlo
- Política de privacidad y una forma de borrar la cuenta (guardamos correos y, con Google, el nombre).
