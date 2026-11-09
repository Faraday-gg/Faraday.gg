// Lógica de la API, compartida por el servidor local (preview-server.mjs) y la función de Vercel (api/index.mjs).
// Recibe un Request estándar y devuelve un Response; devuelve null si la ruta no es de la API.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {calendar,getDay,madridDate} from '../content-engine.mjs';

const pilot=JSON.parse(fs.readFileSync(new URL('../dist/questions.json',import.meta.url),'utf8'));
const MAX_BODY=2048,PLAYER=/^[a-f0-9-]{36}$/i;

export function json(status,data){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
const hash=player=>createHash('sha256').update(player).digest('hex');
// La API de Supabase devuelve los double con 15 cifras significativas: una respuesta repetida
// con más decimales no coincide exactamente, así que se compara con tolerancia relativa.
const same=(stored,guess)=>stored!==undefined&&Math.abs(stored-guess)<=Math.abs(guess)*1e-12;

export function distribution(rows,player,answer,guess){
  const others=Object.entries(rows).filter(([id])=>id!==player).map(([,value])=>value);
  const logs=others.map(value=>Math.log10(value/answer)),own=Math.log10(guess/answer);
  const low=Math.min(-1,own-.15,...logs.map(x=>x-.1)),high=Math.max(1,own+.15,...logs.map(x=>x+.1));
  const bins=Array(32).fill(0);for(const value of logs)bins[Math.min(31,Math.max(0,Math.floor((value-low)/(high-low)*32)))]++;
  const factor=Math.max(guess/answer,answer/guess),farther=others.filter(value=>Math.max(value/answer,answer/value)>factor).length;
  return {count:others.length,bins,low,high,closerPercent:others.length?Math.round(farther/others.length*100):null};
}

export function dailyDistribution(day,rows,player){
  const total=id=>day.questions.reduce((sum,q,i)=>sum+Math.max(rows[i][id]/q.answer,q.answer/rows[i][id]),0)/3;
  const own=total(player),others=Object.keys(rows[0]).filter(id=>id!==player&&rows.every(row=>Number.isFinite(row[id]))).map(total);
  const low=0,high=Math.max(1,Math.log10(own)+.15,...others.map(n=>Math.log10(n)+.1)),bins=Array(32).fill(0);
  for(const value of others)bins[Math.min(31,Math.floor(Math.log10(value)/high*32))]++;
  return {count:others.length,own,bins,low,high,closerPercent:others.length?Math.round(others.filter(n=>n>own).length/others.length*100):null};
}

// persistDays: guardar las jornadas generadas en disco (runtime/days). En Vercel debe ser false.
export function createApi({store,persistDays=true,log=console.error}){
  const options={persist:persistDays};
  // Cada pregunta conocida guarda su jornada: Supabase necesita publicarla antes de aceptar respuestas.
  const pilotDays=new Set(pilot.map(day=>day.id)),known=new Map();
  const remember=day=>{for(const question of day.questions)known.set(question.id,{question,day});return day};
  pilot.forEach(remember);
  let bank;
  function findQuestion(id){
    if(typeof id!=='string')return undefined;
    if(known.has(id))return known.get(id);
    // Sin estado entre peticiones (Vercel): se calcula una vez el banco completo, que es determinista.
    if(!bank){bank=new Map();const last=calendar(madridDate(),{persist:false}).availableThrough;for(let t=Date.parse(pilot[0].id+'T12:00:00Z');t<=Date.parse(last+'T12:00:00Z');t+=86400000){const day=getDay(new Date(t).toISOString().slice(0,10),{persist:false});if(day)for(const question of day.questions)bank.set(question.id,{question,day})}}
    return bank.get(id);
  }
  function currentCalendar(){const data=calendar(madridDate(),options);data.days.forEach(remember);return data}
  function foreign(request){
    const origin=request.headers.get('origin');if(!origin)return false;
    const host=request.headers.get('x-forwarded-host')||request.headers.get('host')||new URL(request.url).host;
    try{return new URL(origin).host!==host}catch{return true}
  }
  async function body(request){
    const text=await request.text();
    if(text.length>MAX_BODY)return {error:json(413,{error:'Solicitud demasiado grande'})};
    try{const data=JSON.parse(text);if(data&&typeof data==='object')return {data}}catch{}
    return {error:json(400,{error:'JSON no válido'})};
  }
  async function answers(data){
    const found=findQuestion(data.question),q=found?.question;
    if(!q||typeof data.player!=='string'||!PLAYER.test(data.player)||!Number.isFinite(data.guess)||data.guess<=0||data.guess>1e30)return json(400,{error:'Respuesta no válida'});
    const player=hash(data.player);
    await store.add(q.id,player,data.guess,{day:found.day,source:pilotDays.has(found.day.id)?'piloto':'banco-editorial'});
    const rows=(await store.read([q.id]))[q.id];
    if(!same(rows[player],data.guess))return json(409,{error:'Ya has respondido esta pregunta'});
    return json(200,distribution(rows,player,q.answer,data.guess));
  }
  async function dailyScores(data){
    const day=getDay(typeof data.date==='string'?data.date:'',options);
    if(!day||typeof data.player!=='string'||!PLAYER.test(data.player))return json(400,{error:'Edición o participante no válido'});
    const player=hash(data.player),stored=await store.read(day.questions.map(q=>q.id)),rows=day.questions.map(q=>stored[q.id]||{});
    if(!rows.every(row=>Number.isFinite(row[player])))return json(409,{error:'Completa las tres preguntas para comparar tu puntuación'});
    return json(200,dailyDistribution(day,rows,player));
  }
  async function handle(request){
    const url=new URL(request.url);
    // En Vercel, vercel.json reescribe /api/<ruta> y /daily-content.js hacia /api?route=<ruta>.
    const route=url.searchParams.get('route');
    const path=route?(route==='daily-content.js'?'/daily-content.js':`/api/${route}`):url.pathname;
    if(path!=='/daily-content.js'&&path!=='/api'&&!path.startsWith('/api/'))return null;
    try{
      if(path==='/api/calendar')return json(200,currentCalendar());
      if(path==='/daily-content.js')return new Response('window.DAILY_CALENDAR = '+JSON.stringify(currentCalendar())+'; window.PILOT_DAYS = window.DAILY_CALENDAR.days;',{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
      if(path==='/api/day'){const day=getDay(url.searchParams.get('date')||madridDate(),options);return day?json(200,remember(day)):json(404,{error:'No hay una edición verificada para esta fecha'})}
      if(path==='/api/answers'||path==='/api/daily-scores'){
        if(request.method!=='POST')return json(405,{error:'Usa POST'});
        if(foreign(request))return json(403,{error:'Origen no permitido'});
        const {data,error}=await body(request);if(error)return error;
        return path==='/api/answers'?await answers(data):await dailyScores(data);
      }
      return json(404,{error:'Ruta no disponible'});
    }catch(error){log(`API ${path}:`,error?.message||error);return json(500,{error:'No se pudo procesar la solicitud'})}
  }
  return {handle,store};
}
