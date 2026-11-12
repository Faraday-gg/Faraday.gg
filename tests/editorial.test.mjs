import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getDay,madridDate} from '../content-engine.mjs';
const baseline=JSON.parse(fs.readFileSync('content/banco-base.json','utf8'));
assert.equal(baseline.length,21);assert(baseline.every(q=>q.image&&fs.existsSync('dist/'+q.image.src)&&q.reasoning?.steps.length===3&&q.referenceExpression));
// Cuenta por pasos (decisión 0029): las preguntas del piloto la traen escrita a mano.
for(const day of JSON.parse(fs.readFileSync('dist/questions.json','utf8')))for(const q of day.questions)assert(q.calc?.intro&&q.calc.result&&q.calc.rows.length>=2,`${q.id}: falta calc`);
const ids=new Set(),titles=new Set();
for(let i=0;i<29;i++){
 const date=new Date(Date.UTC(2026,10,16+i,12)).toISOString().slice(0,10),day=getDay(date,{persist:false});
 assert.equal(day.questions.length,3);assert.equal(new Set(day.questions.map(q=>q.family)).size,3);
 assert.deepEqual(day,getDay(date,{persist:false}),'La edición de una fecha es estable');
 for(const q of day.questions){assert(!ids.has(q.id));assert(!titles.has(q.title));assert(q.sources.length&&q.reasoning.steps.length&&Number.isFinite(q.answer)&&q.answer>0);assert(q.calc?.intro&&q.calc.result&&q.calc.rows.length>=2&&q.calc.rows.every(r=>r.label&&r.value),'Cuenta por pasos del banco');ids.add(q.id);titles.add(q.title)}
}
assert.equal(getDay('2026-12-15',{persist:false}),null,'No repetir contenido al agotarse el banco');
assert.equal(getDay('2026-99-99',{persist:false}),null);
assert.equal(madridDate(new Date('2026-11-09T23:00:00Z')),'2026-11-10');
console.log('OK: 21 fotos y razonamientos; 29 ediciones nuevas, 87 preguntas distintas; estabilidad y medianoche de Madrid.');

// Categorías y archivo editorial (content/archivo/AAAA-MM-DD.json).
{
  const {archive,editorialDays,FIRST_DAY}=await import('../content-engine.mjs');
  const source=fs.readFileSync('dist/categories.js','utf8'),categories=new Set([...source.matchAll(/^  (\w+):\{label:/gm)].map(m=>m[1]));
  assert(categories.size>=10,'Hay categorías definidas en dist/categories.js');
  const seen=new Set(),titles=new Set();
  for(const day of editorialDays){
    assert.equal(day.questions.length,3,`${day.id}: tres preguntas`);
    assert.equal(new Set(day.questions.map(q=>q.category)).size,3,`${day.id}: tres categorías distintas`);
    assert.equal(day.name,new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'Europe/Madrid'}).format(new Date(day.id+'T12:00:00Z')).replace(/^./,c=>c.toUpperCase()),`${day.id}: nombre del día`);
    for(const q of day.questions){
      assert(categories.has(q.category),`${q.id}: categoría válida (${q.category})`);
      assert(!seen.has(q.id)&&!titles.has(q.title),`${q.id}: id y título únicos`);seen.add(q.id);titles.add(q.title);
      assert(Number.isFinite(q.answer)&&q.answer>0,`${q.id}: cifra positiva`);
      assert(q.title&&q.unit&&q.tag&&q.math&&q.assumptions&&q.confidence&&q.referenceExpression,`${q.id}: campos editoriales`);
      assert(q.sources.length&&q.sources.every(s=>/^https:\/\//.test(s.url)&&s.title&&s.fact),`${q.id}: fuentes con enlace`);
      assert.equal(q.reasoning?.steps?.length,3,`${q.id}: razonamiento en tres pasos`);
      if(q.image)assert(fs.existsSync('dist/'+q.image.src)&&q.image.alt&&q.image.credit&&q.image.license&&/^https:\/\//.test(q.image.url),`${q.id}: foto con atribución`);
    }
  }
  // Solo llevan foto las preguntas en las que ayuda a imaginar la escala.
  const all=editorialDays.flatMap(d=>d.questions),photos=all.filter(q=>q.image).length/all.length;
  assert(photos>=.15&&photos<=.20,`Entre el 15 y el 20 % de las preguntas escritas a mano llevan foto (ahora, ${Math.round(photos*100)} %)`);
  for(const day of archive){assert(day.id<'2026-11-09',`${day.id}: el archivo va antes del piloto`);assert(fs.existsSync(`content/archivo/${day.id}.json`))}
  for(let i=1;i<editorialDays.length;i++)assert.equal(Date.parse(editorialDays[i].id)-Date.parse(editorialDays[i-1].id),86400000,'Jornadas editoriales consecutivas');
  console.log(`OK: ${editorialDays.length} jornadas editoriales desde ${FIRST_DAY} (${archive.length} de archivo), con categoría válida; ${Math.round(photos*100)} % con foto.`);
}
