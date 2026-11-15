// Cofres que lleva el servidor (decisión 0063, entrega 4b de la fase 1 de la decisión 0055): cuántos tiene sin abrir
// cada jugador con cuenta, cuándo gana uno y el sorteo al abrirlo. Las reglas de los cofres (qué trae cada uno, las
// probabilidades, el sorteo) son las de dist/chests.js, que se carga tal cual, como el catálogo (lib/catalogo.mjs).
// Aquí solo hay cuentas sobre `stats` (player_progress.stats); lib/comunidad.mjs lo guarda y reparte los premios.
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const page={};page.window=page;vm.createContext(page);
  vm.runInContext(fs.readFileSync(new URL('../dist/chests.js',import.meta.url),'utf8'),page,{filename:'dist/chests.js'});
  return page.Chests;
}
let chests=null,problem=null;
try{chests=load()}catch(error){problem=error}
export const Chests=chests;
export const chestProblem=problem;

// Lo que carga la batería cada cosa (dist/progress.js, REWARD.charge, y dist/duel.js); al llegar a `full`, un cofre Chispa.
export const CHARGE={today:40,archive:10,duel:20,duelCapped:5,full:100};
// Cofres de cada tipo que se aceptan, como mucho, de los que declara el navegador la primera vez.
export const FIRST_CHESTS=30;
const shift=(day,days)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
const whole=(value,max)=>Number.isInteger(value)&&value>0?Math.min(value,max):0;

// Deja en `stats` lo que hace falta para los cofres. La primera vez (`saved` = progreso que declara el navegador) parte
// de los cofres sin abrir, la batería, la mala suerte y la racha que ya tenía, con tope.
// limits = topes de lo declarado: cuántos cofres en total y cuánta racha (decisión 0065).
export function chestBox(stats,saved=null,limits={chests:Infinity,streak:Infinity}){
  if(!stats.chests||typeof stats.chests!=='object'){
    stats.chests={};
    let left=limits.chests;
    for(const type of Chests.TYPES){stats.chests[type]=Math.min(left,whole(saved?.chests?.[type],FIRST_CHESTS));left-=stats.chests[type]}
    stats.charge=whole(saved?.charge,CHARGE.full-1);stats.pity=whole(saved?.pity,Chests.PITY);
    stats.streak={count:whole(saved?.streak?.count,Math.min(10000,limits.streak)),last:typeof saved?.streak?.last==='string'?saved.streak.last.slice(0,10):''};
    stats.opened=0;
    // Circuito de amigos (decisión 0064): si ya recibió el cofre Tormenta de las 3 conexiones y los días de corriente
    // compartida que ya cargó, para no dárselos otra vez.
    stats.storm=saved?.circuito?.storm===true;stats.current={};
    for(const key of Object.keys(saved?.circuito?.current||{}).slice(0,200))if(/^[0-9a-f]{12}:\d{4}-\d{2}-\d{2}$/.test(key))stats.current[key]=1;
  }
  for(const type of Chests.TYPES)if(!Number.isInteger(stats.chests[type])||stats.chests[type]<0)stats.chests[type]=0;
  if(!stats.streak||typeof stats.streak!=='object')stats.streak={count:0,last:''};
  return stats;
}
export const grant=(stats,type,count=1)=>{stats.chests[type]=(stats.chests[type]||0)+count};
// Carga la batería; cada vez que se llena da un cofre Chispa y lo que sobra se conserva.
export function charge(stats,amount){stats.charge=(stats.charge||0)+amount;while(stats.charge>=CHARGE.full){stats.charge-=CHARGE.full;grant(stats,'chispa')}}
// Apunta el reto del día `day` en la racha y da el cofre del hito, si toca. Devuelve el tipo de cofre o null.
export function streakDay(stats,day){
  const streak=stats.streak;if(streak.last===day)return null;
  streak.count=streak.last===shift(day,-1)?streak.count+1:1;streak.last=day;
  const prize=Chests.streakChest(streak.count);if(prize)grant(stats,prize);
  return prize;
}
// Cofre por subir al nivel `level`.
export const levelChest=(stats,level)=>grant(stats,Chests.levelChest(level));
// Cofre por recoger las tres misiones de la semana (Rayo), una vez por periodo. Las tres del día ya no dan cofre, sino
// faradios (decisión 0066).
export function setChest(period,ids,scope,stats){
  if(period.chest||!ids.every(id=>period.claimed.includes(id)))return null;
  period.chest=true;const type=scope==='day'?'chispa':'rayo';grant(stats,type);return type;
}
// Lo que se enseña al navegador.
export const chestState=stats=>({chests:{...stats.chests},charge:stats.charge||0,streak:stats.streak?.count||0});
