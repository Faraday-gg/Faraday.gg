// Experiencia, nivel y misiones que lleva el servidor (decisión 0061, entrega 3c de la fase 1 de la decisión 0055).
// Aquí solo hay reglas y cuentas, sin almacén: lib/comunidad.mjs guarda el resultado (player_progress.xp y .stats).
// Son las mismas reglas que dist/progress.js y dist/duel.js, que siguen pintando el progreso y dando los cofres;
// tests/misiones.test.mjs avisa si dejan de coincidir.
//
// El servidor se entera de tres cosas, y de ahí sale todo: cada respuesta (addAnswer), cada jornada completada (addDay)
// y cada duelo terminado (addDuel). Las misiones se recogen con claim.
export const XP={answer:5,today:30,archive:10,mission:10,levelCoins:30,
  duel:{win:100,firstWin:50,streakStep:10,streakMax:50,draw:60,loss:40,round:10,full:3,capped:.25,bot:.5}};
// Economía nueva (decisiones 0056 y 0066). DAY_SET = faradios por recoger las tres misiones del día (antes daba un cofre
// Chispa). DAILY_CAP = faradios que se pueden ganar jugando en un día; cuentan los motivos de CAPPED. Los cofres, el
// premio por nivel, los referidos y las apuestas no cuentan.
export const DAY_SET=40,DAILY_CAP=400,CAPPED=['reto','archivo','duelos','duelos-bot','misiones'];
// Cada nivel pide 100 XP más que el anterior (nivel 2 a los 100 XP, nivel 3 a los 300, nivel 4 a los 600…).
export const levelOf=xp=>Math.floor((1+Math.sqrt(1+Math.max(0,xp)/12.5))/2);
// La experiencia que se acepta la primera vez, de la que declara el navegador (nivel 30, más o menos).
export const FIRST_XP=45000;

// count = el contador que mide cada misión; goal = cuánto hace falta; coins = lo que da al recogerla.
export const MISSIONS={
  'reto-hoy':{goal:1,coins:20,count:'today'},'cerca-2':{goal:1,coins:15,count:'near2'},'cerca-125':{goal:1,coins:25,count:'near125'},
  'seis':{goal:6,coins:20,count:'answers'},'archivo':{goal:1,coins:15,count:'archive'},'duelo':{goal:1,coins:15,count:'duels'},
  'duelo-gana':{goal:1,coins:25,count:'wins'},
  'sem-retos':{goal:5,coins:80,count:'today'},'sem-cerca':{goal:10,coins:60,count:'near2'},'sem-duelos':{goal:3,coins:80,count:'wins'},
  'sem-jugar':{goal:5,coins:60,count:'duels'}
};
const DAILY=['cerca-2','cerca-125','seis','archivo','duelo','duelo-gana'],WEEKLY=['sem-retos','sem-cerca','sem-duelos','sem-jugar'];
// El mismo sorteo que dist/progress.js: las misiones de cada día y cada semana salen de la fecha, iguales para todos.
export function pick(pool,count,seed){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);const list=[...pool];for(let i=list.length-1;i>0;i--){h=Math.imul(h^h>>>13,1274126177);const j=(h>>>0)%(i+1);[list[i],list[j]]=[list[j],list[i]]}return list.slice(0,count)}
const shift=(day,days)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export const mondayOf=day=>shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
export const dailyIds=day=>['reto-hoy',...pick(DAILY,2,day)];
export const weeklyIds=day=>pick(WEEKLY,3,mondayOf(day));
// Cambiar una misión por otra (decisiones 0056 y 0069) cuesta SWAP_PRICE. Cada periodo guarda sus cambios en `swap`
// ({la que tocaba: la nueva}); dayIds y weekIds son las misiones de un jugador, con sus cambios hechos.
export const SWAP_PRICE=30;
const swapped=(period,ids)=>ids.map(id=>period.swap?.[id]||id);
export const dayIds=(stats,day)=>swapped(stats.day,dailyIds(day));
export const weekIds=(stats,day)=>swapped(stats.week,weeklyIds(day));

const KEEP=150;
// Deja los contadores en el día y la semana de `today` (fecha de Madrid). Lo que venga roto se descarta.
export function roll(stats,today){
  const s=stats&&typeof stats==='object'&&stats.v===1?stats:{v:1},week=mondayOf(today);
  const period=(value,key)=>value&&value.key===key&&value.c&&Array.isArray(value.claimed)?value:{key,c:{},claimed:[]};
  s.day=period(s.day,today);s.week=period(s.week,week);
  if(!Array.isArray(s.seen))s.seen=[];
  if(!s.duel||s.duel.day!==today)s.duel={...(s.duel||{}),day:today,count:0};
  if(!Number.isInteger(s.duel.streak))s.duel.streak=0;
  return s;
}
const bump=(s,counter,amount=1)=>{for(const period of [s.day,s.week])period.c[counter]=(period.c[counter]||0)+amount};
export const once=(s,key)=>{if(s.seen.includes(key))return false;s.seen.push(key);if(s.seen.length>KEEP)s.seen.splice(0,s.seen.length-KEEP);return true};

// Una respuesta a `factor` veces de la cifra. Devuelve la experiencia ganada, o 0 si esa pregunta ya estaba contada.
export function addAnswer(stats,{question,factor}){
  if(!once(stats,'p:'+question))return 0;
  bump(stats,'answers');if(factor<2)bump(stats,'near2');if(factor<1.25)bump(stats,'near125');
  return XP.answer;
}
// Una jornada completada: kind = 'reto' (la de hoy) o 'archivo'. Quien llama se encarga de que solo cuente una vez.
export function addDay(stats,kind){
  bump(stats,kind==='reto'?'today':'archive');
  return kind==='reto'?XP.today:XP.archive;
}
// Un duelo terminado. Devuelve la experiencia ganada, o null si ese duelo ya estaba contado.
// result = 'win', 'draw' o 'loss'; abandoned = lo abandonó este jugador; bot = contra Faraday-bot; rounds = rondas jugadas.
export function addDuel(stats,{id,result,abandoned,bot,rounds}){
  if(!once(stats,'d:'+id))return null;
  const d=stats.duel,rule=XP.duel;let xp=0;
  if(result==='win'){
    d.streak++;xp+=rule.win;
    if(d.lastWin!==d.day){xp+=rule.firstWin;d.lastWin=d.day}
    if(d.streak>1)xp+=Math.min(rule.streakMax,(d.streak-1)*rule.streakStep);
  }else if(result==='draw')xp+=rule.draw;
  else{d.streak=0;if(!abandoned)xp+=rule.loss}
  if(rounds&&!abandoned)xp+=rounds*rule.round;
  xp=Math.round(xp*(d.count>=rule.full?rule.capped:1)*(bot?rule.bot:1));
  if(!abandoned){d.count++;bump(stats,'duels');if(result==='win')bump(stats,'wins')}
  return xp;
}
// Cómo van las misiones de hoy y de la semana: [{id, scope, goal, coins, progress, done, claimed}].
export function missions(stats,today){
  const list=(ids,period,scope)=>ids.map(id=>{const mission=MISSIONS[id],progress=Math.min(mission.goal,period.c[mission.count]||0);return {id,scope,goal:mission.goal,coins:mission.coins,progress,done:progress>=mission.goal,claimed:period.claimed.includes(id)}});
  return [...list(dayIds(stats,today),stats.day,'day'),...list(weekIds(stats,today),stats.week,'week')];
}
// Por cuáles se puede cambiar la misión `id`: {pool, ref} o null si no se puede cambiar. No se cambia la del reto de
// hoy, ni una completada o recogida, ni una que ya salió de un cambio. La nueva no puede ser una que ya esté, ni una
// que ya se cambió, ni una que saldría completada.
export function swapOptions(stats,id,today){
  const mission=missions(stats,today).find(one=>one.id===id);
  if(!mission||mission.done||mission.claimed||id==='reto-hoy')return null;
  const day=mission.scope==='day',period=day?stats.day:stats.week,swap=period.swap||{};
  if(Object.values(swap).includes(id))return null;
  const current=day?dayIds(stats,today):weekIds(stats,today);
  const pool=(day?DAILY:WEEKLY).filter(other=>!current.includes(other)&&!Object.hasOwn(swap,other)&&(period.c[MISSIONS[other].count]||0)<MISSIONS[other].goal);
  return {pool,ref:period.key+':'+id};
}
// Cambia la misión `id` por `to`. Devuelve si se pudo.
export function swapMission(stats,id,to,today){
  const options=swapOptions(stats,id,today);if(!options||!options.pool.includes(to))return false;
  const period=MISSIONS[id]&&DAILY.includes(id)?stats.day:stats.week;period.swap={...(period.swap||{}),[id]:to};
  return true;
}
// Recoge una misión completada. Devuelve {coins, xp, ref} o null si no es de hoy o de esta semana, no está completa o ya se recogió.
export function claim(stats,id,today){
  const mission=missions(stats,today).find(one=>one.id===id);
  if(!mission||!mission.done||mission.claimed)return null;
  const period=mission.scope==='day'?stats.day:stats.week;period.claimed.push(id);
  return {coins:mission.coins,xp:XP.mission,ref:period.key+':'+id};
}
