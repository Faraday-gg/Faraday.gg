// Lógica de la API, compartida por el servidor local (preview-server.mjs) y la función de Vercel (api/index.mjs).
// Recibe un Request estándar y devuelve un Response; devuelve null si la ruta no es de la API.
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {calendar,getDay,madridDate,editorialDays} from '../content-engine.mjs';
import {createDuels,memoryDuels} from './duelos.mjs';
import {createRanked,memoryRanks} from './rangos.mjs';
import {createLeagues,memoryLeagues} from './ligas.mjs';
import {createReferrals,memoryReferrals} from './referidos.mjs';
import {createCommunity,memoryCommunity,RULES as COMMUNITY_RULES} from './comunidad.mjs';
import {VERIFIER_COOKIE,cookie,clearCookies} from './auth.mjs';

// Jornadas escritas a mano: archivo (content/archivo/), piloto (dist/questions.json) y jornadas (content/jornadas/).
const pilot=editorialDays;
const MAX_BODY=2048,PLAYER=/^[a-f0-9-]{36}$/i;

// cookies: lista de cabeceras Set-Cookie (puede haber varias en una misma respuesta).
export function json(status,data,extra={},cookies=[]){
  const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});
  for(const value of cookies)headers.append('Set-Cookie',value);
  return new Response(JSON.stringify(data),{status,headers});
}
function redirect(location,cookies=[]){
  const headers=new Headers({Location:location,'Cache-Control':'no-store'});for(const value of cookies)headers.append('Set-Cookie',value);
  return new Response(null,{status:302,headers});
}
// Cookie propia con el identificador anónimo del jugador (decisión 0009): sin registro, sin IP ni huella del dispositivo.
// La pone el servidor (HttpOnly) para que sobreviva aunque el navegador vacíe localStorage, como hace Safari a los 7 días.
export const PLAYER_COOKIE='faraday_jugador';
const PLAYER_COOKIE_MAX_AGE=60*60*24*365;
export function readCookie(request,name){
  for(const part of (request.headers.get('cookie')||'').split(';')){const index=part.indexOf('=');if(index>0&&part.slice(0,index).trim()===name)return part.slice(index+1).trim()}
  return null;
}
const playerCookie=(request,player)=>cookie(request,PLAYER_COOKIE,player,PLAYER_COOKIE_MAX_AGE);
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
  // near = cuántos de los demás lo clavaron (a menos de 1,1× de la real): el momento «¡Casi casi!» (decisión 0030).
  const near=others.filter(value=>Math.max(value/answer,answer/value)<1.1).length;
  return {count:others.length,bins,low,high,closerPercent:others.length?Math.round(farther/others.length*100):null,near};
}

export function dailyDistribution(day,rows,player){
  const total=id=>day.questions.reduce((sum,q,i)=>sum+Math.max(rows[i][id]/q.answer,q.answer/rows[i][id]),0)/3;
  const own=total(player),others=Object.keys(rows[0]).filter(id=>id!==player&&rows.every(row=>Number.isFinite(row[id]))).map(total);
  const low=0,high=Math.max(1,Math.log10(own)+.15,...others.map(n=>Math.log10(n)+.1)),bins=Array(32).fill(0);
  for(const value of others)bins[Math.min(31,Math.floor(Math.log10(value)/high*32))]++;
  return {count:others.length,own,bins,low,high,closerPercent:others.length?Math.round(others.filter(n=>n>own).length/others.length*100):null};
}

// persistDays: guardar las jornadas generadas en disco (runtime/days). En Vercel debe ser false.
// generator (opcional): {secret, run(date)} para /api/generar-dia, que crea la jornada de mañana con OpenAI (lib/generar.mjs).
// now y random (opcionales): reloj y azar de los duelos, para poder probarlos sin esperar.
// auth (opcional): inicio de sesión con Supabase Auth (lib/auth.mjs). Sin él, el juego sigue sin cuentas.
// moderate (opcional): filtro de las preguntas de la comunidad (lib/comunidad.mjs, openaiModerator).
export function createApi({store,persistDays=true,generator,auth=null,log=console.error,now,random,moderate=null}){
  const options={persist:persistDays};
  // Duelos 1 vs 1 (lib/duelos.mjs): salen preguntas escritas a mano de días ya pasados, para no destripar el reto de hoy.
  const duelQuestions=new Map(pilot.flatMap(day=>day.questions.map(question=>[question.id,question])));
  // Clasificatorias (lib/rangos.mjs, decisión 0043): los PR se guardan en store.ranks (rangos.json en local, tabla ranks en Supabase).
  const duels=createDuels({duels:store.duels||memoryDuels(),questions:duelQuestions,now,random,ranked:createRanked({ranks:store.ranks||memoryRanks()}),
    pool:()=>{const today=madridDate();return pilot.filter(day=>day.id<today).flatMap(day=>day.questions.map(question=>question.id))}});
  // Ligas de amigos (lib/ligas.mjs, decisión 0031): clasificación semanal con el reto diario jugado el mismo día.
  const clock=now||Date.now,leagueStore=store.leagues||memoryLeagues(),leagues=createLeagues({leagues:leagueStore,now:clock,random});
  // Referidos, el «Circuito» de amigos (lib/referidos.mjs, decisión 0038): usa los mismos resultados diarios que las ligas.
  const referrals=createReferrals({referrals:store.referrals||memoryReferrals(),now:clock,random,
    results:(players,from,to)=>leagueStore.results(players,from,to),
    answered:async player=>typeof store.byPlayer==='function'&&Object.keys(await store.byPlayer(player)).length>0});
  // Preguntas de la comunidad y progreso con cuenta (lib/comunidad.mjs, decisión 0049).
  const community=createCommunity({community:store.community||memoryCommunity(),now:clock,moderate,log});
  // Cada pregunta conocida guarda su jornada: Supabase necesita publicarla antes de aceptar respuestas.
  const pilotDays=new Set(pilot.map(day=>day.id)),known=new Map();
  const remember=day=>{for(const question of day.questions)known.set(question.id,{question,day});return day};
  pilot.forEach(remember);
  // Contenido: si el almacén lo guarda (Supabase), manda la base de datos; si una fecha no está publicada
  // allí o Supabase falla, se usa content-engine.mjs como respaldo para no dejar la web sin preguntas.
  const fromDb=typeof store.days==='function',validDate=date=>{if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const t=Date.parse(date+'T12:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date};
  async function storedDays(from,to){
    if(!fromDb)return [];
    try{return await store.days(from,to)}catch(error){log('Contenido desde content-engine (Supabase no disponible):',error?.message||error);return []}
  }
  async function loadDay(date){
    if(!validDate(date))return null;
    const [day]=await storedDays(date,date);
    const found=(day?.questions.length?day:null)||getDay(date,options);return found?remember(found):null;
  }
  let bank;
  async function findQuestion(id){
    if(typeof id!=='string')return undefined;
    if(known.has(id))return known.get(id);
    if(fromDb){try{const date=await store.dayOfQuestion(id);if(date&&await loadDay(date)&&known.has(id))return known.get(id)}catch(error){log('Pregunta desde content-engine:',error?.message||error)}}
    // Sin estado entre peticiones (Vercel): se calcula una vez el banco completo, que es determinista.
    if(!bank){bank=new Map();const last=calendar(madridDate(),{persist:false}).availableThrough;for(let t=Date.parse(pilot[0].id+'T12:00:00Z');t<=Date.parse(last+'T12:00:00Z');t+=86400000){const day=getDay(new Date(t).toISOString().slice(0,10),{persist:false});if(day)for(const question of day.questions)bank.set(question.id,{question,day})}}
    return bank.get(id);
  }
  async function currentCalendar(){
    const today=madridDate(),data=calendar(today,options);
    if(fromDb){
      // Mismo rango que content-engine: los 30 días que terminan hoy (o el último día del piloto).
      const end=data.date>'2026-11-15'?data.date:'2026-11-15',from=new Date(Date.parse(end+'T12:00:00Z')-29*86400000).toISOString().slice(0,10);
      const stored=await storedDays(from,end);
      if(stored.length){
        const byId=new Map(data.days.map(day=>[day.id,day]));for(const day of stored)if(day.questions.length)byId.set(day.id,day);
        data.days=[...byId.values()].sort((a,b)=>a.id<b.id?-1:1);
        const last=await store.lastDay().catch(()=>null);if(last&&last>data.availableThrough)data.availableThrough=last;
        data.exhausted=!data.days.some(day=>day.id===today)&&data.exhausted;
        data.source='supabase';
      }
    }
    data.days.forEach(remember);return data;
  }
  function foreign(request){
    const origin=request.headers.get('origin');if(!origin)return false;
    const host=request.headers.get('x-forwarded-host')||request.headers.get('host')||new URL(request.url).host;
    try{return new URL(origin).host!==host}catch{return true}
  }
  async function body(request,max=MAX_BODY){
    const text=await request.text();
    if(text.length>max)return {error:json(413,{error:'Solicitud demasiado grande'})};
    try{const data=JSON.parse(text);if(data&&typeof data==='object')return {data}}catch{}
    return {error:json(400,{error:'JSON no válido'})};
  }
  async function answers(data){
    const found=await findQuestion(data.question),q=found?.question;
    if(!q||typeof data.player!=='string'||!PLAYER.test(data.player)||!Number.isFinite(data.guess)||data.guess<=0||data.guess>1e30)return json(400,{error:'Respuesta no válida'});
    const player=hash(data.player);
    await store.add(q.id,player,data.guess,{day:found.day,source:pilotDays.has(found.day.id)?'piloto':'banco-editorial'});
    const rows=(await store.read([q.id]))[q.id];
    if(!same(rows[player],data.guess))return json(409,{error:'Ya has respondido esta pregunta'});
    if(found.day.questions.at(-1).id===q.id)await leagueResult(found.day,player);
    return json(200,distribution(rows,player,q.answer,data.guess));
  }
  // Al completar el reto de HOY (última pregunta o resumen del día) se apunta la distancia media para las ligas.
  // El archivo (días pasados) no cuenta. Un fallo aquí no impide guardar la respuesta.
  async function leagueResult(day,player,guesses){
    if(day.id!==madridDate(new Date(clock())))return;
    try{
      if(!guesses){
        // Solo las respuestas de este jugador (pocas filas), no las de todo el mundo.
        const ids=day.questions.map(q=>q.id),own=typeof store.byPlayer==='function'?await store.byPlayer(player):Object.fromEntries(Object.entries(await store.read(ids)).map(([id,rows])=>[id,rows[player]]));
        guesses=ids.map(id=>own[id]);
      }
      if(guesses.every(Number.isFinite))await leagues.record(player,day.id,day.questions.reduce((sum,q,i)=>sum+Math.max(guesses[i]/q.answer,q.answer/guesses[i]),0)/day.questions.length);
    }catch(error){log('Ligas (resultado del día):',error?.message||error)}
  }
  async function dailyScores(data){
    const day=await loadDay(data.date);
    if(!day||typeof data.player!=='string'||!PLAYER.test(data.player))return json(400,{error:'Edición o participante no válido'});
    const player=hash(data.player),stored=await store.read(day.questions.map(q=>q.id)),rows=day.questions.map(q=>stored[q.id]||{});
    if(!rows.every(row=>Number.isFinite(row[player])))return json(409,{error:'Completa las tres preguntas para comparar tu puntuación'});
    await leagueResult(day,player,rows.map(row=>row[player]));
    return json(200,dailyDistribution(day,rows,player));
  }
  // Lo llaman pg_cron (Supabase, 00:01 de Madrid) y el cron de Vercel como respaldo, con Authorization: Bearer CRON_SECRET.
  async function generateTomorrow(request,url){
    if(!generator?.secret)return json(503,{error:'Generación automática no configurada'});
    const given=Buffer.from(request.headers.get('authorization')||''),wanted=Buffer.from('Bearer '+generator.secret);
    if(given.length!==wanted.length||!timingSafeEqual(given,wanted))return json(401,{error:'No autorizado'});
    if(request.method!=='GET'&&request.method!=='POST')return json(405,{error:'Usa GET o POST'});
    const date=url.searchParams.get('date')||new Date(Date.parse(madridDate()+'T12:00:00Z')+86400000).toISOString().slice(0,10);
    if(!validDate(date))return json(400,{error:'Fecha no válida'});
    try{const {status,reason,day}=await generator.run(date);return json(200,{status,date,reason,titles:day?.questions.map(q=>q.title)})}
    catch(error){log('Generación de jornada:',error?.message||error);return json(502,{error:error?.message||'No se pudo generar la jornada'})}
  }
  // Respuestas guardadas de un jugador, agrupadas por jornada y en el orden de las preguntas: {fecha: [cifra, ...]}.
  async function progress(player){
    if(typeof store.byPlayer!=='function')return {};
    const answered=await store.byPlayer(player),result={};
    for(const [id,guess] of Object.entries(answered)){
      const found=await findQuestion(id);if(!found)continue;
      const position=found.day.questions.findIndex(q=>q.id===id);if(position<0)continue;
      (result[found.day.id]??=[])[position]=guess;
    }
    // El juego avanza pregunta a pregunta: solo vale el tramo inicial sin huecos.
    for(const [date,guesses] of Object.entries(result)){const gap=[...guesses.keys()].find(i=>!Number.isFinite(guesses[i]));const valid=gap===undefined?guesses:guesses.slice(0,gap);if(valid.length)result[date]=valid;else delete result[date]}
    return result;
  }
  const validPlayer=value=>typeof value==='string'&&PLAYER.test(value)?value.toLowerCase():null;
  const publicAccount=account=>account&&{email:account.email,name:account.name,provider:account.provider};
  // Sesión iniciada (decisión 0018): si falla Supabase Auth, se sigue jugando sin cuenta.
  async function session(request){
    if(!auth)return null;
    try{return await auth.current(request,readCookie)}catch(error){log('Auth sesión:',error?.message||error);return null}
  }
  // El navegador manda su identificador si lo tiene; si no, se recupera de la cookie (con su progreso) o se crea uno nuevo.
  // Con sesión iniciada manda el jugador de la cuenta: si es distinto del que tenía el navegador, se devuelve su progreso.
  async function identify(request,data){
    const sent=validPlayer(data.player),cookies=[];
    let player=sent,recovered=false,account=null;
    const current=await session(request);
    if(current){
      cookies.push(...current.cookies);account=current.account;
      if(account&&!account.player){
        try{account=await auth.link(account,sent||validPlayer(readCookie(request,PLAYER_COOKIE))||randomUUID())}catch{account={...account,player:null}}
      }
      if(account?.player&&account.player!==sent){player=account.player;recovered=true}
    }
    if(!player){const stored=validPlayer(readCookie(request,PLAYER_COOKIE));if(stored){player=stored;recovered=true}}
    player??=randomUUID();
    const body={player,recovered};if(recovered)body.progress=await progress(hash(player));
    if(auth)body.account=publicAccount(account);
    return json(200,body,{},[playerCookie(request,player),...cookies]);
  }
  // Rutas de /api/auth/: estado, codigo, verificar, salir (POST) y google, callback (GET, con redirección).
  async function authRoute(request,url,action){
    if(!auth)return json(503,{error:'El inicio de sesión no está configurado en este servidor'});
    const origin=url.origin;
    if(action==='google'){
      if(request.method!=='GET')return json(405,{error:'Usa GET'});
      if(!(await auth.providers()).google)return redirect('/?sesion=error');
      const {location,cookie:verifier}=auth.googleStart(request,origin);return redirect(location,[verifier]);
    }
    if(action==='callback'){
      if(request.method!=='GET')return json(405,{error:'Usa GET'});
      const done=[cookie(request,VERIFIER_COOKIE,'',0)];
      const tokens=await auth.exchange(url.searchParams.get('code'),readCookie(request,VERIFIER_COOKIE));
      if(!tokens)return redirect('/?sesion=error',done);
      try{await auth.link(auth.account(tokens.user),validPlayer(readCookie(request,PLAYER_COOKIE))||randomUUID())}catch{}
      return redirect('/?sesion=ok',[...done,...auth.sessionCookies(request,tokens)]);
    }
    if(request.method!=='POST')return json(405,{error:'Usa POST'});
    if(foreign(request))return json(403,{error:'Origen no permitido'});
    if(action==='estado')return json(200,{providers:await auth.providers()});
    const {data,error}=await body(request);if(error)return error;
    if(action==='codigo'){const r=await auth.sendCode(data.email);return r.status===200?json(200,{sent:true}):json(r.status,{error:r.error})}
    if(action==='verificar'){
      const r=await auth.verifyCode(data.email,data.code);if(r.status!==200)return json(r.status,{error:r.error});
      let account=auth.account(r.session.user);
      try{account=await auth.link(account,validPlayer(data.player)||validPlayer(readCookie(request,PLAYER_COOKIE))||randomUUID())}catch{}
      return json(200,{account:publicAccount(account)},{},auth.sessionCookies(request,r.session));
    }
    if(action==='salir'){
      await auth.logout(request,readCookie);
      // El dispositivo vuelve a ser anónimo con un identificador nuevo: el progreso queda en la cuenta.
      const player=randomUUID();
      return json(200,{player},{},[...clearCookies(request),playerCookie(request,player)]);
    }
    return json(404,{error:'Ruta no disponible'});
  }
  // /api/comunidad y /api/progreso: la cuenta (si hay sesión) y el hash de su jugador. Puede renovar las cookies.
  async function withAccount(request,route,data){
    const current=await session(request),account=current?.account||null;
    const player=account?.player?hash(account.player):null;
    try{
      const result=route==='progreso'?await community.progress(data,{account,player}):await community.handle(data,{account,player});
      return json(result.status,result.body,{},current?.cookies||[]);
    }catch(error){log(`API /api/${route}:`,error?.message||error);return json(503,{error:'Las preguntas de la comunidad no están disponibles ahora mismo'},{},current?.cookies||[])}
  }
  async function handle(request){
    const url=new URL(request.url);
    // En Vercel, vercel.json reescribe /api/<ruta> y /daily-content.js hacia /api?route=<ruta>.
    const route=url.searchParams.get('route');
    const path=route?(route==='daily-content.js'?'/daily-content.js':`/api/${route}`):url.pathname;
    if(path!=='/daily-content.js'&&path!=='/api'&&!path.startsWith('/api/'))return null;
    try{
      if(path==='/api/generar-dia')return await generateTomorrow(request,url);
      if(path==='/api/comunidad'||path==='/api/progreso'){
        if(request.method!=='POST')return json(405,{error:'Usa POST'});
        if(foreign(request))return json(403,{error:'Origen no permitido'});
        const {data,error}=await body(request,path==='/api/progreso'?COMMUNITY_RULES.stateBytes:MAX_BODY);if(error)return error;
        return await withAccount(request,path.slice(5),data);
      }
      if(path.startsWith('/api/auth/'))return await authRoute(request,url,path.slice(10));
      if(path==='/api/calendar')return json(200,await currentCalendar());
      if(path==='/daily-content.js')return new Response('window.DAILY_CALENDAR = '+JSON.stringify(await currentCalendar())+'; window.PILOT_DAYS = window.DAILY_CALENDAR.days;',{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
      if(path==='/api/day'){const day=await loadDay(url.searchParams.get('date')||madridDate());return day?json(200,day):json(404,{error:'No hay una edición verificada para esta fecha'})}
      if(path==='/api/answers'||path==='/api/daily-scores'||path==='/api/jugador'||path==='/api/duelo'||path==='/api/liga'||path==='/api/referido'){
        if(request.method!=='POST')return json(405,{error:'Usa POST'});
        if(foreign(request))return json(403,{error:'Origen no permitido'});
        const {data,error}=await body(request);if(error)return error;
        if(path==='/api/duelo'){
          // Si el almacén falla (por ejemplo, la tabla duels aún no existe en Supabase), el resto del juego sigue funcionando.
          try{const result=await duels.handle(data);return json(result.status,result.body)}
          catch(error){log('API /api/duelo:',error?.message||error);return json(503,{error:'Los duelos no están disponibles ahora mismo'})}
        }
        if(path==='/api/liga'){
          // Igual que los duelos: si la tabla aún no existe en Supabase, las ligas se apagan y el resto sigue.
          try{const result=await leagues.handle(data);return json(result.status,result.body)}
          catch(error){log('API /api/liga:',error?.message||error);return json(503,{error:'Las ligas no están disponibles ahora mismo'})}
        }
        if(path==='/api/referido'){
          // Igual que las ligas: si las tablas aún no existen en Supabase, el Circuito se apaga y el resto sigue.
          try{const result=await referrals.handle(data);return json(result.status,result.body)}
          catch(error){log('API /api/referido:',error?.message||error);return json(503,{error:'El Circuito de amigos no está disponible ahora mismo'})}
        }
        if(path==='/api/jugador')return await identify(request,data);
        return path==='/api/answers'?await answers(data):await dailyScores(data);
      }
      return json(404,{error:'Ruta no disponible'});
    }catch(error){log(`API ${path}:`,error?.message||error);return json(500,{error:'No se pudo procesar la solicitud'})}
  }
  return {handle,store};
}
