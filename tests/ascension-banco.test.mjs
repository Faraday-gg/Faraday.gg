// Comprueba el banco real, no un catálogo mínimo de prueba. No usa red ni datos de jugadores.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateAscensionBank,ascensionAnswer,ascensionNormalize,ascensionEdition,ASCENSION_ROUNDS} from '../lib/ascension.mjs';

const raw=JSON.parse(fs.readFileSync(new URL('../content/ascension.json',import.meta.url),'utf8'));
const bank=validateAscensionBank(raw);
assert.equal(bank.categories.length,57,'El banco editorial actual reúne 57 categorías');
const total=bank.categories.reduce((sum,category)=>sum+category.answers.length,0);
assert.ok(total>=3570,`Hay ${total} respuestas canónicas, sin contar aliases`);
assert.equal(raw.rarity,'editorial','No se presenta la clasificación como probabilidad real');
const category=id=>{const one=bank.categories.find(c=>c.id===id);assert.ok(one,`Existe ${id}`);return one};
const match=(id,value)=>ascensionAnswer(category(id),value).answer;
const accepted=(id,value,name)=>{const one=match(id,value);assert.ok(one,`${id} acepta «${value}»`);if(name)assert.equal(one.name,name);return one};

for(const c of bank.categories){
  assert.ok(c.sources.length&&c.sources.every(source=>source.title&&source.url.startsWith('https://')),`${c.id}: fuentes primarias enlazadas`);
  assert.ok(c.theme,`${c.id}: dominio para diversificar la diaria`);
  assert.ok(c.description.length>30,`${c.id}: alcance explicado`);
  assert.ok(c.answers.some(answer=>answer.points===100&&!answer.million),`${c.id}: conserva una respuesta de cumbre ordinaria`);
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
      assert.equal(resolved.million,answer.million,'Un alias conserva el impulso de su concepto');
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

// Entradas conocidas, regionales y erratas reales de las nuevas preguntas.
accepted('pixar','Intensamente','Del revés');
accepted('pixar','Cooc','Coco');
accepted('oscar-animacion','Shre','Shrek');
accepted('pixar','ratatuile','Ratatouille');
accepted('pixar','toy stroy 2','Toy Story 2');
accepted('pixar','toy stori','Toy Story');
accepted('pixar','wall e','WALL·E');
accepted('disney-animacion','Moana','Vaiana');
accepted('deportes-paris','basquetbol','Baloncesto');
accepted('mundial-catar','Arabia Saudita','Arabia Saudí');
accepted('mundial-femenino-2023','colmobia','Colombia');
accepted('hierbas-y-especias','pimienta gorda','Pimienta de Jamaica');
accepted('legumbres-secas','los garbanzos','Garbanzo');
accepted('legumbres-secas','poroto','Judía seca');
accepted('instrumentos-orquesta','corno francés','Trompa');
accepted('capitales-ue','Lisboa','Lisboa');
accepted('pokemon-kanto','charizrad','Charizard');
assert.equal(match('pokemon-kanto','Nidoran'),null,'Un nombre compartido no elige la especie al azar');
assert.equal(match('pixar','Toy Story 9'),null,'El número de una secuela no se corrige a otro');
assert.equal(match('pixar','Frozen'),null,'Se conserva la frontera Pixar/Disney');
assert.equal(match('mundial-femenino-2023','México'),null);
assert.equal(match('deportes-paris','Béisbol'),null);
assert.equal(match('legumbres-secas','cacahuate'),null);

const connections=bank.categories.filter(entry=>entry.connection);
assert.equal(connections.length,8);
for(const entry of connections){
  assert.deepEqual([...new Set(entry.answers.map(answer=>answer.points))].sort((a,b)=>a-b),[10,30,60,85,100],entry.id);
  assert.ok(entry.answers.filter(answer=>answer.points<=30).length>=5,`${entry.id}: hay varias entradas accesibles`);
}
accepted('territorios-misma-letra','Antartida','Antártida');
accepted('territorios-misma-letra','Arabia Saudita');
assert.equal(match('territorios-misma-letra','Arabia Saudí'),null,'La grafía introducida debe cumplir el patrón');
assert.equal(match('territorios-misma-letra','España'),null);
assert.equal(accepted('elementos-simbolo-una-letra','W','Wolframio').points,60);
accepted('elementos-simbolo-una-letra','tungsteno','Wolframio');
assert.equal(match('elementos-simbolo-una-letra','Hierro'),null,'El símbolo Fe tiene dos letras');
accepted('mundiales-catar-australia','La Albiceleste','Argentina');
assert.equal(accepted('mundiales-catar-australia','Costa Rica').points,100);
assert.equal(match('mundiales-catar-australia','México'),null,'Jugó solo el Mundial masculino');
assert.equal(match('mundiales-catar-australia','Colombia'),null,'Jugó solo el Mundial femenino');
accepted('pixar-oscar-animacion','Indomable','Valiente');
assert.equal(match('pixar-oscar-animacion','Shrek'),null,'Ganó el Óscar, pero es de otro estudio');
assert.equal(match('pixar-oscar-animacion','Toy Story 2'),null,'Se estrenó en Pixar, pero no ganó ese Óscar');
accepted('kanto-tipo-agua','Gyarados');
assert.equal(match('kanto-tipo-agua','Dragonite'),null,'Vivir cerca del agua no equivale al tipo Agua');
accepted('aves-con-emoji','cuervo','pájaro negro');
assert.equal(match('aves-con-emoji','ciervo'),null,'Un animal fuera del conjunto no es una errata de cuervo');
assert.equal(match('aves-con-emoji','fénix'),null,'El enunciado pide un ave real');
accepted('monedas-dolar-peso-franco','TWD','nuevo dólar taiwanés');
assert.equal(match('monedas-dolar-peso-franco','dólar'),null,'El nombre genérico no identifica una moneda');
assert.equal(match('monedas-dolar-peso-franco','euro'),null);
accepted('nobel-literatura-espanol','Asturias','Miguel Ángel Asturias');
assert.equal(match('nobel-literatura-espanol','Saramago'),null,'Fue laureado y escribió en portugués');
assert.equal(accepted('emoji-musica','arpa').points,30);
assert.equal(accepted('emoji-musica','tamboril').points,100);

const extremes=bank.categories.flatMap(c=>c.answers.filter(answer=>answer.million));
assert.equal(extremes.length,11,'El banco contiene once hallazgos de rareza extrema');
assert.equal(accepted('disney-animacion','Make Mine Music','Música maestro').million,true);
assert.equal(accepted('constelaciones','Reticulum','Retículo').million,true);
assert.equal(accepted('constelaciones','Mensa','Mesa').million,undefined);

const twins={id:'ambiguas',answers:[{name:'Martes',aliases:[],points:10},{name:'Martas',aliases:[],points:100}]};
assert.equal(ascensionAnswer(twins,'Martis').answer,null,'Una errata equidistante se rechaza, también con puntuaciones distintas');
assert.equal(ascensionAnswer(twins,'Martes').answer.points,10,'La coincidencia exacta tiene prioridad');

for(const entry of bank.categories){
  assert.ok(entry.audience);
  if(entry.audience==='familiar')assert.ok(entry.answers.filter(answer=>answer.points<=30).length>=5,entry.id);
}
const seen=new Set();
for(let day=0;day<120;day++){
  const date=new Date(Date.UTC(2026,10,19+day)).toISOString().slice(0,10);
  const edition=ascensionEdition(date,bank),practice=ascensionEdition(date,bank,1);
  if(day===0)assert.deepEqual(edition,ascensionEdition(date,bank),'La edición es reproducible');
  for(const rounds of [edition,practice]){
    assert.equal(rounds.length,ASCENSION_ROUNDS);
    assert.equal(new Set(rounds.map(entry=>entry.theme)).size,7,'Siete temas diferentes');
    assert.ok(rounds.filter(entry=>['ciencia','cuerpo','espacio','naturaleza'].includes(entry.theme)).length<=2,'Se limita la concentración de preguntas de ciencia');
    assert.deepEqual(rounds.map(entry=>entry.audience),['familiar','familiar','discovery','familiar','discovery','challenge','familiar']);
    assert.ok(rounds.some(entry=>entry.connection),'Cada partida cruza al menos dos ideas en uno de los descubrimientos');
    assert.ok(rounds.some(entry=>entry.answers.some(answer=>answer.million)),'Cada edición diaria y práctica ofrece un hallazgo extremo');
    for(const entry of rounds)seen.add(entry.id);
  }
  assert.ok(!practice.some(entry=>edition.some(other=>entry.id===other.id)),'La primera práctica no repite la diaria');
}
assert.equal(seen.size,bank.categories.length,'Se aprovecha todo el banco a lo largo de la rotación');
assert.ok(fs.readFileSync(new URL('../research/licenses/unicode-license.txt',import.meta.url),'utf8').includes('UNICODE LICENSE V3'),'La atribución de datos tiene su licencia completa');
console.log(`Ascensión banco: OK (${bank.categories.length} categorías, ${total} respuestas; fuentes, aliases, cobertura y cima)`);
