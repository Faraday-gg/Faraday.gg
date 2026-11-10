# Inicio de sesión con correo, Google y Apple

- **Estado:** abierta (implementación futura)
- **Fecha:** 2026-11-10
- **Propuesta por:** Luis

## Qué
Añadir un sistema de inicio de sesión con Supabase Auth:

- **Correo electrónico:** enlace mágico o código de un solo uso, sin contraseña (o con contraseña si se prefiere).
- **Google** y **Apple:** botones con su icono oficial para entrar con un clic (OAuth de Supabase).

El juego debe seguir pudiendo jugarse sin cuenta. Iniciar sesión sería opcional.

## Por qué
- Guardar el progreso, las notas y el historial en la cuenta y no solo en el navegador, para jugar desde varios dispositivos.
- Base para rachas, estadísticas personales y un ranking con nombre.
- Al iniciar sesión, las respuestas anónimas del navegador (`casi-casi:anonymous-player`) podrían asociarse a la cuenta.

## Cómo podría hacerse
- Activar en Supabase los proveedores Email, Google y Apple y configurar las URL de redirección (producción y Preview de Vercel).
- Google: crear un cliente OAuth en Google Cloud. Apple: requiere cuenta de Apple Developer (de pago), un *Services ID* y una clave para firmar.
- En el cliente: usar la clave publicable de Supabase solo para Auth, o hacer el flujo desde `lib/api.mjs` para mantener la [decisión 0002](../decisiones/0002-acceso-a-supabase-solo-desde-el-servidor.md) (acceso a datos solo desde el servidor). Hay que decidirlo.
- Esquema: tabla de perfiles enlazada a `auth.users` y una columna para relacionar `answers` con el usuario. Migración en `supabase/migrations/` y documentada en [base-de-datos.md](../base-de-datos.md).
- Interfaz: botón «Entrar» en la cabecera y un diálogo con el campo de correo y los botones de Google y Apple.

## Dudas y riesgos
- Rompe la regla actual de no exponer Supabase al navegador: hace falta una decisión nueva.
- Supabase tiene un solo entorno (producción): las pruebas de Auth crearían usuarios reales.
- Datos personales (correos): hay que añadir política de privacidad y la opción de borrar la cuenta.
- Coste y trámites de la cuenta de Apple Developer.
- No añade dependencias si se usa la API REST de Auth directamente; con `@supabase/supabase-js` sí habría una.
