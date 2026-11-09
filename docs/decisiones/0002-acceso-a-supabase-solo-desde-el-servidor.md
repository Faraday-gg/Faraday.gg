# 0002. Acceso a Supabase solo desde el servidor

- **Estado:** aceptada
- **Fecha:** 2026-11-09
- **Quién:** Luis (con Claude Code); para conocimiento de Álvaro

## Contexto

Al crear el esquema había que elegir si el navegador habla directamente con Supabase (clave pública + políticas RLS) o si todo pasa por nuestro servidor (hoy `preview-server.mjs`, después funciones de Vercel).

La app ya funciona con un servidor que valida cada respuesta, calcula el hash del identificador anónimo y devuelve solo la distribución de los demás, sin enseñar respuestas individuales. Además, la cifra de referencia de cada pregunta no debería poder leerse antes de responder.

## Decisión

Solo el servidor accede a Supabase, con la clave secreta guardada en variables de entorno (Vercel y `.env` local, nunca en Git). En la base de datos:

- RLS activado en todas las tablas y **sin políticas**.
- Sin permisos para los roles `anon` y `authenticated` sobre tablas ni funciones.

## Alternativas descartadas

| Opción | Por qué no |
| --- | --- |
| Navegador → Supabase con clave pública y políticas RLS | Habría que exponer lecturas de respuestas y cifras de referencia, y mover la validación al navegador o a funciones SQL más complejas. No hay cuentas de usuario que lo justifiquen. |
| Edge Functions de Supabase | Duplicaría la lógica del servidor en otro entorno (Deno). Vercel ya va a alojar el servidor. |

## Consecuencias

- La clave pública de Supabase no da acceso a nada. El aviso «RLS Enabled No Policy» es intencionado.
- Toda nueva funcionalidad que lea o escriba datos pasa por una ruta del servidor.
- Si en el futuro hay cuentas de usuario o lectura directa desde el navegador, esta decisión se sustituye por otra con las políticas RLS necesarias.
