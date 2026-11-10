// Prueba la generación automática de jornadas (lib/generar.mjs), la ruta /api/generar-dia (lib/api.mjs)
// y los métodos de Supabase que usa (lib/stores.mjs), con OpenAI y Supabase simulados. No usa red ni claves reales.
import assert from 'node:assert/strict';
import {generateDay,evaluate,validate,wantsCurrent,addDays,SOURCE} from '../lib/generar.mjs';
import {createApi} from '../lib/api.mjs';
import {supabaseStore} from '../lib/stores.mjs';

// 1. La cuenta de referencia se evalúa sin eval.
assert.equal(evaluate('13670000 × 60000 ÷ 7'),13670000*60000/7);
assert.equal(evaluate('7000 × 0,75 × 365 × 80 ÷ 1000 ÷ 7000'),21.9);
assert.equal(evaluate('(1 + 2) × 3 − 2^3'),1);
assert(Number.isNaN(evaluate('process.exit()')));assert(Number.isNaN(evaluate('2 ×')));

const question=(category,actualidad=false,expression='100 ÷ 4',answer=25)=>({category,tag:'Etiqueta',title:`¿Cuántas cosas de ${category}?`,detail:'Condiciones y una broma.',unit:'cosas',answer,math:'100 ÷ 4 = 25.',referenceExpression:expression,assumptions:'Supuestos.',confidence:'Dato documentado + cálculo',sources:[{title:'Fuente · Página',url:`https://fuente.test/${category}`,fact:'Dato.'}],reasoning:{heading:'Paso a paso',steps:['a','b','c']},actualidad});
const jornada=(current,overrides={})=>({theme:'Tema del día',questions:[question('comida',current),question('espacio'),question('deportes')],...overrides});

// OpenAI simulado: devuelve las respuestas de la cola en orden y guarda las peticiones. Las URL de las fuentes responden 200 salvo las /rota.
function fakeOpenAI(queue){
  const requests=[];
  async function fetch(url,init={}){
    if(url!=='https://api.openai.com/v1/responses')return new Response('',{status:/\/rota/.test(url)?404:200});
    assert.equal(new Headers(init.headers).get('authorization'),'Bearer sk-prueba');
    const body=JSON.parse(init.body);requests.push(body);
    assert.deepEqual(body.tools,[{type:'web_search'}]);assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);
    const next=queue.shift();if(!next)throw Error('Sin más respuestas simuladas');
    return Response.json({status:'completed',output:[{type:'web_search_call'},{type:'message',content:[{type:'output_text',text:JSON.stringify(next)}]}]});
  }
  return {fetch,requests};
}
// Almacén simulado con la interfaz de supabaseStore que usa la generación.
function fakeStore(initial={}){
  const days=new Map(Object.entries(initial)),saved=[];
  return {
    days:async(from,to)=>[...days.values()].filter(d=>d.id>=from&&d.id<=to&&d.questions),
    dayInfo:async date=>days.has(date)?days.get(date).info:null,
    async saveGeneratedDay(day,source){saved.push({day,source});days.set(day.id,{...day,info:{source,questions:3,answered:false}})},
    saved
  };
}
const quiet=()=>{},now=new Date('2026-12-19T23:01:00Z');
const even='2026-12-20',odd=addDays(even,1);assert.equal(wantsCurrent(even),!wantsCurrent(odd));
const currentDate=wantsCurrent(even)?even:odd,calmDate=currentDate===even?odd:even;

// 2. Genera, valida y guarda la jornada con ids ia-<fecha>-<posición>; las preguntas recientes van en el prompt.
let ai=fakeOpenAI([jornada(true)]),store=fakeStore({'2026-12-01':{id:'2026-12-01',questions:[{title:'¿Pregunta reciente?'}],info:{source:SOURCE,questions:3}}});
let result=await generateDay({date:currentDate,store,apiKey:'sk-prueba',fetch:ai.fetch,now,log:quiet});
assert.equal(result.status,'creada');assert.equal(store.saved.length,1);assert.equal(store.saved[0].source,'ia');
const day=store.saved[0].day;
assert.deepEqual(day.questions.map(q=>q.id),[1,2,3].map(i=>`ia-${currentDate}-${i}`));
assert.match(day.name,/^[A-ZÁÉÍÓÚ]/);assert.equal(day.questions[0].verifiedAt,'2026-12-20');assert.equal(day.questions[0].generated.by,'openai');
assert.match(ai.requests[0].input[1].content,/Pregunta reciente/);assert.match(ai.requests[0].input[1].content,/debe ser de actualidad/);

// 3. Si ya existe, no hace nada (pg_cron y Vercel pueden llamar varias veces).
result=await generateDay({date:currentDate,store,apiKey:'sk-prueba',fetch:ai.fetch,now,log:quiet});
assert.deepEqual([result.status,result.reason],['omitida','ya estaba generada']);assert.equal(ai.requests.length,1);

// 4. No toca jornadas escritas a mano ni del banco que ya tengan respuestas.
assert.equal((await generateDay({date:'2026-11-12',store:fakeStore(),apiKey:'sk-prueba',fetch:ai.fetch,log:quiet})).reason,'jornada escrita a mano');
assert.equal((await generateDay({date:'2026-12-14',store:fakeStore({'2026-12-14':{id:'2026-12-14',info:{source:'banco-editorial',questions:3,answered:true}}}),apiKey:'sk-prueba',fetch:ai.fetch,log:quiet})).reason,'la jornada ya tiene respuestas');

// 5. Un intento no válido se reintenta explicando el error; la jornada del banco sin respuestas se sustituye.
const bad=jornada(false,{questions:[question('comida',false,'100 ÷ 5'),question('espacio'),question('deportes')]});
ai=fakeOpenAI([bad,jornada(false)]);store=fakeStore({[calmDate]:{id:calmDate,info:{source:'banco-editorial',questions:3,answered:false}}});
result=await generateDay({date:calmDate,store,apiKey:'sk-prueba',fetch:ai.fetch,now,log:quiet});
assert.equal(result.status,'creada');assert.equal(ai.requests.length,2);assert.match(ai.requests[1].input[1].content,/no da answer/);
assert.match(ai.requests[0].input[1].content,/ninguna pregunta es de actualidad/);

// 6. Si sigue sin ser válida (actualidad que no toca, fuente rota), falla sin guardar.
ai=fakeOpenAI([jornada(true),jornada(true)]);store=fakeStore();
await assert.rejects(generateDay({date:calmDate,store,apiKey:'sk-prueba',fetch:ai.fetch,now,log:quiet}),/hoy no toca pregunta de actualidad/);assert.equal(store.saved.length,0);
const broken=jornada(false);broken.questions[1].sources[0].url='https://fuente.test/rota';
ai=fakeOpenAI([broken,broken]);
await assert.rejects(generateDay({date:calmDate,store,apiKey:'sk-prueba',fetch:ai.fetch,now,log:quiet}),/fuente que no existe: https:\/\/fuente\.test\/rota → 404/);
assert(validate(jornada(false,{questions:[question('comida'),question('comida'),question('deportes')]})).includes('categorías repetidas'));

// 7. Modo prueba: genera sin guardar y sin Supabase.
ai=fakeOpenAI([jornada(false)]);
result=await generateDay({date:calmDate,store:null,save:false,apiKey:'sk-prueba',fetch:ai.fetch,now,log:quiet});
assert.equal(result.status,'prueba');assert.equal(result.day.questions.length,3);

// 8. La ruta /api/generar-dia exige el secreto y genera la jornada de mañana.
const emptyStore={async read(){return {}},async add(){}},runs=[];
const api=createApi({store:emptyStore,persistDays:false,log:quiet,generator:{secret:'secreto-cron',async run(date){runs.push(date);return {status:'creada',day:{questions:[{title:'¿Una?'}]}}}}});
const call=(headers={},query='')=>api.handle(new Request('https://casi.test/api/generar-dia'+query,{headers}));
assert.equal((await call()).status,401);
assert.equal((await call({Authorization:'Bearer otro-secreto'})).status,401);
let response=await call({Authorization:'Bearer secreto-cron'});assert.equal(response.status,200);
const body=await response.json();assert.equal(body.status,'creada');assert.deepEqual(body.titles,['¿Una?']);
assert.equal(runs[0],addDays(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date()),1),'Por defecto, mañana en Madrid');
assert.equal((await call({Authorization:'Bearer secreto-cron'},'?date=2026-13-01')).status,400);
assert.equal((await createApi({store:emptyStore,persistDays:false,log:quiet}).handle(new Request('https://casi.test/api/generar-dia'))).status,503,'Sin configurar no hace nada');
const failing=createApi({store:emptyStore,persistDays:false,log:quiet,generator:{secret:'s',async run(){throw Error('OpenAI respondió 500')}}});
response=await failing.handle(new Request('https://casi.test/api/generar-dia',{headers:{Authorization:'Bearer s'}}));
assert.equal(response.status,502);assert.match((await response.json()).error,/OpenAI respondió 500/);

// 9. supabaseStore: dayInfo y saveGeneratedDay contra un PostgREST simulado (con la restricción days_source_check de la migración nueva).
const db={days:new Map([['2027-01-05',{id:'2027-01-05',name:'Martes',theme:'',source:'banco-editorial'}]]),questions:new Map([['daily-1',{id:'daily-1',day_id:'2027-01-05',position:1}]]),answers:[]};
async function rest(input,init={}){
  const url=new URL(input),table=url.pathname.split('/').pop(),method=init.method||'GET',p=url.searchParams;
  const ids=(p.get('id')||p.get('question_id')||'').replace(/^in\.\(|\)$/g,'').split(',').filter(s=>s.startsWith('"')).map(s=>JSON.parse(s));
  if(table==='days'&&method==='GET'){const row=db.days.get(p.get('id').replace('eq.',''));return Response.json(row?[{id:row.id,source:row.source,questions:[...db.questions.values()].filter(q=>q.day_id===row.id).map(q=>({id:q.id}))}]:[])}
  if(table==='answers')return Response.json(db.answers.filter(a=>ids.includes(a.question_id)).slice(0,1));
  if(table==='questions'&&method==='GET')return Response.json([...db.questions.values()].filter(q=>q.day_id===p.get('day_id').replace('eq.','')).map(q=>({id:q.id})));
  if(method==='DELETE'){if(db.answers.some(a=>ids.includes(a.question_id)))return new Response('{"code":"23503"}',{status:409});ids.forEach(id=>db.questions.delete(id));return new Response(null,{status:204})}
  assert.match(new Headers(init.headers).get('prefer'),/merge-duplicates/);
  for(const row of [].concat(JSON.parse(init.body))){
    if(table==='days'&&!['piloto','banco-editorial','ia'].includes(row.source))return new Response('{"code":"23514"}',{status:400});
    if(table==='questions'&&[...db.questions.values()].some(q=>q.id!==row.id&&q.day_id===row.day_id&&q.position===row.position))return new Response('{"code":"23505"}',{status:409});
    db[table].set(row.id,row);
  }
  return new Response(null,{status:201});
}
const sb=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:rest});
assert.deepEqual(await sb.dayInfo('2027-01-05'),{source:'banco-editorial',questions:1,answered:false});
assert.equal(await sb.dayInfo('2027-01-01'),null);
await sb.saveGeneratedDay(day,'ia');
assert.equal(db.days.get(currentDate).source,'ia');assert.equal(db.questions.size,4);
const replaceDay={...day,id:'2027-01-05',questions:day.questions.map((q,i)=>({...q,id:`ia-2027-01-05-${i+1}`}))};
await sb.saveGeneratedDay(replaceDay,'ia');
assert(!db.questions.has('daily-1'),'La pregunta del banco se retira');assert.equal(db.days.get('2027-01-05').source,'ia');
db.answers.push({question_id:'ia-2027-01-05-1'});assert.equal((await sb.dayInfo('2027-01-05')).answered,true);

console.log('OK: generación de jornadas con OpenAI (validación, reintento, idempotencia, jornadas protegidas, actualidad), ruta /api/generar-dia y almacén de Supabase.');
