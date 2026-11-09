// Valida jornadas del archivo antes de darlas por buenas.
//   node research/validar-archivo.mjs 2026-08-09 2026-08-20   (rango de fechas, ambos incluidos)
import fs from 'node:fs';
const [from,to=from]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(from||''))throw Error('Uso: node research/validar-archivo.mjs DESDE [HASTA]');
const categories=new Set([...fs.readFileSync('dist/categories.js','utf8').matchAll(/^  (\w+):\{label:/gm)].map(m=>m[1]));
const errors=[];let count=0;
for(let t=Date.parse(from+'T12:00:00Z');t<=Date.parse(to+'T12:00:00Z');t+=86400000){
  const id=new Date(t).toISOString().slice(0,10),file=`content/archivo/${id}.json`;
  if(!fs.existsSync(file)){errors.push(`${id}: falta ${file}`);continue}
  let day;try{day=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){errors.push(`${id}: JSON no válido (${e.message})`);continue}
  const e=m=>errors.push(`${id}: ${m}`);
  if(day.id!==id)e('id distinto del nombre del archivo');
  const name=new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'Europe/Madrid'}).format(new Date(t)).replace(/^./,c=>c.toUpperCase());
  if(day.name!==name)e(`name debe ser «${name}»`);
  if(!day.theme)e('falta theme');
  if(day.questions?.length!==3){e('debe tener 3 preguntas');continue}
  if(new Set(day.questions.map(q=>q.category)).size!==3)e('categorías repetidas');
  day.questions.forEach((q,i)=>{
    const p=m=>e(`P${i+1} ${m}`);count++;
    if(q.id!==`archivo-${id}-${i+1}`)p(`id debe ser archivo-${id}-${i+1}`);
    if(q.revision!==1)p('revision debe ser 1');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(q.verifiedAt||''))p('falta verifiedAt');
    if(!categories.has(q.category))p('categoría no válida: '+q.category);
    for(const k of ['tag','title','detail','unit','math','referenceExpression','assumptions','confidence'])if(typeof q[k]!=='string'||!q[k].trim())p('falta '+k);
    if(!Number.isFinite(q.answer)||q.answer<=0)p('answer debe ser un número positivo');
    if(!Array.isArray(q.sources)||!q.sources.length||!q.sources.every(s=>s.title&&s.fact&&/^https:\/\//.test(s.url)))p('fuentes incompletas (title, url https, fact)');
    if(q.reasoning?.steps?.length!==3||!q.reasoning.heading)p('reasoning necesita heading y 3 steps');
    const img=q.image||{};
    if(!new RegExp(`^assets/archivo-${id}-${i+1}\\.(jpg|png)$`).test(img.src||'')||!fs.existsSync('dist/'+img.src))p('falta la foto dist/assets/archivo-'+id+'-'+(i+1)+'.jpg (o .png)');
    if(!img.alt||!img.credit||!img.license||!/^https:\/\//.test(img.url||''))p('foto sin alt, credit, license o url');
  });
}
if(errors.length){console.log(errors.join('\n'));process.exitCode=1}else console.log(`OK: ${count} preguntas válidas entre ${from} y ${to}.`);
