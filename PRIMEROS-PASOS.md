# Primeros pasos para colaborar (Mac)

> **Archivo temporal.** Es solo para preparar tu Mac la primera vez. Cuando hayas terminado todos los pasos, sigue el último apartado para borrarlo del proyecto.

Todo se hace una sola vez, en la app **Terminal** (Aplicaciones → Utilidades → Terminal). Copia cada comando, pégalo y pulsa Intro.

## 1. Acepta la invitación

Te habrá llegado por email. Si no la encuentras, abre https://github.com/borgesinmas/Faraday.gg/invitations con tu cuenta de GitHub y acéptala.

## 2. Instala Homebrew

Homebrew es el instalador de programas para Mac. Si ya lo tienes (`brew --version` responde), sáltate este paso.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Te pedirá la contraseña del Mac. Al terminar, el instalador muestra un par de comandos en **"Next steps"**: cópialos y ejecútalos para que `brew` funcione.

## 3. Instala Git, GitHub CLI y Node.js

```bash
brew install git gh node
```

- **Git** guarda y sube los cambios.
- **GitHub CLI (`gh`)** permite a tu IA abrir PR y comentar en ellas por su cuenta.
- **Node.js** hace falta para arrancar la app y ejecutar los tests.

## 4. Inicia sesión en GitHub con tu cuenta

```bash
gh auth login
```

Elige, en este orden: **GitHub.com** → **HTTPS** → **Yes** (usar las credenciales de GitHub para Git) → **Login with a web browser**. Copia el código que aparece, pégalo en el navegador y acepta.

Compruébalo con `gh auth status`: debe salir tu usuario.

## 5. Pon tu nombre en los commits

Con tus propios datos:

```bash
git config --global user.name "Tu Nombre"
```

```bash
git config --global user.email "tu-email@ejemplo.com"
```

## 6. Descarga el proyecto

```bash
cd ~/Documents && gh repo clone borgesinmas/Faraday.gg && cd Faraday.gg
```

Si ya lo tenías descargado, actualízalo con `git switch preprod && git pull`.

## 7. Prueba que la app arranca

```bash
node preview-server.mjs
```

Abre en el navegador la dirección que muestra la terminal. Para pararlo, pulsa `Ctrl + C`.

## 8. Trabaja con tu IA

Abre la carpeta `Faraday.gg` con tu IA (Claude Code, Codex, Cursor…) y pídele lo que quieras hacer. Leerá [AGENTS.md](AGENTS.md) y seguirá el flujo sola:

1. Crea una rama `feat/...` o `fix/...` desde `preprod`.
2. Hace los cambios y ejecuta los tests.
3. Abre la PR hacia `preprod` y te pasa el enlace.

El propietario del repositorio (`borgesinmas`) revisa la PR y hace el merge. Ni tú ni tu IA hacéis merge ni subís nada directamente a `main` o `preprod`.

Si prefieres no usar la terminal para Git, también puedes usar **GitHub Desktop** para Mac (https://desktop.github.com) y clonar desde File → Clone repository. Aun así, haz los pasos 3 y 4: `gh` es lo que permite a tu IA abrir PR y comentar.

## 9. Cuando termines: borra este archivo

Pídele a tu IA, con estas palabras o parecidas:

> Ya he terminado los primeros pasos. Borra `PRIMEROS-PASOS.md` siguiendo AGENTS.md: rama `fix/quitar-primeros-pasos` desde `preprod`, commit y PR hacia `preprod`.

Será tu primera PR y te servirá para comprobar que todo funciona. Cuando el propietario la acepte, el archivo desaparecerá del proyecto.
