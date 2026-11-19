// Comprueba el banco real, no un catálogo mínimo de prueba. No usa red ni datos de jugadores.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateAscensionBank,ascensionAnswer,ascensionNormalize,ascensionEdition,ASCENSION_ROUNDS} from '../lib/ascension.mjs';

const raw=JSON.parse(fs.readFileSync(new URL('../content/ascension.json',import.meta.url),'utf8'));
const bank=validateAscensionBank(raw);
assert.equal(bank.categories.length,28,'El banco inicial tiene 28 categorías con cobertura documentada');
const total=bank.categories.reduce((sum,category)=>sum+category.answers.length,0);
assert.ok(total>=2000,`Hay ${total} respuestas canónicas, sin contar aliases`);
assert.equal(raw.rarity,'editorial','No se presenta la clasificación como probabilidad real');
const category=id=>{const one=bank.categories.find(c=>c.id===id);assert.ok(one,`Existe ${id}`);return one};
const match=(id,value)=>ascensionAnswer(category(id),value).answer;
const accepted=(id,value,name)=>{const one=match(id,value);assert.ok(one,`${id} acepta «${value}»`);if(name)assert.equal(one.name,name);return one};

for(const c of bank.categories){
  assert.ok(c.sources.length&&c.sources.every(source=>source.title&&source.url.startsWith('https://')),`${c.id}: fuentes primarias enlazadas`);
  assert.ok(c.theme,`${c.id}: dominio para diversificar la diaria`);
  assert.ok(c.description.length>30,`${c.id}: alcance explicado`);
  assert.ok(c.answers.some(answer=>answer.points===100),`${c.id}: permite alcanzar la cima`);
  assert.ok(c.answers.length>=10,`${c.id}: alternativas suficientes`);
  const aliases=new Map();
  for(const answer of c.answers){
    assert.ok([10,30,60,85,100].includes(answer.points),`${c.id}: puntos editoriales admitidos`);
    for(const value of [answer.name,...answer.aliases]){
      const key=ascensionNormalize(value);assert.ok(key,`${c.id}: nombre o alias alfanumérico`);
      assert.ok(!aliases.has(key)||aliases.get(key)===answer.name,`${c.id}: el alias «${value}» no pertenece a dos respuestas`);
      aliases.set(key,answer.name);
      const resolved=ascensionAnswer(c,value).answer;
      assert.equal(resolved?.name,answer.name,`${c.id}: cada nombre registrado resuelve su propia respuesta`);
      assert.equal(resolved.points,answer.points,'Un alias conserva la puntuación de su concepto');
    }
  }
}

accepted('paises-territorios','  MEXICO!!!  ','México');
accepted('paises-territorios','UK','Reino Unido');
accepted('paises-territorios','Vaticano');accepted('paises-territorios','Palestina');accepted('paises-territorios','Kosovo');
accepted('emoji-comida','papa','patata');accepted('emoji-comida','PALTA','aguacate');
accepted('idiomas','castellano','español');accepted('idiomas','vasco','euskera');
accepted('monedas','USD','dólar estadounidense');
accepted('elementos','H','Hidrógeno');accepted('elementos','tungsteno','Wolframio');
accepted('constelaciones','Ursa Major','Osa Mayor');
accepted('provincias-espana','Vizcaya','Bizkaia');accepted('provincias-espana','Gerona','Girona');
accepted('entidades-mexico','CDMX','Ciudad de México');accepted('entidades-mexico','Michoacan','Michoacán de Ocampo');
accepted('nobel-physics','Einstein','Albert Einstein');
accepted('nobel-literature','Vargas Llosa','Mario Vargas Llosa');
assert.equal(accepted('nobel-medicine','Alexander Fleming','Alexander Fleming').points,10,'El tratamiento Sir no es necesario para una respuesta conocida');
assert.equal(accepted('nobel-medicine','Sir Alexander Fleming','Alexander Fleming').points,10,'Se conserva el literal de la fuente');
assert.equal(accepted('nobel-peace','Madre Teresa','Mother Teresa').points,10,'El nombre habitual español se reconoce');
assert.equal(accepted('nobel-peace','Anjezë Gonxhe Bojaxhiu','Mother Teresa').points,10,'El nombre legal de la API resuelve el mismo concepto');
assert.equal(accepted('nobel-peace','Obama').points,10,'La calibración no cambia por la presencia o ausencia de una inicial');
assert.equal(accepted('nobel-physics','Peter Higgs').points,30);
assert.equal(accepted('nobel-physics','Peter W. Higgs').points,30);

accepted('nobel-physics','Marie Curie','Marie Curie');accepted('nobel-physics','Pierre Curie','Pierre Curie');
assert.equal(match('nobel-physics','Curie'),null,'El apellido compartido no resuelve arbitrariamente a una persona');
assert.equal(match('nobel-physics','Isaac Newton'),null,'Ser científico famoso no implica haber recibido el Nobel');
assert.equal(match('provincias-espana','Ceuta'),null,'La categoría distingue provincia de ciudad autónoma');
assert.equal(match('entidades-mexico','Cancún'),null,'Una ciudad turística no se confunde con un estado');
assert.equal(match('constelaciones','Triángulo de Verano'),null,'Un asterismo no se convierte en una constelación oficial');
assert.equal(match('monedas','bitcoin'),null,'El conjunto de curso legal a fecha fija no incluye cualquier activo');
assert.equal(match('emoji-comida','animal'),null,'No se usan las palabras clave genéricas de CLDR como respuestas');

// Con el banco de producción, cada diaria tiene siete categorías, una selección estable y una cima posible.
for(let day=1;day<=30;day++){
  const date=`2026-11-${String(day).padStart(2,'0')}`;
  const first=ascensionEdition(date,bank),again=ascensionEdition(date,bank);
  assert.deepEqual(first,again,'La edición no depende de las respuestas de otros jugadores');
  assert.equal(first.length,ASCENSION_ROUNDS);
  assert.equal(new Set(first.map(entry=>entry.id)).size,ASCENSION_ROUNDS,'Las categorías del día no se repiten');
  const themes=new Map();
  for(const entry of first){
    assert.ok(entry.answers.some(answer=>answer.points===100),'Toda ronda de la diaria admite una respuesta de cumbre');
    themes.set(entry.theme,(themes.get(entry.theme)||0)+1);
  }
  assert.ok([...themes.values()].every(count=>count<=2),'No concentra la diaria en un solo dominio');
}
assert.ok(fs.readFileSync(new URL('../research/licenses/unicode-license.txt',import.meta.url),'utf8').includes('UNICODE LICENSE V3'),'La atribución de datos tiene su licencia completa');
console.log(`Ascensión banco: OK (${bank.categories.length} categorías, ${total} respuestas; fuentes, aliases, cobertura y cima)`);
