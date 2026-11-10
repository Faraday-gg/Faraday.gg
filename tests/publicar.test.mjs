// Prueba la publicación incremental del contenido (lib/publicar.mjs y scripts/publicar-contenido.mjs)
// contra una API de Supabase simulada en memoria (REST + Storage). No usa red ni credenciales reales.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {publish,buildContent,BUCKET} from '../lib/publicar.mjs';

const URL_BASE='https://proyecto.supabase.co',KEY='sb_secret_prueba';
function fakeSupabase(){
  const days=new Map(),questions=new Map(),objects=new Map(),answered=new Set(),calls=[];
  async function fetch(input,init={}){
    const url=new URL(input),method=init.method||'GET',headers=new Headers(init.headers);calls.push({method,path:url.pathname});
    if(headers.get('apikey')!==KEY)return new Response('{}',{status:401});
    if(url.pathname===`/storage/v1/object/list/${BUCKET}`)return Response.json([...objects].map(([name,data])=>({name,metadata:{eTag:`"${createHash('md5').update(data).digest('hex')}"`,size:data.length}})));
    if(url.pathname.startsWith(`/storage/v1/object/${BUCKET}/`)){assert.equal(headers.get('x-upsert'),'true');objects.set(decodeURIComponent(url.pathname.split('/').pop()),Buffer.from(init.body));return new Response('{}',{status:200})}
    const table={days,questions}[url.pathname.replace('/rest/v1/','')];if(!table)return new Response('{}',{status:404});
    if(method==='GET'){const offset=Number(url.searchParams.get('offset')),limit=Number(url.searchParams.get('limit'));return Response.json(structuredClone([...table.values()].sort((a,b)=>a.id<b.id?-1:1).slice(offset,offset+limit)))}
    if(method==='DELETE'){const id=url.searchParams.get('id').replace(/^eq\./,'');if(answered.has(id))return new Response('{"code":"23503"}',{status:409});table.delete(id);return new Response(null,{status:204})}
    assert.match(headers.get('prefer'),/resolution=merge-duplicates/);
    for(const row of JSON.parse(init.body)){
      if(table===questions){assert(days.has(row.day_id),'La jornada existe antes que sus preguntas');for(const q of questions.values())if(q.id!==row.id&&q.day_id===row.day_id&&q.position===row.position)return new Response('{"code":"23505"}',{status:409})}
      // Como Postgres: jsonb no conserva el orden de las claves.
      table.set(row.id,JSON.parse(JSON.stringify(row,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?1:-1)):v)));
    }
    return new Response(null,{status:201});
  }
  return {fetch,days,questions,objects,answered,calls};
}
const quiet=()=>{};
const sb=fakeSupabase(),run=(options={})=>publish({url:URL_BASE+'/',key:KEY,fetch:sb.fetch,log:quiet,...options});
const content=buildContent(URL_BASE);

// 1. Primera publicación: todo.
let result=await run();
// Archivo (92 jornadas) + piloto (7) + banco editorial (29). Fotos distintas: las del archivo y el piloto (solo el 15–20 % lleva) y las del banco.
assert.deepEqual(result,{images:60,days:128,questions:384,replaced:[]});
assert.equal(sb.questions.size,384);assert.equal(sb.objects.size,60);
assert([...sb.questions.values()].every(q=>!q.content.image||q.content.image.src.startsWith(`${URL_BASE}/storage/v1/object/public/${BUCKET}/`)),'Las imágenes (cuando la pregunta lleva) apuntan a Storage');
assert.equal(sb.days.get('2026-11-09').source,'piloto');assert.equal(sb.days.get('2026-12-14').source,'banco-editorial');

// 2. Sin cambios: no escribe nada (aunque Postgres haya reordenado las claves de jsonb).
sb.calls.length=0;result=await run();
assert.deepEqual(result,{images:0,days:0,questions:0,replaced:[]});
assert(sb.calls.every(c=>c.method==='GET'||c.path.startsWith('/storage/v1/object/list/')),'Solo lecturas');

// 3. Prueba en seco: cuenta, pero no escribe.
sb.questions.get('piloto-v2-2').title='editado a mano';sb.calls.length=0;
assert.equal((await run({dryRun:true})).questions,1);assert.equal(sb.questions.get('piloto-v2-2').title,'editado a mano');

// 4. Lo que cambia se vuelve a publicar: una pregunta y una imagen.
sb.objects.set('las-canteras.jpg',Buffer.from('otra imagen'));
result=await run();assert.equal(result.questions,1);assert.equal(result.images,1);
assert.notEqual(sb.questions.get('piloto-v2-2').title,'editado a mano');

// 5. Una pregunta antigua en la misma fecha y posición se retira si no tiene respuestas…
const slot=content.questions[5],old={...structuredClone(sb.questions.get(slot.id)),id:'pregunta-antigua'};
sb.questions.delete(slot.id);sb.questions.set(old.id,old);
result=await run();assert.deepEqual(result.replaced,['pregunta-antigua']);
assert(!sb.questions.has('pregunta-antigua')&&sb.questions.has(slot.id));

// 6. …y si tiene respuestas, la publicación falla sin tocarla.
sb.questions.delete(slot.id);sb.questions.set(old.id,old);sb.answered.add(old.id);
await assert.rejects(run(),/ya tiene respuestas/);assert(sb.questions.has('pregunta-antigua'));

// 7. En Vercel solo publica en producción, y sin claves no bloquea el despliegue.
const script=env=>spawnSync(process.execPath,['scripts/publicar-contenido.mjs','--vercel'],{env:{PATH:process.env.PATH,...env},encoding:'utf8'});
let r=script({VERCEL_ENV:'preview',SUPABASE_URL:'http://127.0.0.1:9',SUPABASE_SECRET_KEY:KEY});assert.equal(r.status,0);assert.match(r.stdout,/solo se publica en producción/);
r=script({VERCEL_ENV:'production'});assert.equal(r.status,0);assert.match(r.stderr,/faltan SUPABASE_URL o SUPABASE_SECRET_KEY/);
r=script({VERCEL_ENV:'production',SUPABASE_URL:'http://127.0.0.1:9',SUPABASE_SECRET_KEY:KEY});assert.equal(r.status,1,'Si Supabase falla en producción, el despliegue falla');

console.log('OK: publicación incremental (primera carga, sin cambios, prueba en seco, cambios, sustitución segura) y build de Vercel solo en producción.');
