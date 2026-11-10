# 0006. Vercel Hobby en la cuenta de Álvaro, con el repositorio público en la organización `Faraday-gg`

- **Estado:** aceptada. Sustituye en parte a la [0003](0003-despliegue-en-vercel.md) en lo relativo al propietario del proyecto de Vercel.
- **Sustituida en parte por:** la [0007](0007-preview-de-vercel-sin-login.md), en lo relativo a la protección de los despliegues Preview.
- **Relacionada:** la [0004](0004-repositorio-publico-en-organizacion.md) recoge el paso del repositorio a la organización y su publicación; esta añade el proyecto de Vercel. Se numeró 0004 en su rama y se renumeró a 0006 al integrarla con `preprod`.
- **Fecha:** 2026-11-09
- **Quién:** Luis y Álvaro (Luis movió el repositorio; Álvaro, con Claude, creó el proyecto de Vercel)

## Contexto

La decisión 0003 dejó pendiente quién sería propietario del proyecto de Vercel. Queríamos seguir gratis, en el plan Hobby, y que el propietario fuera Álvaro. Con el repositorio en la cuenta personal de Luis y privado había dos bloqueos, según la documentación de Vercel:

- Solo el propietario de un repositorio de una cuenta personal puede importarlo o conectarlo a un proyecto de Vercel. Un colaborador no puede.
- En Hobby, con repositorio privado, solo despliegan los commits del propietario de la cuenta de Vercel. Los merges de Luis se habrían bloqueado.

## Decisión

- El repositorio pasa a la organización de GitHub **`Faraday-gg`** (plan Free), con Luis y Álvaro como Owners: <https://github.com/Faraday-gg/Faraday.gg>.
- El repositorio es **público**. Antes se revisó el historial de todas las ramas: no hay claves ni datos de jugadores. Las claves viven en variables de entorno de Vercel.
- El proyecto de Vercel **`faraday-gg`** está en la cuenta **Hobby** de Álvaro (`sistemavivacegroup`, ámbito `faraday-game`). Se conecta al repositorio con la app de Vercel instalada en la organización, con acceso solo a `Faraday.gg`.
- La rama de producción de Vercel es **`main`**. `preprod` y el resto de ramas generan despliegues Preview.

## Alternativas descartadas

| Opción | Por qué no |
| --- | --- |
| Proyecto de Vercel en la cuenta de Luis | Funcionaba sin mover nada, pero preferimos que el propietario sea Álvaro. |
| Repositorio privado en la organización con Vercel Pro | Tiene coste por miembro, y queremos seguir gratis. |
| Repositorio privado en la organización con Vercel Hobby | Solo desplegarían los commits de Álvaro. |

## Consecuencias

- Con el repositorio público, Hobby despliega los commits de cualquiera de los dos. Las PR desde *forks* de terceros necesitan autorización en Vercel antes de desplegarse (Git Fork Protection).
- El código, el contenido y los correos de los autores de los commits son visibles para cualquiera.
- Hobby no admite miembros de equipo: **solo Álvaro accede al panel de Vercel**. Luis ve el estado de los despliegues en GitHub, en los *checks* y comentarios de las PR, pero no los registros. Además, los despliegues Preview están protegidos con Vercel Authentication, así que hoy solo los abre Álvaro (ver [bitácora](../bitacora/2026-11.md)).
- Si algún día se necesita repositorio privado o más personas en Vercel, habrá que pasar a Pro y sustituir esta decisión.
