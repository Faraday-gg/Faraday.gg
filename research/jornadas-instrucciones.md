# Instrucciones para escribir las jornadas del 16 de noviembre al 14 de diciembre de 2026

Estas jornadas sustituyen al banco de plantillas («¿Cuántos folios A4…?») por preguntas escritas a mano, pensadas para jugadores de España y de toda Latinoamérica ([decisión 0039](../docs/decisiones/0039-preguntas-de-latinoamerica.md)). El plan de cada día está en `research/jornadas-plan.json` (lo genera `research/jornadas-plan.mjs`).

No uses git, no toques otras carpetas ni archivos que no sean los de tus días, no publiques nada ni toques Supabase.

## Reglas editoriales

1. **Cultura general mezclada:** cada pregunta junta un objeto cotidiano o una comida y un referente famoso, con humor. Ejemplo: «¿Cuántos ositos de gominola mide la Estatua de la Libertad?».
2. **Ámbito del plan:** `mundial` (lo conoce cualquiera en cualquier país), `espana` o `latam` (solo lo que conoce cualquier hispanohablante, a ambos lados del Atlántico). El plan da el referente y una idea; puedes cambiar el objeto cotidiano o el enfoque para que la pregunta sea más clara o más graciosa, pero no el referente ni el ámbito ni la categoría. Si no encuentras una fuente fiable, cambia el referente por otro igual de conocido, del mismo ámbito y categoría, y dilo en tu respuesta.
3. **Español neutro:** que se entienda igual en Madrid, en Ciudad de México y en Buenos Aires. Evita palabras de un solo país (caña, folio, móvil, coche, ordenador, patata, zumo; celular, carro, computadora, papa, jugo) y elige otra común («teléfono», «auto», «hoja de papel», «portátil»). Sin «vosotros» ni modismos locales. Sistema métrico. El dinero, en dólares estadounidenses (o con su equivalencia).
4. **Que no se repita:** antes de escribir, busca en `content/archivo/`, `dist/questions.json` y `content/jornadas/` que el referente y la idea no estén ya usados (`grep -ri "<referente>"`).
5. **Tono:** como `dist/questions.json` (títulos con gracia que acaban en «?»; `detail` con las condiciones del juego y una broma; razonamiento en 3 pasos: estimación a ojo, orden de magnitud y afinar con el dato real).
6. **Datos reales:** cada cifra sale de una página que hayas abierto con WebFetch (organismos oficiales, fabricantes, federaciones, museos, agencias espaciales, prensa seria; Wikipedia como último recurso). Nunca inventes datos, URL ni citas. Fecha los datos que cambian con el tiempo. De 1 a 3 fuentes por pregunta.
7. **Cuenta:** calcula `answer` con Node; debe coincidir con `math`, `referenceExpression` (solo números sin separador de miles, coma decimal, ×, ÷, +, − y paréntesis) y `calc`.

## Formato

Un archivo por día: `content/jornadas/AAAA-MM-DD.json`, JSON con 2 espacios:

```json
{
  "id": "2026-11-16",
  "name": "Lunes",
  "theme": "Tres palabras que unen el día («Café, Andes y cielo»)",
  "questions": [
    {"id":"jornada-2026-11-16-1","revision":1,"verifiedAt":"<fecha de hoy>","category":"<del plan>","ambito":"<del plan>",
     "tag":"2 o 3 palabras","title":"¿…?","detail":"…","unit":"unidad en plural",
     "answer":0,"math":"…","referenceExpression":"…","assumptions":"…","confidence":"Dato documentado + cálculo",
     "sources":[{"title":"Organismo · Título de la página","url":"https://…","fact":"El dato que sacas de ella."}],
     "reasoning":{"heading":"…","steps":["…","…","…"]},
     "calc":{"intro":"Una frase corta con la idea.","rows":[{"label":"Concepto (2–5 palabras)","value":"cifra con unidad"},{"label":"…","value":"÷ 7 kg"}],"result":"Nombre del resultado"}}
  ]
}
```

- `name`: el día de la semana en español con mayúscula («Lunes»).
- Preguntas en el orden del plan (`position`).
- `confidence`: «Dato documentado», «Dato documentado + cálculo» o «Dato documentado + modelo».
- `calc.rows`: de 2 a 6 filas; desde la segunda, `value` empieza por la operación («× 182», «÷ 7 kg»; un subtotal opcional, por «=»). `result` es el nombre del resultado («Alfajores»); la cifra la pone el juego. Mira las preguntas de `dist/questions.json` como ejemplo.
- Sin `actualidad` ni `generated`.

## Fotos

Solo las preguntas con `"photo": true` en el plan, y ninguna otra:

1. `node research/foto-commons.mjs buscar "<texto>"`
2. `node research/foto-commons.mjs bajar "File:<nombre>" <fecha> <posición>`: guarda `dist/assets/archivo-<fecha>-<posición>.jpg` (o `.png`) e imprime el objeto `image`.
3. Renómbrala a `dist/assets/jornada-<fecha>-<posición>.jpg` (o `.png`), pon ese `src` (`assets/jornada-…`) y añade un `alt` en español.

Elige la foto que más ayude a imaginar la escala. Conserva autoría y licencia tal como las da Commons.

## Comprobar

`node research/validar-jornadas.mjs <desde> <hasta>` debe dar OK para tus días.

Respuesta final (máximo 10 líneas): resultado de la validación, referentes o enfoques que cambiaste respecto al plan y por qué, y datos de los que no estés seguro.
