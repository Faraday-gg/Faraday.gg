// Generación automática de jornadas con la API de OpenAI (Responses API con búsqueda web).
// Cada noche, a las 00:01 de Madrid, se crea la jornada del día siguiente con 3 preguntas nuevas
// (ver docs/decisiones/0017-jornada-diaria-generada-con-openai.md). Un día de cada dos, una de
// las tres es de actualidad. Si la jornada ya existe, no hace nada: se puede ejecutar varias veces.
// La usan la ruta /api/generar-dia (lib/api.mjs) y scripts/generar-jornada.mjs.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {editorialDays,madridDate} from '../content-engine.mjs';

export const SOURCE='ia';
export const DEFAULT_MODEL='gpt-5';
const OPENAI_URL='https://api.openai.com/v1/responses';
const dayMs=86400000;
export const categories=Object.fromEntries([...fs.readFileSync(new URL('../dist/categories.js',import.meta.url),'utf8').matchAll(/^  (\w+):\{label:'([^']+)'/gm)].map(m=>[m[1],m[2]]));
const handWritten=new Set(editorialDays.map(day=>day.id));

export const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*dayMs).toISOString().slice(0,10);
export const tomorrow=(now=new Date())=>addDays(madridDate(now),1);
// Un día de cada dos lleva una pregunta de actualidad.
export const wantsCurrent=date=>Math.round(Date.parse(date+'T12:00:00Z')/dayMs)%2===0;
// Ámbito del referente de cada pregunta (decisión 0046): se sortea por pregunta, de forma estable para cada fecha,
// sin fórmula fija. Mayoría mundial; España y Latinoamérica aparecen unos días sí y otros no, a veces dos a la vez.
export const AMBITOS={mundial:'mundial',espana:'España',latam:'Latinoamérica'};
export const PESOS={mundial:.6,espana:.18,latam:.22};
export function ambitos(date){
  const bytes=createHash('sha256').update('ambito:'+date).digest();
  return [0,1,2].map(i=>{const r=bytes.readUInt16BE(i*2)/65536;return r<PESOS.mundial?'mundial':r<PESOS.mundial+PESOS.espana?'espana':'latam'});
}
const describeAmbito={
  mundial:'referente mundial o general, que se conozca en cualquier país (sin que sea de España ni de Latinoamérica)',
  espana:'referente de España muy conocido también en Latinoamérica',
  latam:'referente latinoamericano muy conocido por cualquier hispanohablante, también en España. Varía el país (México, Argentina, Colombia, Chile, Perú, Cuba, Venezuela, Uruguay, Centroamérica, el Caribe…) y no repitas el de las preguntas recientes'
};
const weekday=date=>new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'Europe/Madrid'}).format(new Date(date+'T12:00:00Z')).replace(/^./,c=>c.toUpperCase());

// Evalúa referenceExpression sin eval: números (coma o punto decimal), + − × ÷ * / ^ y paréntesis.
export function evaluate(expression){
  const tokens=String(expression).replace(/\s+/g,'').replace(/[×x·]/g,'*').replace(/÷/g,'/').replace(/−/g,'-').match(/\d+(?:[.,]\d+)?(?:e[+-]?\d+)?|[-+*/^()]/gi);
  if(!tokens||tokens.join('')!==String(expression).replace(/\s+/g,'').replace(/[×x·]/g,'*').replace(/÷/g,'/').replace(/−/g,'-'))return NaN;
  let i=0;
  const peek=()=>tokens[i],next=()=>tokens[i++];
  function primary(){
    const t=next();
    if(t==='('){const v=sum();if(next()!==')')return NaN;return v}
    if(t==='-')return -power();
    if(t==='+')return power();
    return t&&/^\d/.test(t)?Number(t.replace(',','.')):NaN;
  }
  function power(){const base=primary();if(peek()==='^'){next();return base**power()}return base}
  function product(){let v=power();while(peek()==='*'||peek()==='/'){const op=next(),r=power();v=op==='*'?v*r:v/r}return v}
  function sum(){let v=product();while(peek()==='+'||peek()==='-'){const op=next(),r=product();v=op==='+'?v+r:v-r}return v}
  const value=sum();return i===tokens.length?value:NaN;
}

const text={type:'string'};
const questionSchema={
  type:'object',additionalProperties:false,
  required:['category','ambito','tag','title','detail','unit','answer','math','referenceExpression','assumptions','confidence','sources','reasoning','calc','actualidad'],
  properties:{
    category:{type:'string',enum:Object.keys(categories)},
    ambito:{type:'string',enum:Object.keys(AMBITOS)},
    tag:text,title:text,detail:text,unit:text,answer:{type:'number'},math:text,referenceExpression:text,assumptions:text,confidence:text,
    sources:{type:'array',items:{type:'object',additionalProperties:false,required:['title','url','fact'],properties:{title:text,url:text,fact:text}}},
    reasoning:{type:'object',additionalProperties:false,required:['heading','steps'],properties:{heading:text,steps:{type:'array',items:text}}},
    calc:{type:'object',additionalProperties:false,required:['intro','rows','result'],properties:{intro:text,rows:{type:'array',items:{type:'object',additionalProperties:false,required:['label','value'],properties:{label:text,value:text}}},result:text}},
    actualidad:{type:'boolean'}
  }
};
export const schema={type:'object',additionalProperties:false,required:['theme','questions'],properties:{theme:text,questions:{type:'array',items:questionSchema}}};

export function prompt({date,today,current,recent,slots=ambitos(date)}){
  const system=`Eres el editor de «Casi Casi», un juego diario de estimación en español neutro, para jugadores de España y de toda Latinoamérica. Cada día hay 3 preguntas cuya respuesta es un número positivo; el jugador estima y se puntúa por la distancia multiplicativa a la cifra de referencia.

Reglas editoriales (obligatorias):
1. Cada pregunta mezcla dos ideas de cultura general que conoce todo el mundo: un objeto cotidiano o una comida y un referente famoso, con humor. Ejemplo: «¿Cuántos ositos de gominola mide la Estatua de la Libertad?».
2. Referentes muy conocidos. Cada pregunta tiene un ámbito (ambito): «mundial» (lo conoce cualquiera, en cualquier país), «espana» o «latam» (España o Latinoamérica, pero solo lo que conoce cualquier hispanohablante a ambos lados del Atlántico). Nada de sitios o eventos locales poco conocidos.
3. Cada cifra sale de una fuente que hayas consultado con la búsqueda web: organismos oficiales, fabricantes, federaciones, museos, agencias espaciales, prensa seria; Wikipedia como último recurso. Nunca inventes datos, URL ni citas. Fecha los datos que cambian con el tiempo.
4. Las tres preguntas son de categorías distintas. Categorías posibles: ${Object.entries(categories).map(([k,v])=>`${k} (${v})`).join(', ')}.
5. Tono: títulos con gracia que acaban en «?»; «detail» explica las condiciones del juego con una broma; razonamiento en 3 pasos (estimación a ojo, orden de magnitud y afinar con el dato real).
6. Español neutro, que se entienda igual en Madrid, en Ciudad de México y en Buenos Aires: evita palabras de un solo país (caña, folio, móvil, coche, ordenador, patata; celular, carro, computadora, papa) y elige otra común a todos («teléfono», «auto», «hoja de papel», «portátil»). Sin vosotros ni modismos locales. Sistema métrico. Si hay dinero, en dólares estadounidenses (o con su equivalencia en dólares).

Formato de cada pregunta:
- ambito: el que te pido para esa posición.
- tag: 2 o 3 palabras. title: la pregunta. detail: 1 o 2 frases. unit: unidad de la respuesta en plural («tazas», «veces», «km»).
- answer: la cifra de referencia (número). math: el cálculo explicado con las cifras de las fuentes, con números en formato español.
- referenceExpression: la cuenta que da answer, solo con números sin separador de miles (coma decimal), ×, ÷, +, − y paréntesis. Ej.: «13670000 × 60000 ÷ 7». Debe dar exactamente answer.
- assumptions: supuestos del modelo y lo que no se cuenta. confidence: «Dato documentado», «Dato documentado + cálculo» o «Dato documentado + modelo».
- sources: 1 a 3 fuentes con title («Organismo · Título de la página»), url (https, la página exacta que consultaste) y fact (el dato que sacas de ella, en español).
- reasoning: heading corto y exactamente 3 steps.
- calc: la cuenta por pasos que se enseña tras responder. intro: una sola frase corta con la idea del cálculo. rows: de 2 a 6 filas, cada una con label (el concepto, 2 a 5 palabras: «Masa de la ISS», «Minutos en un año») y value (la cifra con su unidad, en formato español; desde la segunda fila empieza por la operación: «× 182», «÷ 7 kg»; un subtotal opcional empieza por «=»). result: el nombre del resultado («Jamones», «Años»); la cifra final la pone el juego.
- actualidad: true solo si la pregunta trata un tema de actualidad.
theme: lema del día que une las tres preguntas en pocas palabras («Café, Andes y cielo»).`;
  const user=`Escribe la jornada del ${weekday(date).toLowerCase()} ${date}. Hoy es ${today}.
Ámbito de cada pregunta, en este orden:
${slots.map((a,i)=>`- Pregunta ${i+1}: ambito «${a}», ${describeAmbito[a]}.`).join('\n')}
${current?'Una de las tres preguntas (y solo una) debe ser de actualidad, respetando su ámbito: un tema del que se esté hablando estos últimos días en el mundo, en España o en Latinoamérica (deporte, ciencia, tecnología, cultura, economía…), buscado en noticias recientes y con la cifra bien fechada. Evita tragedias, política partidista y temas que puedan ofender. Márcala con actualidad: true y las otras con false.':'Hoy ninguna pregunta es de actualidad: las tres llevan actualidad: false.'}
${recent.length?`No repitas referentes ni ideas de estas preguntas recientes:\n${recent.map(t=>'- '+t).join('\n')}`:''}`;
  return {system,user};
}

// Valida la jornada como research/validar-archivo.mjs. Devuelve la lista de errores (vacía si es válida).
export function validate(day,{current,slots}={}){
  const errors=[],e=m=>errors.push(m);
  if(!day?.theme?.trim())e('falta theme');
  if(day?.questions?.length!==3)return [...errors,'debe tener 3 preguntas'];
  if(new Set(day.questions.map(q=>q.category)).size!==3)e('categorías repetidas');
  const currents=day.questions.filter(q=>q.actualidad).length;
  if(current!==undefined&&currents!==(current?1:0))e(current?'falta la pregunta de actualidad (exactamente una)':'hoy no toca pregunta de actualidad');
  day.questions.forEach((q,i)=>{
    const p=m=>e(`P${i+1} ${m}`);
    if(!categories[q.category])p('categoría no válida: '+q.category);
    if(slots&&q.ambito!==slots[i])p(`el ámbito debe ser «${slots[i]}» (es «${q.ambito}»)`);
    for(const k of ['tag','title','detail','unit','math','referenceExpression','assumptions','confidence'])if(typeof q[k]!=='string'||!q[k].trim())p('falta '+k);
    if(!/\?\s*$/.test(q.title||''))p('el título debe ser una pregunta');
    if(!Number.isFinite(q.answer)||q.answer<=0||q.answer>1e30)p('answer debe ser un número positivo');
    const value=evaluate(q.referenceExpression);
    if(!Number.isFinite(value)||Math.abs(value-q.answer)>Math.abs(q.answer)*.005)p(`referenceExpression (${q.referenceExpression}) no da answer (${q.answer})`);
    if(!Array.isArray(q.sources)||!q.sources.length||q.sources.length>3||!q.sources.every(s=>s.title&&s.fact&&/^https:\/\/[^\s]+$/.test(s.url)))p('fuentes incompletas (title, url https, fact)');
    if(q.reasoning?.steps?.length!==3||!q.reasoning.heading)p('reasoning necesita heading y 3 steps');
    if(!q.calc?.intro?.trim()||!q.calc.result?.trim()||!Array.isArray(q.calc.rows)||q.calc.rows.length<2||q.calc.rows.length>6||!q.calc.rows.every(r=>r?.label?.trim()&&r.value?.trim()))p('calc necesita intro, result y de 2 a 6 filas con label y value');
  });
  return errors;
}

// Comprueba que las URL de las fuentes existen. Muchas webs rechazan a los robots (403, 429…):
// solo se descarta una fuente si no responde o si la página no existe (404, 410).
async function brokenSources(day,request){
  const urls=[...new Set(day.questions.flatMap(q=>q.sources.map(s=>s.url)))];
  const results=await Promise.all(urls.map(async url=>{
    try{const response=await request(url,{method:'GET',redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (compatible; CasiCasi/1.0)'},signal:AbortSignal.timeout(10000)});response.body?.cancel?.();return [404,410].includes(response.status)?`${url} → ${response.status}`:null}
    catch(error){return `${url} → ${error?.name==='TimeoutError'?'sin respuesta':'no se puede abrir'}`}
  }));
  return results.filter(Boolean);
}

async function askOpenAI({apiKey,model,request,system,user}){
  const response=await request(OPENAI_URL,{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,input:[{role:'developer',content:system},{role:'user',content:user}],tools:[{type:'web_search'}],text:{format:{type:'json_schema',name:'jornada',strict:true,schema}}}),
    signal:AbortSignal.timeout(170000)
  });
  if(!response.ok)throw Error(`OpenAI respondió ${response.status}: ${(await response.text()).slice(0,300)}`);
  const data=await response.json();
  if(data.status&&data.status!=='completed')throw Error(`OpenAI no terminó la respuesta (${data.status}${data.incomplete_details?.reason?': '+data.incomplete_details.reason:''})`);
  const output=(data.output||[]).filter(o=>o.type==='message').flatMap(o=>o.content||[]);
  const refusal=output.find(c=>c.type==='refusal');if(refusal)throw Error('OpenAI rechazó la petición: '+refusal.refusal);
  const raw=output.filter(c=>c.type==='output_text').map(c=>c.text).join('');
  try{return JSON.parse(raw)}catch{throw Error('OpenAI no devolvió un JSON válido')}
}

// Crea la jornada de `date`. Devuelve {status:'creada'|'omitida'|'prueba', date, reason?, day?}.
//   store: supabaseStore (dayInfo, days, saveGeneratedDay). Puede ser null con save:false.
//   save:false genera y valida sin guardar (scripts/generar-jornada.mjs --prueba).
export async function generateDay({date,store,apiKey,model=DEFAULT_MODEL,fetch:request=globalThis.fetch,save=true,now=new Date(),checkUrls=true,attempts=2,log=console.log}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Fecha no válida: '+date);
  if(!apiKey)throw Error('Falta OPENAI_API_KEY');
  if(save&&!store?.saveGeneratedDay)throw Error('Para guardar la jornada hace falta Supabase (SUPABASE_URL y SUPABASE_SECRET_KEY)');
  // Las jornadas escritas a mano (archivo y piloto) no se tocan nunca.
  if(handWritten.has(date))return {status:'omitida',date,reason:'jornada escrita a mano'};
  if(store?.dayInfo){
    const info=await store.dayInfo(date);
    if(info?.source===SOURCE&&info.questions===3)return {status:'omitida',date,reason:'ya estaba generada'};
    if(info?.source==='piloto')return {status:'omitida',date,reason:'jornada escrita a mano'};
    // Una jornada del banco automático se sustituye solo si nadie la ha jugado todavía.
    if(info?.answered)return {status:'omitida',date,reason:'la jornada ya tiene respuestas'};
  }
  const today=madridDate(now),current=wantsCurrent(date);
  const recent=store?.days?(await store.days(addDays(date,-60),addDays(date,-1)).catch(()=>[])).flatMap(d=>d.questions.map(q=>q.title)):[];
  const slots=ambitos(date),{system,user}=prompt({date,today,current,recent,slots});
  // Vercel corta la función a los 300 s: solo se reintenta si el primer intento fue rápido.
  let errors=[],day;const started=Date.now();
  for(let attempt=1;attempt<=attempts;attempt++){
    if(attempt>1&&Date.now()-started>110000)break;
    const generated=await askOpenAI({apiKey,model,request,system,user:attempt===1?user:`${user}\n\nEl intento anterior no era válido: ${errors.join('; ')}. Corrígelo.`});
    day={
      id:date,name:weekday(date),theme:String(generated.theme||'').trim(),
      questions:(generated.questions||[]).map((q,i)=>({id:`ia-${date}-${i+1}`,revision:1,verifiedAt:today,...q,generated:{by:'openai',model,at:now.toISOString()}}))
    };
    errors=validate(day,{current,slots});
    if(!errors.length&&checkUrls)errors=(await brokenSources(day,request)).map(m=>'fuente que no existe: '+m);
    if(!errors.length)break;
    log(`Jornada ${date}, intento ${attempt} no válido: ${errors.join('; ')}`);
  }
  if(errors.length)throw Error(`No se pudo generar una jornada válida para ${date}: ${errors.join('; ')}`);
  if(!save)return {status:'prueba',date,day};
  await store.saveGeneratedDay(day,SOURCE);
  log(`Jornada ${date} generada con ${model}: ${day.questions.map(q=>q.title).join(' | ')}`);
  return {status:'creada',date,day};
}
