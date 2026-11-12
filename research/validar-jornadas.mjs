// Valida las jornadas escritas a mano de content/jornadas/ contra su plan (research/jornadas-plan.json, decisión 0046).
//   node research/validar-jornadas.mjs 2026-11-16 2026-11-20   (rango de fechas, ambos incluidos)
// Usa las mismas comprobaciones que el generador diario (lib/generar.mjs: campos, cuenta, cálculo por pasos, ámbito)
// y además las de las jornadas a mano: ids, nombre del día, orden y categoría del plan, y foto solo donde el plan la pide.
import fs from 'node:fs';
import {validate,addDays} from '../lib/generar.mjs';

const [from,to=from]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(from||''))throw Error('Uso: node research/validar-jornadas.mjs DESDE [HASTA]');
const plan=new Map(JSON.parse(fs.readFileSync(new URL('./jornadas-plan.json',import.meta.url),'utf8')).map(d=>[d.date,d]));
const errors=[];let count=0;
for(let id=from;id<=to;id=addDays(id,1)){
  const file=`content/jornadas/${id}.json`,e=m=>errors.push(`${id}: ${m}`),planned=plan.get(id);
  if(!planned){e('no está en el plan');continue}
  if(!fs.existsSync(file)){e(`falta ${file}`);continue}
  let day;try{day=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){e(`JSON no válido (${error.message})`);continue}
  if(day.id!==id)e('id distinto del nombre del archivo');
  const name=new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'Europe/Madrid'}).format(new Date(id+'T12:00:00Z')).replace(/^./,c=>c.toUpperCase());
  if(day.name!==name)e(`name debe ser «${name}»`);
  for(const message of validate(day,{slots:planned.questions.map(q=>q.ambito)}))e(message);
  (day.questions||[]).forEach((q,i)=>{
    const p=m=>e(`P${i+1} ${m}`),want=planned.questions[i];count++;
    if(q.id!==`jornada-${id}-${i+1}`)p(`id debe ser jornada-${id}-${i+1}`);
    if(q.revision!==1)p('revision debe ser 1');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(q.verifiedAt||''))p('falta verifiedAt');
    if(want&&q.category!==want.category)p(`la categoría del plan es «${want.category}»`);
    if('actualidad' in q||'generated' in q)p('las jornadas a mano no llevan actualidad ni generated');
    const image=q.image;
    if(want?.photo&&!image)p('el plan pide foto');
    if(!want?.photo&&image)p('el plan no pide foto: quita image');
    if(image){
      if(!new RegExp(`^assets/jornada-${id}-${i+1}\\.(jpg|png)$`).test(image.src||'')||!fs.existsSync('dist/'+image.src))p(`la foto debe ser dist/assets/jornada-${id}-${i+1}.jpg (o .png) y existir`);
      if(!image.alt||!image.credit||!image.license||!/^https:\/\//.test(image.url||''))p('foto sin alt, credit, license o url');
    }
  });
}
if(errors.length){console.log(errors.join('\n'));process.exitCode=1}else console.log(`OK: ${count} preguntas válidas entre ${from} y ${to}.`);
