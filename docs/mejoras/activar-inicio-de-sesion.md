# Activar el inicio de sesión (correo y Google)

- **Estado:** pendiente (Luis)
- **Código:** rama `feat/inicio-de-sesion`, [decisión 0022](../decisiones/0022-inicio-de-sesion-desde-el-servidor.md)

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
3. Prueba **Continuar con Google** y **Cerrar sesión**.
4. En Supabase, **Authentication → Users**: los usuarios llevan `jugador` en `app_metadata`.

## Pendiente después de activarlo
- Política de privacidad y una forma de borrar la cuenta (guardamos correos y, con Google, el nombre).
- Apple, si se quiere (necesita una cuenta de Apple Developer de pago).
