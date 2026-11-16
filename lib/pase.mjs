// Pase de batalla (decisión 0079). Una temporada con niveles y dos pistas de premios: la gratuita, para cualquiera con
// cuenta, y la prémium, que va incluida en la suscripción (decisiones 0076 y 0077: el mismo pago, sin cobro aparte).
// Aquí solo hay reglas y cuentas sobre `stats` (player_progress.stats); lib/comunidad.mjs las guarda y reparte los
// premios. No hay copia en el navegador: dist/pase.js pinta lo que devuelve `passView`.
//
// Cómo se avanza: cada punto de experiencia ganado durante la temporada (lib/misiones.mjs) suma al pase. Los niveles
// del pase se quedan apuntados aunque no se recojan sus premios, y los de la pista prémium se pueden recoger todos de
// golpe el día que se contrata la suscripción.
//
// stats.pass = {s: temporada, xp: experiencia del pase, free: [niveles recogidos], plus: [niveles recogidos],
//   boost: hasta cuándo dura el impulso (ms)}. stats.passOld = el de la temporada anterior, para recoger lo pendiente.

// levels = niveles de la temporada; step = experiencia que pide cada nivel; plusBonus = experiencia de más con la
// suscripción; boost = por cuánto multiplica un impulso mientras dura.
export const PASS={levels:30,step:150,plusBonus:.2,boost:2};

const coins=amount=>({kind:'coins',amount}),chest=type=>({kind:'chest',type}),item=id=>({kind:'item',id}),
  medal=id=>({kind:'medal',id}),boost=hours=>({kind:'boost',hours});
// Premios de la temporada 1, nivel a nivel: [gratis, prémium]. null = ese nivel no da nada en esa pista.
//   coins = faradios; chest = un cofre de ese tipo (dist/chests.js); item = una pieza exclusiva del pase (dist/avatar.js,
//   `pase`; se dan la de hombre y la de mujer); medal = una insignia (dist/medals.js); boost = horas de experiencia doble.
const T1=[
  [coins(30),item('top:pase-curie')],
  [chest('chispa'),coins(60)],
  [item('top:pase-atomo'),boost(24)],
  [coins(30),chest('iman')],
  [chest('iman'),coins(100)],
  [coins(40),item('hat:pase-tesla')],
  [null,chest('rayo')],
  [chest('chispa'),coins(80)],
  [coins(40),boost(24)],
  [medal('becario'),item('top:pase-darwin')],
  [null,coins(100)],
  [item('hat:pase-newton'),chest('rayo')],
  [coins(50),coins(80)],
  [null,chest('dinamo')],
  [chest('rayo'),medal('mecenas')],
  [coins(50),item('top:pase-adn')],
  [null,coins(120)],
  [boost(24),chest('rayo')],
  [coins(60),boost(48)],
  [medal('doctorado'),item('top:pase-hipatia')],
  [item('top:pase-pi'),coins(150)],
  [null,chest('dinamo')],
  [coins(60),coins(120)],
  [chest('rayo'),chest('tormenta')],
  [coins(80),medal('eureka')],
  [item('top:pase-emc2'),chest('dinamo')],
  [coins(80),boost(48)],
  [chest('dinamo'),coins(250)],
  [coins(100),chest('tormenta')],
  [medal('nobel'),item('top:pase-nobel')]
];
// Temporadas, por fechas de Madrid (las dos incluidas). Fuera de temporada el pase no suma.
export const SEASONS=[{id:'t1',n:1,name:'Pioneros de la ciencia',from:'2026-11-16',to:'2026-12-31',rewards:T1}];
export const TRACKS=['free','plus'];
export const seasonAt=day=>SEASONS.find(season=>season.from<=day&&day<=season.to)||null;
export const seasonOf=id=>SEASONS.find(season=>season.id===id)||null;
// Nivel del pase con esa experiencia: se empieza en el 1, y cada `step` sube uno, hasta `levels`.
export const passLevel=xp=>Math.min(PASS.levels,1+Math.floor(Math.max(0,xp||0)/PASS.step));
// El premio de un nivel en una pista, o null.
export const rewardOf=(season,level,track)=>season?.rewards[level-1]?.[track==='plus'?1:0]||null;

const levels=list=>Array.isArray(list)?[...new Set(list.filter(level=>Number.isInteger(level)&&level>=1&&level<=PASS.levels))]:[];
const tidy=(pass,id)=>({s:id,xp:Number.isFinite(pass?.xp)&&pass.xp>0?Math.floor(pass.xp):0,free:levels(pass?.free),plus:levels(pass?.plus),boost:Number.isFinite(pass?.boost)?pass.boost:0});
// Deja en `stats` el pase de la temporada de `today`. Al empezar una temporada nueva, el de la anterior pasa a
// stats.passOld (solo se recuerda uno). Fuera de temporada no toca nada. Devuelve la temporada en curso o null.
export function passBox(stats,today){
  const season=seasonAt(today);if(!season)return null;
  if(stats.pass?.s!==season.id){
    if(stats.pass&&seasonOf(stats.pass.s))stats.passOld=tidy(stats.pass,stats.pass.s);
    stats.pass=tidy(null,season.id);
  }else stats.pass=tidy(stats.pass,season.id);
  return season;
}
// Suma al pase la experiencia ganada. plus = tiene la suscripción; now = ahora (ms), para el impulso. Devuelve lo sumado.
export function passGain(stats,xp,{today,now,plus=false}){
  if(!(xp>0)||!passBox(stats,today))return 0;
  const gained=Math.round(xp*(stats.pass.boost>now?PASS.boost:1)*(plus?1+PASS.plusBonus:1));
  stats.pass.xp+=gained;return gained;
}
// Si un premio se puede recoger: el nivel está alcanzado, la pista da algo, no está recogido y, en la prémium, hay suscripción.
export function claimable(pass,level,track,plus){
  const season=seasonOf(pass?.s);
  return !!season&&TRACKS.includes(track)&&Number.isInteger(level)&&level>=1&&level<=passLevel(pass.xp)&&!!rewardOf(season,level,track)&&!pass[track].includes(level)&&(track==='free'||plus);
}
// Todo lo que se puede recoger ahora: [{level, track}], por orden de nivel.
export function claimables(pass,plus){
  const list=[];
  for(let level=1;level<=PASS.levels;level++)for(const track of TRACKS)if(claimable(pass,level,track,plus))list.push({level,track});
  return list;
}
// Recoge un premio: lo apunta y devuelve {level, track, ref, ...premio}, o null si no se puede. Un impulso empieza en
// el momento (o alarga el que ya hubiera) en la temporada en curso.
export function passClaim(stats,pass,level,track,{plus,now}){
  if(!claimable(pass,level,track,plus))return null;
  pass[track].push(level);
  const reward=rewardOf(seasonOf(pass.s),level,track);
  if(reward.kind==='boost'&&stats.pass)stats.pass.boost=Math.max(stats.pass.boost||0,now)+reward.hours*3600000;
  return {level,track,ref:`${pass.s}:${track}:${level}`,...reward};
}
const DAY=86400000;
// Lo que pinta el navegador. stats = null para quien no tiene cuenta: la temporada y sus premios, sin avance.
export function passView(stats,{today,now,plus=false}){
  const season=seasonAt(today);if(!season)return {season:null};
  const pass=stats?.pass?.s===season.id?tidy(stats.pass,season.id):tidy(null,season.id),level=passLevel(pass.xp),top=level>=PASS.levels;
  const cell=(number,track)=>{
    const reward=rewardOf(season,number,track);if(!reward)return null;
    const state=pass[track].includes(number)?'claimed':number>level?'locked':track==='plus'&&!plus?'waiting':'ready';
    return {...reward,state};
  };
  const track=season.rewards.map((_,index)=>({level:index+1,free:cell(index+1,'free'),plus:cell(index+1,'plus')}));
  const count=(name,state)=>track.filter(row=>row[name]?.state===state).length;
  const old=stats?.passOld&&seasonOf(stats.passOld.s)?{id:stats.passOld.s,name:seasonOf(stats.passOld.s).name,pending:claimables(tidy(stats.passOld,stats.passOld.s),plus).length}:null;
  return {
    season:{id:season.id,n:season.n,name:season.name,from:season.from,to:season.to,
      // days = días que quedan después de hoy (0 = termina hoy).
      days:Math.max(0,Math.round((Date.parse(season.to+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/DAY))},
    account:!!stats,plus,levels:PASS.levels,step:PASS.step,bonus:PASS.plusBonus,xp:pass.xp,level,
    into:top?PASS.step:pass.xp-(level-1)*PASS.step,
    boost:pass.boost>now?pass.boost:null,boostBy:PASS.boost,
    // ready = para recoger ya; waiting = niveles alcanzados de la pista prémium que esperan a la suscripción.
    ready:count('free','ready')+count('plus','ready'),waiting:count('plus','waiting'),
    track,...(old?.pending?{previous:old}:{})
  };
}
