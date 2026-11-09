// Publica en Supabase todo el contenido del juego:
//   - las imágenes de dist/assets en el almacén público «imagenes» (Supabase Storage);
//   - todas las jornadas (piloto y banco editorial) en «days» y sus preguntas en «questions»,
//     con la imagen apuntando ya a Storage.
// Se puede repetir: sube de nuevo las imágenes y actualiza las filas que ya existan con el contenido del repositorio.
// Uso (desde la raíz del repo):
//   node --env-file=.env scripts/publicar-contenido.mjs           publica
//   node --env-file=.env scripts/publicar-contenido.mjs --prueba  solo cuenta lo que publicaría
// Escribe en la única base de datos (producción). Ver docs/base-de-datos.md.
import fs from 'node:fs';
import path from 'node:path';
import {calendar,getDay} from '../content-engine.mjs';

const url=(process.env.SUPABASE_URL||'').replace(/\/+$/,''),key=process.env.SUPABASE_SECRET_KEY,dryRun=process.argv.includes('--prueba');
if(!url||!key){console.error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY: arranca con node --env-file=.env scripts/publicar-contenido.mjs');process.exit(1)}
const BUCKET='imagenes',types={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};

async function call(target,init={}){
  const response=await fetch(target,{...init,headers:{apikey:key,...init.headers},signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`${init.method||'GET'} ${target.replace(url,'')} → ${response.status}: ${(await response.text()).slice(0,300)}`);
  return response;
}

// 1. Jornadas: piloto (dist/questions.json) y banco editorial (content-engine.mjs), sin escribir en runtime/.
const pilot=JSON.parse(fs.readFileSync('dist/questions.json','utf8')),pilotIds=new Set(pilot.map(day=>day.id));
const last=calendar(pilot[0].id,{persist:false}).availableThrough,days=[];
for(let t=Date.parse(pilot[0].id+'T12:00:00Z');t<=Date.parse(last+'T12:00:00Z');t+=86400000){const day=getDay(new Date(t).toISOString().slice(0,10),{persist:false});if(day)days.push(structuredClone(day))}

// 2. Imágenes: cada archivo local de assets/ se sube una vez y las preguntas pasan a usar su URL pública.
const images=new Map();
for(const day of days)for(const q of day.questions)if(q.image?.src?.startsWith('assets/'))images.set(q.image.src,`${url}/storage/v1/object/public/${BUCKET}/${path.basename(q.image.src)}`);
for(const day of days)for(const q of day.questions)if(images.has(q.image?.src))q.image.src=images.get(q.image.src);
const questions=days.flatMap(day=>day.questions.map((q,i)=>({id:q.id,day_id:day.id,position:i+1,revision:q.revision??1,title:q.title,unit:q.unit,answer:q.answer,content:q})));
console.log(`${days.length} jornadas (${days[0].id} → ${days.at(-1).id}), ${questions.length} preguntas, ${images.size} imágenes.`);
if(dryRun)process.exit(0);

for(const [local] of images){
  const file=path.join('dist',local),name=path.basename(local);
  await call(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':types[path.extname(name).toLowerCase()]||'application/octet-stream','x-upsert':'true','Cache-Control':'max-age=31536000'},body:fs.readFileSync(file)});
}
console.log(`Imágenes subidas a Storage («${BUCKET}»).`);

// 3. Filas: inserta o actualiza por id (resolution=merge-duplicates).
const upsert=(table,rows)=>call(`${url}/rest/v1/${table}?on_conflict=id`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
await upsert('days',days.map(day=>({id:day.id,name:day.name,theme:day.theme||'',source:pilotIds.has(day.id)?'piloto':'banco-editorial'})));
await upsert('questions',questions);
console.log('Jornadas y preguntas publicadas en Supabase.');
