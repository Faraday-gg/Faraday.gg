// Prueba la función de Vercel (api/index.mjs) con el almacén de Supabase contra una API REST simulada en memoria.
// No usa red ni credenciales reales. Aplica las reescrituras de vercel.json como lo haría Vercel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const KEY='sb_secret_prueba',SITE='https://casi.test';
const daysDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-vercel-'));fs.rmSync(daysDirectory,{recursive:true});

// PostgREST mínimo: filtro in, orden, limit/offset (máximo 1000 filas) e inserción que ignora duplicados.
function fakeSupabase(){
  const tables={answers:new Map(),answers_preview:new Map()},calls=[];
  async function fetch(input,init={}){
    const url=new URL(input),headers=new Headers(init.headers);calls.push({url,method:init.method||'GET',headers});
    if(headers.get('apikey')!==KEY||headers.has('authorization'))return new Response('{"message":"Invalid API key"}',{status:401});
    const table=tables[url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1]];if(!table)return new Response('{}',{status:404});
    if(init.method==='POST'){
      assert.equal(url.searchParams.get('on_conflict'),'question_id,player_hash');assert.match(headers.get('prefer'),/resolution=ignore-duplicates/);
      const row=JSON.parse(init.body),k=row.question_id+'|'+row.player_hash;if(!table.has(k))table.set(k,row);return new Response(null,{status:201});
    }
    const ids=JSON.parse('['+url.searchParams.get('question_id').replace(/^in\.\(|\)$/g,'')+']');
    const limit=Math.min(Number(url.searchParams.get('limit')||1000),1000),offset=Number(url.searchParams.get('offset')||0);
    const rows=[...table.values()].filter(r=>ids.includes(r.question_id)).sort((a,b)=>(a.question_id+a.player_hash).localeCompare(b.question_id+b.player_hash));
    return Response.json(rows.slice(offset,offset+limit));
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
Object.assign(process.env,{SUPABASE_URL:'https://proyecto.supabase.co/',SUPABASE_SECRET_KEY:KEY,ANSWERS_TABLE:'answers_preview',DAYS_DIRECTORY:daysDirectory});
const realFetch=globalThis.fetch;globalThis.fetch=supabase.fetch;
const {default:handler}=await import('../api/index.mjs');
globalThis.fetch=realFetch;

async function call(target,{method='GET',body,origin=SITE}={}){
  const url=rewrite(target);assert.equal(url.pathname,'/api',`vercel.json debe llevar ${target} a la función`);
  const headers={host:'casi.test','x-forwarded-host':'casi.test'};if(origin)headers.origin=origin;if(body!==undefined)headers['content-type']='application/json';
  const response=await handler.fetch(new Request(url,{method,headers,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}));
  const text=await response.text();return {status:response.status,type:response.headers.get('content-type'),text,data:/json/.test(response.headers.get('content-type'))?JSON.parse(text):undefined};
}
const post=(player,guess,question='piloto-v2-1')=>call('/api/answers',{method:'POST',body:{player,guess,question}});
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
  await post(first,60000,'piloto-v2-2');await post(first,4700,'piloto-v2-3');
  assert.equal((await daily(first)).data.count,0);
  const third=randomUUID();await post(third,150000);await post(third,90000,'piloto-v2-2');await post(third,8000,'piloto-v2-3');
  const result=await daily(first);assert.equal(result.status,200);assert.equal(result.data.count,1);
  assert(Math.abs(result.data.own-((129166.66666666667/100000)+(60000/(419725/7))+(4700/(349.3*776.6/7.6**2)))/3)<.000001);
  const tomorrow=(await call('/api/day?date=2026-11-16')).data;
  assert.equal((await post(randomUUID(),100,tomorrow.questions[0].id)).status,200,'Las preguntas del banco se aceptan sin estado previo');

  // Seguridad y errores.
  assert.equal((await call('/api/answers',{method:'POST',body:{player:first,guess:1,question:'piloto-v2-1'},origin:'https://otro.test'})).status,403);
  assert.equal((await call('/api/answers',{method:'POST',body:'x'.repeat(3000)})).status,413);
  assert.equal((await call('/api/answers',{method:'POST',body:'{no'})).status,400);
  assert.equal((await call('/api/answers')).status,405);
  assert.equal((await call('/api/no-existe')).status,404);

  // Datos en la tabla indicada por ANSWERS_TABLE, con el jugador anonimizado, y la clave solo en apikey.
  assert.equal(supabase.tables.answers.size,0);assert.equal(supabase.tables.answers_preview.size,8,'3 + 1 + 3 + 1 respuestas válidas');
  assert([...supabase.tables.answers_preview.values()].every(row=>/^[0-9a-f]{64}$/.test(row.player_hash)&&row.player_hash!==first));
  assert(supabase.calls.every(c=>c.url.origin==='https://proyecto.supabase.co'&&c.headers.get('apikey')===KEY&&!c.headers.has('authorization')));
  assert(!fs.existsSync(daysDirectory),'En Vercel no se escriben jornadas en disco');

  // Paginación: PostgREST devuelve como máximo 1000 filas por petición.
  const {supabaseStore}=await import('../lib/stores.mjs');
  const big=fakeSupabase(),store=supabaseStore({url:'https://proyecto.supabase.co',key:KEY,fetch:big.fetch});
  for(let i=0;i<2500;i++)await store.add('q',String(i).padStart(64,'0'),i+1);
  assert.equal(Object.keys((await store.read(['q'])).q).length,2500);

  // Sin variables de entorno: el calendario funciona y las respuestas fallan de forma controlada.
  const {createApi}=await import('../lib/api.mjs');
  const bare=createApi({persistDays:false,store:supabaseStore({}),log:()=>{}});
  assert.equal((await bare.handle(new Request(SITE+'/api?route=calendar'))).status,200);
  const missing=await bare.handle(new Request(SITE+'/api?route=answers',{method:'POST',headers:{host:'casi.test'},body:JSON.stringify({player:first,guess:5,question:'piloto-v2-1'})}));
  assert.equal(missing.status,500);assert.equal((await missing.json()).error,'No se pudo procesar la solicitud');

  // Configuración de Vercel coherente con el repositorio y con el frontend.
  assert.equal(config.outputDirectory,'dist');assert(fs.existsSync('dist/index.html'));assert.deepEqual(config.regions,['fra1']);
  for(const route of new Set(fs.readFileSync('dist/community.js','utf8').match(/\/api\/[a-z-]+/g)))assert.equal(rewrite(route).pathname,'/api',route);
  assert.match(fs.readFileSync('dist/index.html','utf8'),/daily-content\.js/);

  console.log('OK: función de Vercel, reescrituras, Supabase simulado (tabla, clave, anonimato, paginación), seguridad y errores.');
}finally{fs.rmSync(daysDirectory,{recursive:true,force:true})}
