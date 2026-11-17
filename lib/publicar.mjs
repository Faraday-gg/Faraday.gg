// Publicación del contenido en Supabase: jornadas, preguntas e imágenes.
// Es incremental: compara con lo que ya hay y solo sube lo que ha cambiado.
//   - Imágenes de dist/assets → almacén público «imagenes» de Storage (compara el MD5 con el eTag).
//   - Jornadas (archivo + piloto + banco editorial; el archivo se guarda como «piloto») → «days»; sus preguntas → «questions», con image.src en Storage.
//   - Las jornadas generadas con OpenAI (source «ia», lib/generar.mjs) mandan sobre el banco editorial: no se tocan.
//   - Conserva la referencia si un id vuelve con otra respuesta. Conserva también las
//     preguntas que ya se jugaron cuando el repositorio propone un id distinto para su posición.
// Nunca borra jornadas ni respuestas. La usan scripts/publicar-contenido.mjs y el build de Vercel.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {calendar,getDay,editorialDays} from '../content-engine.mjs';

export const BUCKET='imagenes';
const GENERATED='ia';
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
  const pilot=editorialDays,pilotIds=new Set(pilot.map(day=>day.id));
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
    if(!response.ok){
      const body=await response.text();
      const error=Error(`${init.method||'GET'} ${target.split('?')[0]} → ${response.status}: ${body.slice(0,300)}`);
      try{error.code=JSON.parse(body).code}catch{}
      throw error;
    }
    return response;
  }
  async function all(table,select,extra={}){
    const rows=[];
    for(let offset=0;;offset+=1000){
      const params=new URLSearchParams({select,order:'id',limit:'1000',offset:String(offset),...extra});
      const page=await(await call(`/rest/v1/${table}?${params}`)).json();
      rows.push(...page);
      if(page.length<1000)return rows;
    }
  }
  const content=buildContent(url);

  // Imágenes: el eTag de Storage es el MD5 del archivo cuando se sube de una vez.
  const stored=new Map((await(await call(`/storage/v1/object/list/${BUCKET}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:1000,offset:0})})).json()).map(o=>[o.name,String(o.metadata?.eTag||'').replace(/"/g,'')]));
  const images=[...content.images].map(([name,file])=>({name,data:fs.readFileSync(file)})).filter(({name,data})=>stored.get(name)!==createHash('md5').update(data).digest('hex'));

  // Filas: solo las nuevas o con algún campo distinto.
  const sameDay=(a,b)=>a.name===b.name&&a.theme===b.theme&&a.source===b.source;
  const sameQuestion=(a,b)=>a.day_id===b.day_id&&a.position===b.position&&a.revision===b.revision&&a.title===b.title&&a.unit===b.unit&&canonical(a.content)===canonical(b.content);
  const dbDays=new Map((await all('days','id,name,theme,source')).map(d=>[d.id,d]));
  const dbQuestions=new Map((await all('questions','id,day_id,position,revision,title,unit,answer,content,answers(question_id)',{'answers.limit':'1'})).map(q=>[q.id,q]));
  const generated=new Set([...dbDays.values()].filter(d=>d.source===GENERATED).map(d=>d.id));
  const mine=content.questions.filter(q=>!generated.has(q.day_id));
  const slot=q=>q.day_id+'|'+q.position;
  const occupied=new Map([...dbQuestions.values()].map(q=>[slot(q),q]));
  const preserved=new Set(),preservedSlots=new Set(),replaced=[];
  const preserve=published=>{
    preserved.add(published.id);
    preservedSlots.add(slot(published));
  };
  const scoringCompatible=(old,q)=>old.unit===q.unit&&old.revision===q.revision
    &&Number.isFinite(old.answer)&&Math.abs(old.answer/q.answer-1)<=1e-12;

  for(const q of mine){
    const published=dbQuestions.get(q.id);
    if(published&&(!scoringCompatible(published,q)||slot(published)!==slot(q))){
      preserve(published);
      preservedSlots.add(slot(q));
    }
    const previous=occupied.get(slot(q));
    if(previous&&previous.id!==q.id){
      if(previous.answers?.length||dbQuestions.has(q.id))preserve(previous);
      else if(!content.questions.some(candidate=>candidate.id===previous.id))replaced.push(previous);
      else preserve(previous);
    }
  }
  const preservedDays=new Set([...preserved].map(id=>dbQuestions.get(id).day_id));
  const days=content.days.filter(d=>!generated.has(d.id)&&!preservedDays.has(d.id)&&(!dbDays.has(d.id)||!sameDay(d,dbDays.get(d.id))));
  const questions=mine.filter(q=>!preservedSlots.has(slot(q))&&(!dbQuestions.has(q.id)||!sameQuestion(q,dbQuestions.get(q.id))));
  // PostgREST puede truncar decimales; la columna de puntuación publicada se
  // conserva al actualizar una explicación compatible.
  for(const q of questions){
    if(dbQuestions.has(q.id))delete q.answer;
  }
  const removals=replaced.filter(q=>!preservedSlots.has(slot(q)));
  const summary={images:images.length,days:days.length,questions:questions.length,replaced:removals.map(q=>q.id),generated:generated.size};
  if(preserved.size)summary.preserved=[...preserved];
  log(`Contenido: ${content.days.length} jornadas, ${content.questions.length} preguntas y ${content.images.size} imágenes. Cambios: ${images.length} imágenes, ${days.length} jornadas, ${questions.length} preguntas${removals.length?`, ${removals.length} preguntas sustituidas`:''}.`);
  if(preserved.size)log(`Se conservan referencias publicadas: ${[...preserved].join(', ')}.`);
  if(dryRun)return summary;

  for(const {name,data} of images)await call(`/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':types[path.extname(name).toLowerCase()]||'application/octet-stream','x-upsert':'true','Cache-Control':'max-age=31536000'},body:data});
  const upsert=(table,rows)=>rows.length&&call(`/rest/v1/${table}?on_conflict=id`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  // Si llega una respuesta durante la publicación, la FK mantiene la pregunta
  // original y omitimos su sustitución. Otros errores de escritura se elevan.
  for(const q of removals){
    try{await call(`/rest/v1/questions?id=eq.${encodeURIComponent(q.id)}`,{method:'DELETE'})}
    catch(error){
      if(error.code!=='23503')throw error;
      preserve(q);
      preservedDays.add(q.day_id);
      log(`Se conserva ${q.id}: recibió una respuesta durante la publicación.`);
    }
  }
  await upsert('days',days.filter(d=>!preservedDays.has(d.id)));
  const applicable=questions.filter(q=>!preservedSlots.has(slot(q)));
  await upsert('questions',applicable.filter(q=>q.answer!==undefined));
  for(const q of applicable.filter(q=>q.answer===undefined)){
    // PATCH evita enviar un upsert sin la columna obligatoria answer.
    await call(`/rest/v1/questions?id=eq.${encodeURIComponent(q.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(q)});
  }
  if(preserved.size)summary.preserved=[...preserved];
  summary.replaced=summary.replaced.filter(id=>!preserved.has(id));
  summary.days=days.filter(d=>!preservedDays.has(d.id)).length;
  summary.questions=applicable.length;
  log('Publicado en Supabase.');
  return summary;
}
