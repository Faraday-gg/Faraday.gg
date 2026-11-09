// Publicación del contenido en Supabase: jornadas, preguntas e imágenes.
// Es incremental: compara con lo que ya hay y solo sube lo que ha cambiado.
//   - Imágenes de dist/assets → almacén público «imagenes» de Storage (compara el MD5 con el eTag).
//   - Jornadas (piloto + banco editorial) → «days»; sus preguntas → «questions», con image.src en Storage.
//   - Si una fecha y posición ya tenía otra pregunta, la retira solo si no tiene respuestas;
//     si las tiene, la base de datos lo impide y la publicación falla con un mensaje claro.
// Nunca borra jornadas ni respuestas. La usan scripts/publicar-contenido.mjs y el build de Vercel.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {calendar,getDay} from '../content-engine.mjs';

export const BUCKET='imagenes';
const types={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const root=new URL('..',import.meta.url);

// JSON con las claves ordenadas: Postgres (jsonb) no conserva el orden de las claves.
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}

// Todo el contenido del repositorio, ya con las imágenes apuntando a Storage.
export function buildContent(url){
  const pilot=JSON.parse(fs.readFileSync(new URL('dist/questions.json',root),'utf8')),pilotIds=new Set(pilot.map(day=>day.id));
  const last=calendar(pilot[0].id,{persist:false}).availableThrough,days=[],images=new Map();
  for(let t=Date.parse(pilot[0].id+'T12:00:00Z');t<=Date.parse(last+'T12:00:00Z');t+=86400000){const day=getDay(new Date(t).toISOString().slice(0,10),{persist:false});if(day)days.push(structuredClone(day))}
  for(const day of days)for(const q of day.questions){
    if(!q.image?.src?.startsWith('assets/'))continue;
    const name=path.basename(q.image.src);
    images.set(name,new URL('dist/'+q.image.src,root));
    q.image.src=`${url}/storage/v1/object/public/${BUCKET}/${name}`;
  }
  return {
    days:days.map(day=>({id:day.id,name:day.name,theme:day.theme||'',source:pilotIds.has(day.id)?'piloto':'banco-editorial'})),
    questions:days.flatMap(day=>day.questions.map((q,i)=>({id:q.id,day_id:day.id,position:i+1,revision:q.revision??1,title:q.title,unit:q.unit,answer:q.answer,content:q}))),
    images
  };
}

export async function publish({url,key,fetch:request=globalThis.fetch,dryRun=false,log=console.log}){
  url=(url||'').replace(/\/+$/,'');
  if(!url||!key)throw Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY');
  async function call(target,init={}){
    const response=await request(url+target,{...init,headers:{apikey:key,...init.headers},signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error(`${init.method||'GET'} ${target.split('?')[0]} → ${response.status}: ${(await response.text()).slice(0,300)}`);
    return response;
  }
  async function all(table,select){
    const rows=[];
    for(let offset=0;;offset+=1000){const page=await(await call(`/rest/v1/${table}?select=${select}&order=id&limit=1000&offset=${offset}`)).json();rows.push(...page);if(page.length<1000)return rows}
  }
  const content=buildContent(url);

  // Imágenes: el eTag de Storage es el MD5 del archivo cuando se sube de una vez.
  const stored=new Map((await(await call(`/storage/v1/object/list/${BUCKET}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:1000,offset:0})})).json()).map(o=>[o.name,String(o.metadata?.eTag||'').replace(/"/g,'')]));
  const images=[...content.images].map(([name,file])=>({name,data:fs.readFileSync(file)})).filter(({name,data})=>stored.get(name)!==createHash('md5').update(data).digest('hex'));

  // Filas: solo las nuevas o con algún campo distinto.
  const sameDay=(a,b)=>a.name===b.name&&a.theme===b.theme&&a.source===b.source;
  const sameQuestion=(a,b)=>a.day_id===b.day_id&&a.position===b.position&&a.revision===b.revision&&a.title===b.title&&a.unit===b.unit&&canonical(a.content)===canonical(b.content);
  const dbDays=new Map((await all('days','id,name,theme,source')).map(d=>[d.id,d]));
  const dbQuestions=new Map((await all('questions','id,day_id,position,revision,title,unit,content')).map(q=>[q.id,q]));
  const days=content.days.filter(d=>!dbDays.has(d.id)||!sameDay(d,dbDays.get(d.id)));
  const questions=content.questions.filter(q=>!dbQuestions.has(q.id)||!sameQuestion(q,dbQuestions.get(q.id)));
  const wanted=new Set(content.questions.map(q=>q.id)),slots=new Set(content.questions.map(q=>q.day_id+'|'+q.position));
  const replaced=[...dbQuestions.values()].filter(q=>!wanted.has(q.id)&&slots.has(q.day_id+'|'+q.position));

  const summary={images:images.length,days:days.length,questions:questions.length,replaced:replaced.map(q=>q.id)};
  log(`Contenido: ${content.days.length} jornadas, ${content.questions.length} preguntas y ${content.images.size} imágenes. Cambios: ${images.length} imágenes, ${days.length} jornadas, ${questions.length} preguntas${replaced.length?`, ${replaced.length} preguntas sustituidas`:''}.`);
  if(dryRun)return summary;

  for(const {name,data} of images)await call(`/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':types[path.extname(name).toLowerCase()]||'application/octet-stream','x-upsert':'true','Cache-Control':'max-age=31536000'},body:data});
  const upsert=(table,rows)=>rows.length&&call(`/rest/v1/${table}?on_conflict=id`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  await upsert('days',days);
  for(const q of replaced){
    try{await call(`/rest/v1/questions?id=eq.${encodeURIComponent(q.id)}`,{method:'DELETE'})}
    catch(error){throw Error(`La pregunta ${q.id} (${q.day_id}, posición ${q.position}) se sustituye en el repositorio pero ya tiene respuestas: no se puede retirar. Dale otra fecha a la nueva o decide qué hacer con esas respuestas. Detalle: ${error.message}`)}
  }
  await upsert('questions',questions);
  log('Publicado en Supabase.');
  return summary;
}
