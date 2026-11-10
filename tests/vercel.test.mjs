// Prueba la función de Vercel (api/index.mjs) con el almacén de Supabase contra una API REST simulada en memoria.
// No usa red ni credenciales reales. Aplica las reescrituras de vercel.json como lo haría Vercel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const KEY='sb_secret_prueba',SITE='https://casi.test';
const daysDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-vercel-'));fs.rmSync(daysDirectory,{recursive:true});

// PostgREST mínimo con el esquema de supabase/migrations/20261109213854_esquema_inicial.sql:
// days ──< questions ──< answers, con sus claves foráneas, únicas y comprobaciones.
// Filtro in, orden, limit/offset (máximo 1000 filas) e inserción que ignora duplicados.
// Como la API real, devuelve los double redondeados a 15 cifras significativas.
function fakeSupabase(){
  const tables={days:new Map(),questions:new Map(),answers:new Map()},calls=[];
  const conflictKeys={days:'id',questions:'id',answers:'question_id,player_hash'};
  const keyOf=(table,row)=>conflictKeys[table].split(',').map(k=>row[k]).join('|');
  const reject=(code,message)=>new Response(JSON.stringify({code,message}),{status:409});
  function violation(table,row){
    if(table==='days'&&!(/^\d{4}-\d{2}-\d{2}$/.test(row.id)&&row.name&&['piloto','banco-editorial'].includes(row.source)&&typeof row.theme==='string'))return reject('23514','days check');
    if(table==='questions'){
      if(!tables.days.has(row.day_id))return reject('23503','questions.day_id → days');
      if(!(row.position>=1&&row.position<=3&&row.title&&row.unit&&row.answer>0&&row.content&&typeof row.content==='object'&&Number.isInteger(row.revision)))return reject('23514','questions check');
      if([...tables.questions.values()].some(q=>q.day_id===row.day_id&&q.position===row.position&&q.id!==row.id))return reject('23505','unique (day_id, position)');
    }
    if(table==='answers'){
      if(!tables.questions.has(row.question_id))return reject('23503','answers.question_id → questions');
      if(!(/^[0-9a-f]{64}$/.test(row.player_hash)&&row.guess>0&&row.guess<=1e30))return reject('23514','answers check');
    }
  }
  async function fetch(input,init={}){
    const url=new URL(input),headers=new Headers(init.headers);calls.push({url,method:init.method||'GET',headers});
    if(headers.get('apikey')!==KEY||headers.has('authorization'))return new Response('{"message":"Invalid API key"}',{status:401});
    const name=url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1],table=tables[name];if(!table)return new Response('{}',{status:404});
    if(init.method==='POST'){
      assert.equal(url.searchParams.get('on_conflict'),conflictKeys[name]);assert.match(headers.get('prefer'),/resolution=ignore-duplicates/);
      const rows=[].concat(JSON.parse(init.body));
      for(const row of rows){if(table.has(keyOf(name,row)))continue;const error=violation(name,row);if(error)return error}
      for(const row of rows)if(!table.has(keyOf(name,row)))table.set(keyOf(name,row),row);
      return new Response(null,{status:201});
    }
    if(name==='days'){
      let rows=[...table.values()];
      for(const filter of url.searchParams.getAll('id')){const [op,value]=filter.split(/\.(.*)/);rows=rows.filter(r=>op==='gte'?r.id>=value:op==='lte'?r.id<=value:r.id===value)}
      rows.sort((a,b)=>a.id<b.id?-1:1);if(url.searchParams.get('order')==='id.desc')rows.reverse();
      if(url.searchParams.has('limit'))rows=rows.slice(0,Number(url.searchParams.get('limit')));
      const embed=/questions\(/.test(url.searchParams.get('select')||'');
      return Response.json(rows.map(d=>embed?{id:d.id,name:d.name,theme:d.theme,questions:[...tables.questions.values()].filter(q=>q.day_id===d.id).map(({id,position,content})=>({id,position,content}))}:{id:d.id}));
    }
    if(name==='questions'){const q=tables.questions.get((url.searchParams.get('id')||'').replace(/^eq\./,''));return Response.json(q?[{day_id:q.day_id}]:[])}
    const ids=JSON.parse('['+url.searchParams.get('question_id').replace(/^in\.\(|\)$/g,'')+']');
    const limit=Math.min(Number(url.searchParams.get('limit')||1000),1000),offset=Number(url.searchParams.get('offset')||0);
    const rows=[...table.values()].filter(r=>ids.includes(r.question_id)).sort((a,b)=>(a.question_id+a.player_hash).localeCompare(b.question_id+b.player_hash));
    return Response.json(rows.slice(offset,offset+limit).map(({question_id,player_hash,guess})=>({question_id,player_hash,guess:Number(guess.toPrecision(15))})));
  }
  return {fetch,tables,calls};
}

// Reescrituras de vercel.json: source con :param → destination, conservando la query original.
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
function rewrite(target){
  const url=new URL(target,SITE);
  for(const {source,destination} of config.rewrites){
    const names=[],pattern=new RegExp('^'+source.replace(/[.]/g,'\\.').replace(/:([a-z]+)/g,(_,name)=>{names.push(name);return '([^/]+)'})+'$');
    const match=url.pathname.match(pattern);if(!match)continue;
    const next=new URL(names.reduce((d,name,i)=>d.replace(':'+name,match[i+1]),destination),SITE);
    for(const [k,v] of url.searchParams)next.searchParams.set(k,v);return next;
  }
  return url;
}

const supabase=fakeSupabase();
Object.assign(process.env,{SUPABASE_URL:'https://proyecto.supabase.co/',SUPABASE_SECRET_KEY:KEY,DAYS_DIRECTORY:daysDirectory});
const realFetch=globalThis.fetch;globalThis.fetch=supabase.fetch;
const {default:handler}=await import('../api/index.mjs');
globalThis.fetch=realFetch;

async function call(target,{method='GET',body,origin=SITE}={}){
  const url=rewrite(target);assert.equal(url.pathname,'/api',`vercel.json debe llevar ${target} a la función`);
  const headers={host:'casi.test','x-forwarded-host':'casi.test'};if(origin)headers.origin=origin;if(body!==undefined)headers['content-type']='application/json';
  const response=await handler.fetch(new Request(url,{method,headers,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}));
  const text=await response.text();return {status:response.status,type:response.headers.get('content-type'),text,data:/json/.test(response.headers.get('content-type'))?JSON.parse(text):undefined};
}
const post=(player,guess,question='piloto-v3-2026-11-09-1')=>call('/api/answers',{method:'POST',body:{player,guess,question}});
const daily=player=>call('/api/daily-scores',{method:'POST',body:{date:'2026-11-09',player}});

try{
  // Contenido diario a través de las reescrituras.
  const script=await call('/daily-content.js');assert.equal(script.status,200);assert.match(script.type,/javascript/);assert.match(script.text,/^window\.DAILY_CALENDAR = /);
  const cal=await call('/api/calendar');assert.equal(cal.status,200);assert(cal.data.days.length>=7);
  assert.equal((await call('/api/day?date=2026-11-09')).data.questions.length,3);
  assert.equal((await call('/api/day?date=2026-99-99')).status,404);

  // Mismo escenario que tests/community.test.mjs, ahora contra Supabase.
  const first=randomUUID(),second=randomUUID();
  let r=await post(first,100000);assert.equal(r.status,200);assert.equal(r.data.count,0);
  r=await post(second,200000);assert.equal(r.data.count,1);assert.equal(r.data.bins.reduce((a,b)=>a+b,0),1);
  r=await post(second,200000);assert.equal(r.data.count,1,'Una respuesta repetida no duplica la muestra');
  assert.equal((await post(second,300000)).status,409,'No se puede cambiar una respuesta');
  assert.equal((await post(first,-1)).status,400);
  assert.equal((await post(first,100,'desconocida')).status,400);
  assert.equal((await daily(first)).status,409,'Un día incompleto no participa');
  await post(first,60000,'piloto-v2-2');await post(first,4700,'piloto-v3-2026-11-09-3');
  assert.equal((await daily(first)).data.count,0);
  const third=randomUUID();await post(third,150000);await post(third,90000,'piloto-v2-2');await post(third,8000,'piloto-v3-2026-11-09-3');
  const result=await daily(first);assert.equal(result.status,200);assert.equal(result.data.count,1);
  assert(Math.abs(result.data.own-((100000/33333.333333333336)+(60000/59960.71428571428)+(6971.569498694553/4700))/3)<.000001);
  const tomorrow=(await call('/api/day?date=2026-11-16')).data;
  assert.equal((await post(randomUUID(),100,tomorrow.questions[0].id)).status,200,'Las preguntas del banco se aceptan sin estado previo');
  // Cifras con más de 15 cifras significativas (Supabase las devuelve redondeadas).
  const precise=randomUUID(),long=tomorrow.questions[1].answer*2;assert.notEqual(Number(long.toPrecision(15)),long);
  assert.equal((await post(precise,long,tomorrow.questions[1].id)).status,200);
  assert.equal((await post(precise,long,tomorrow.questions[1].id)).status,200,'Reenviar la misma cifra no es un conflicto');
  assert.equal((await post(precise,long*1.01,tomorrow.questions[1].id)).status,409,'Una cifra distinta sí lo es');

  // Seguridad y errores.
  assert.equal((await call('/api/answers',{method:'POST',body:{player:first,guess:1,question:'piloto-v3-2026-11-09-1'},origin:'https://otro.test'})).status,403);
  assert.equal((await call('/api/answers',{method:'POST',body:'x'.repeat(3000)})).status,413);
  assert.equal((await call('/api/answers',{method:'POST',body:'{no'})).status,400);
  assert.equal((await call('/api/answers')).status,405);
  assert.equal((await call('/api/no-existe')).status,404);

  // Respuestas guardadas con el jugador anonimizado; jornadas y preguntas publicadas una sola vez.
  assert.equal(supabase.tables.answers.size,9,'3 + 1 + 3 + 1 + 1 respuestas válidas');
  assert([...supabase.tables.answers.values()].every(row=>/^[0-9a-f]{64}$/.test(row.player_hash)&&row.player_hash!==first));
  assert.deepEqual([...supabase.tables.days.values()].map(d=>[d.id,d.source]),[['2026-11-09','piloto'],['2026-11-16','banco-editorial']]);
  assert.equal(supabase.tables.questions.size,6);
  const pilotQuestion=supabase.tables.questions.get('piloto-v3-2026-11-09-1');assert.equal(pilotQuestion.position,1);assert.equal(pilotQuestion.revision,1);assert.equal(pilotQuestion.content.id,'piloto-v3-2026-11-09-1');
  assert.equal(supabase.calls.filter(c=>c.method==='POST'&&c.url.pathname.endsWith('/days')).length,2,'Cada jornada se publica una vez por instancia');
  assert(supabase.calls.every(c=>c.url.origin==='https://proyecto.supabase.co'&&c.headers.get('apikey')===KEY&&!c.headers.has('authorization')));
  assert(!fs.existsSync(daysDirectory),'En Vercel no se escriben jornadas en disco');

  // El contenido publicado en Supabase manda sobre content-engine.mjs: título editado y pregunta que solo existe en la base de datos.
  const edited=structuredClone((await call('/api/day?date=2026-11-10')).data);
  edited.questions[0]={...edited.questions[0],title:'Título editado en Supabase'};
  edited.questions[1]={...edited.questions[1],id:'solo-en-supabase',answer:50};
  supabase.tables.days.set('2026-11-10',{id:'2026-11-10',name:edited.name,theme:'Tema desde Supabase',source:'piloto'});
  edited.questions.forEach((q,i)=>supabase.tables.questions.set(q.id,{id:q.id,day_id:'2026-11-10',position:i+1,revision:q.revision??1,title:q.title,unit:q.unit,answer:q.answer,content:q}));
  const fromDb=(await call('/api/day?date=2026-11-10')).data;
  assert.equal(fromDb.theme,'Tema desde Supabase');assert.equal(fromDb.questions[0].title,'Título editado en Supabase');assert.equal(fromDb.questions[1].id,'solo-en-supabase');
  const calendarDb=(await call('/api/calendar')).data;assert.equal(calendarDb.source,'supabase');
  assert.equal(calendarDb.days.find(d=>d.id==='2026-11-10').questions[0].title,'Título editado en Supabase','El calendario usa el contenido de Supabase');
  assert(calendarDb.days.some(d=>d.id==='2026-11-09'),'Los días no publicados siguen saliendo de content-engine');
  const dbOnly=await call('/api/answers',{method:'POST',body:{player:randomUUID(),guess:100,question:'solo-en-supabase'}});
  assert.equal(dbOnly.status,200,'Se aceptan respuestas a preguntas que solo existen en Supabase');

  // Paginación: PostgREST devuelve como máximo 1000 filas por petición.
  const {supabaseStore}=await import('../lib/stores.mjs');
  const big=fakeSupabase(),store=supabaseStore({url:'https://proyecto.supabase.co',key:KEY,fetch:big.fetch});
  for(let i=0;i<2500;i++){const row={question_id:'q',player_hash:String(i).padStart(64,'0'),guess:i+1};big.tables.answers.set('q|'+row.player_hash,row)}
  assert.equal(Object.keys((await store.read(['q'])).q).length,2500);

  // Sin variables de entorno: el calendario funciona y las respuestas fallan de forma controlada.
  const {createApi}=await import('../lib/api.mjs');
  const bare=createApi({persistDays:false,store:supabaseStore({}),log:()=>{}});
  assert.equal((await bare.handle(new Request(SITE+'/api?route=calendar'))).status,200);
  const missing=await bare.handle(new Request(SITE+'/api?route=answers',{method:'POST',headers:{host:'casi.test'},body:JSON.stringify({player:first,guess:5,question:'piloto-v3-2026-11-09-1'})}));
  assert.equal(missing.status,500);assert.equal((await missing.json()).error,'No se pudo procesar la solicitud');

  // Configuración de Vercel coherente con el repositorio y con el frontend.
  assert.equal(config.outputDirectory,'dist');assert(fs.existsSync('dist/index.html'));assert.deepEqual(config.regions,['fra1']);
  for(const route of new Set(fs.readFileSync('dist/community.js','utf8').match(/\/api\/[a-z-]+/g)))assert.equal(rewrite(route).pathname,'/api',route);
  assert.match(fs.readFileSync('dist/index.html','utf8'),/daily-content\.js/);

  console.log('OK: función de Vercel, reescrituras, esquema de Supabase simulado (publicación de jornadas, claves foráneas, anonimato, paginación), seguridad y errores.');
}finally{fs.rmSync(daysDirectory,{recursive:true,force:true})}
