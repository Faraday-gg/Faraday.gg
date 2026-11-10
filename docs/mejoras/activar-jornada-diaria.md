# Activar la jornada diaria generada con OpenAI

- **Estado:** pendiente
- **Fecha:** 2026-11-10
- **Responsable:** Luis (`borgesinmas`); el paso 5 lo hace Álvaro (`sistemavivacegroup`), porque el proyecto de Vercel está en su cuenta
- **Contexto:** [decisión 0017](../decisiones/0017-jornada-diaria-generada-con-openai.md) y PR #27, ya fusionada en `preprod`

El código que crea cada noche, a las 00:01 de Madrid, la jornada de mañana con 3 preguntas nuevas escritas por OpenAI ya está en el repositorio, pero **no funciona hasta completar estos pasos**. Mientras falte alguno no se rompe nada: la web sigue con las preguntas del banco de plantillas, que se acaba el 14 de diciembre de 2026.

Nunca se escriben en el repositorio, en la bitácora ni en el chat de un agente la clave de OpenAI ni el secreto del cron.

## Pasos

- [ ] **1. Crear la clave de la API de OpenAI** (Luis)
  - Se hace en platform.openai.com, no en chatgpt.com: la suscripción de ChatGPT (Plus o Pro) no incluye la API, que se paga aparte y por uso.
  - En *Settings → Billing*: forma de pago y saldo prepagado. En *Limits*: un límite de gasto mensual.
  - En *API keys → Create new secret key*: crear una clave `casi-casi`. Empieza por `sk-` y solo se ve una vez: guardarla en el gestor de contraseñas.
  - Comprobar que la cuenta tiene acceso al modelo `gpt-5` (el que usa por defecto) o elegir otro con la variable `OPENAI_MODEL`.

- [ ] **2. Crear el secreto del cron** (Luis)
  - Es una contraseña inventada que comparten Supabase y Vercel para que nadie más pueda lanzar la generación. Se genera con:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
  - Guardarlo en el gestor de contraseñas.

- [ ] **3. Probar en local contra OpenAI** (Luis, antes de activar nada)
  - Añadir `OPENAI_API_KEY=sk-...` al `.env` local (Git lo ignora).
  - Ejecutar `node --env-file=.env scripts/generar-jornada.mjs --prueba`. Muestra la jornada de mañana sin guardar nada.
  - Si da error, pasar el mensaje (sin la clave) a un agente para corregirlo. **Hasta ahora no se ha probado nunca contra la API real.**

- [ ] **4. Pasar `preprod` a `main`** (Luis)
  - PR `preprod` → `main` y merge, como siempre.

- [ ] **5. Variables en Vercel** (Álvaro, a petición de Luis)
  - Proyecto `faraday-gg` → *Settings → Environment Variables*, solo en **Production**: `OPENAI_API_KEY` (paso 1) y `CRON_SECRET` (paso 2). Opcional: `OPENAI_MODEL`.
  - Volver a desplegar producción: las variables nuevas solo llegan a los despliegues posteriores.

- [ ] **6. Secreto en Vault de Supabase** (Luis)
  - En el editor SQL del panel del proyecto `Faraday Game`, con el mismo valor del paso 2:
    ```sql
    select vault.create_secret('EL_SECRETO_DEL_PASO_2', 'cron_secret');
    ```

- [ ] **7. Aplicar la migración `20261110120000_jornadas_generadas`** (Luis, o un agente con su confirmación expresa)
  - Admite `source = 'ia'` en `days`, activa `pg_cron` y `pg_net` y programa la tarea `generar-jornada` a las 00:01 de Madrid. Ver [base-de-datos.md](../base-de-datos.md).
  - Apuntarlo en la [bitácora](../bitacora/) y marcar la migración como aplicada en `base-de-datos.md`.

- [ ] **8. Comprobar la primera ejecución** (Luis, el día siguiente al paso 7)
  - La primera llamada es a las 00:01 y crea la jornada de pasado mañana. En el editor SQL:
    ```sql
    select * from cron.job_run_details order by start_time desc limit 5;
    select * from net._http_response order by created desc limit 5;
    select id, source from public.days where source = 'ia' order by id desc limit 5;
    ```
  - Abrir la web y revisar las preguntas generadas.

## Al terminar
Marcar esta tarea como hecha en [mejoras](README.md), cambiar el estado de la [decisión 0017](../decisiones/0017-jornada-diaria-generada-con-openai.md) a «aceptada» y añadir la entrada en la bitácora.
