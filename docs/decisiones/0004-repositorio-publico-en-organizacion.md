# 0004. Repositorio público en la organización `Faraday-gg`

- **Estado:** aceptada
- **Fecha:** 2026-11-09
- **Quién:** Luis y Álvaro
- **Completa:** la [decisión 0003](0003-despliegue-en-vercel.md), que dejaba abierto quién es propietario del proyecto de Vercel

## Contexto

El repositorio estaba en la cuenta personal de Luis (`borgesinmas/Faraday.gg`) y era privado. En el plan Hobby de Vercel, con un repositorio privado, solo se despliegan los commits del dueño de la cuenta, y Hobby no despliega repositorios privados de organizaciones. Queríamos que los dos fuéramos propietarios del código y que Álvaro pudiera gestionar Vercel sin pagar.

## Decisión

- Se crea la organización gratuita de GitHub **`Faraday-gg`**, con Luis y Álvaro como **Owners**.
- Se **transfiere** el repositorio a [`Faraday-gg/Faraday.gg`](https://github.com/Faraday-gg/Faraday.gg).
- Se hace **público**, para que Vercel Hobby lo despliegue sin depender del autor de los commits.
- Álvaro crea el proyecto de Vercel con su cuenta (`sistemavivacegroup`) e instala la app de Vercel en la organización.

## Alternativas descartadas

| Opción | Por qué no |
| --- | --- |
| Repo privado en la cuenta de Luis y Vercel Hobby a nombre de Luis | Gratis, pero Álvaro no gestionaría Vercel y sus ramas no tendrían despliegues Preview. |
| Organización con repo privado y Vercel Pro | Unos 20 $/mes por miembro. Se reconsiderará si el proyecto pasa a ser comercial, cosa que Hobby no permite. |

## Consecuencias

- Antes de hacerlo público se revisó todo el historial de todas las ramas: no hay claves, tokens ni contraseñas, y nunca se versionaron `.env`, `runtime/` ni respuestas de jugadores. Los correos de los autores de los commits sí son públicos.
- Cualquiera puede ver el código, `research/` y `docs/`. No se escriben en el repositorio datos personales ni secretos.
- Cada uno actualiza su remoto: `git remote set-url origin https://github.com/Faraday-gg/Faraday.gg.git`.
- Conviene proteger `main` y `preprod` en GitHub (*Require a pull request before merging*).
