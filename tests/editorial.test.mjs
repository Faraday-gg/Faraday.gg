import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getDay,madridDate} from '../content-engine.mjs';
const baseline=JSON.parse(fs.readFileSync('dist/questions.json','utf8')).flatMap(d=>d.questions);
assert.equal(baseline.length,21);assert(baseline.every(q=>q.image&&fs.existsSync('dist/'+q.image.src)&&q.reasoning?.steps.length===3&&q.referenceExpression));
const ids=new Set(),titles=new Set();
for(let i=0;i<29;i++){
 const date=new Date(Date.UTC(2026,10,16+i,12)).toISOString().slice(0,10),day=getDay(date,{persist:false});
 assert.equal(day.questions.length,3);assert.equal(new Set(day.questions.map(q=>q.family)).size,3);
 assert.deepEqual(day,getDay(date,{persist:false}),'La edición de una fecha es estable');
 for(const q of day.questions){assert(!ids.has(q.id));assert(!titles.has(q.title));assert(q.sources.length&&q.reasoning.steps.length&&Number.isFinite(q.answer)&&q.answer>0);ids.add(q.id);titles.add(q.title)}
}
assert.equal(getDay('2026-12-15',{persist:false}),null,'No repetir contenido al agotarse el banco');
assert.equal(getDay('2026-99-99',{persist:false}),null);
assert.equal(madridDate(new Date('2026-11-09T23:00:00Z')),'2026-11-10');
console.log('OK: 21 fotos y razonamientos; 29 ediciones nuevas, 87 preguntas distintas; estabilidad y medianoche de Madrid.');
