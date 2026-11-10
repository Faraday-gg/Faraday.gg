# Instrucciones para reescribir preguntas (revisión de noviembre de 2026)

Carpeta de trabajo: `C:\Users\LuisMartinezBorges\Documents\Fermigg\casi-casi-revision` (git worktree). No uses git, no toques otra carpeta, no publiques nada ni toques Supabase.

## Reglas editoriales del propietario (Luis)

1. Mezclar conceptos de cultura general básica en una misma pregunta, para que todo el mundo la entienda y se entretenga. Ejemplo de Luis: «¿Cuántos ositos de gominola mide la estatua X?». Un objeto cotidiano o comida + un referente famoso, con humor.
2. Referentes muy conocidos: sobre todo mundiales; los hispanos, solo si los conoce cualquier hispanohablante. Nada de sitios o eventos locales poco conocidos.
3. Las marcadas `specific: true` pueden ser más difíciles, pero tienen que ser interesantes o graciosas, como las de fermi.gg.
4. Foto solo si el plan dice `photo: true` (en torno al 17 % del total): la que más ayude a imaginar la escala. Si `photo: false`, la pregunta NO lleva campo `image`.
5. Tono: como las preguntas de `dist/questions.json` (títulos con gracia, `detail` con las condiciones del juego y una broma, razonamiento en 3 pasos: estimación a ojo, orden de magnitud y afinar con el dato real).

## Qué hacer en cada día de tu rango

Lee la entrada del día en `research/revision-plan.json` y el día actual (`content/archivo/<fecha>.json`, o el día dentro de `dist/questions.json` para el piloto).

- `keep`: no cambies el contenido. Ya se le ha quitado la foto si no la necesita (en el piloto, eso te toca a ti). Respeta la posición que marca el plan.
- `rewrite` / `new`: escribe la pregunta siguiendo el plan. Puedes pulir el título, pero sin saltarte las reglas. Si no encuentras una fuente fiable, cambia el referente por otro igual de conocido, de la misma categoría y que no se use en otro día del plan.
- Investiga con WebFetch (y WebSearch si te queda cupo; se agota pronto, así que ve directo a páginas conocidas: organismos oficiales, fabricantes, federaciones, museos, NASA, Wikipedia como último recurso). Cada cifra debe salir de una página que hayas abierto. Nunca inventes datos, URL ni citas. Fija con fecha los datos que cambian.
- Calcula `answer` con Node; debe coincidir con `math` y `referenceExpression`.
- Foto (`photo: true` en preguntas nuevas o reescritas): `node research/foto-commons.mjs buscar "<texto>"` y `node research/foto-commons.mjs bajar "File:<nombre>" <fecha> <posición>`. Copia el JSON que imprime y añade un `alt` en español. Puede sobrescribir una foto antigua del mismo hueco; está bien.
- No borres fotos. Nunca toques `dist/assets/question-*.jpg` ni `dist/assets/las-canteras.jpg`: los usa el banco automático.

Campos de cada pregunta (los ids, según dónde esté):

```json
{"id":"…","revision":1,"verifiedAt":"<fecha de hoy>","category":"<del plan>","tag":"…","title":"¿…?","detail":"…","unit":"…",
 "answer":0,"math":"…","referenceExpression":"…","assumptions":"…","confidence":"…",
 "sources":[{"title":"…","url":"https://…","fact":"…"}],
 "image":{"src":"…","alt":"…","credit":"…","url":"…","license":"…","licenseUrl":"…"},
 "reasoning":{"heading":"…","steps":["…","…","…"]}}
```

- Archivo (hasta el 2026-11-08): `id` = `archivo-<fecha>-<posición>`. El día se escribe en `content/archivo/<fecha>.json` con `id`, `name`, `theme` (el del plan) y `questions`, en el orden del plan.
- Piloto (del 2026-11-09 al 2026-11-15, en `dist/questions.json`): las `keep` conservan su id `piloto-v2-N`; las `rewrite`/`new` llevan `piloto-v3-<fecha>-<posición>`. Si una nueva lleva foto, renómbrala a `dist/assets/piloto-<fecha>-<posición>.jpg` (o `.png`) y pon ese `src`. Cambia `theme` por el del plan, quita `image` de las que no la llevan y respeta el orden del plan. Después regenera `dist/questions.js` con `'window.PILOT_DAYS = '+JSON.stringify(dias,null,2)+';\n'`. Conserva el formato de `dist/questions.json` (JSON con 2 espacios).

## Comprobar

- Archivo: `node research/validar-archivo.mjs <desde> <hasta>` debe dar OK.
- Piloto: `node tests/editorial.test.mjs`. Hasta que todos los agentes terminen, puede fallar solo por el porcentaje de fotos; cualquier otro error, corrígelo.

Respuesta final (máximo 10 líneas): resultado de la validación, referentes que cambiaste respecto al plan y por qué, y datos de los que no estés seguro.
