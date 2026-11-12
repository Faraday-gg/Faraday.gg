// Ligas de amigos (decisión 0031). Grupos pequeños (máximo 15) con una clasificación semanal, de lunes a
// domingo en hora de Madrid, hecha con la distancia media del reto diario de cada miembro.
//
// El servidor manda: las puntuaciones salen de las respuestas guardadas, nunca del navegador. Cada vez que
// alguien completa el reto de HOY (lib/api.mjs, /api/answers), se apunta su distancia media del día en
// «resultados diarios». Lo que se juega desde el archivo no se apunta, así que no cuenta para las ligas.
//
// Regla de los días sin jugar (explícita y la misma para todos):
//   - Un día ya cerrado (anterior a hoy) que un miembro no jugó cuenta como la PEOR distancia de ese día entre
//     los miembros de la liga que sí lo jugaron, y nunca menos de 10× (RULES.missed). Así saltarse un día nunca
//     sale mejor que jugarlo.
//   - Hoy solo cuenta para quien ya lo ha jugado; a medianoche se cierra y se aplica la regla anterior.
//   - La primera semana de una liga empieza el día en que se crea: los días anteriores no cuentan para nadie.
//     Quien entra después sí recibe la regla de los días sin jugar desde ese día (lo que jugó antes de entrar cuenta).
//   - La media semanal es la media de todos los días contados. Gana la media más baja. Si hay empate, gana
//     quien jugó más días y, después, quien entró antes en la liga.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {madridDate} from '../content-engine.mjs';
import {AVATAR_SLOTS} from './duelos.mjs';

export const RULES={
  maxMembers:15,   // personas por liga
  maxLeagues:10,   // ligas a la vez por jugador, para que nadie llene la tabla
  missed:10,       // un día sin jugar cuenta, como poco, como 10× (fallar por un orden de magnitud)
  nameLength:24    // caracteres del nombre de la liga
};

const PLAYER=/^[a-f0-9-]{36}$/i,CODE=/^[A-Z2-9]{6}$/,ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789',DAY=86400000;
const hash=player=>createHash('sha256').update(player).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const noon=date=>Date.parse(date+'T12:00:00Z');
export const shiftDate=(date,days)=>new Date(noon(date)+days*DAY).toISOString().slice(0,10);
// Semana de lunes a domingo que contiene una fecha (AAAA-MM-DD, ya en hora de Madrid).
export function weekOf(date){
  const start=shiftDate(date,-((new Date(noon(date)).getUTCDay()+6)%7));
  return {start,end:shiftDate(start,6),days:Array.from({length:7},(_,i)=>shiftDate(start,i))};
}
const clean=(value,max)=>(typeof value==='string'?value:'').replace(/[\u0000-\u001f<>&"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
function cleanAvatar(value){
  const avatar={};
  if(value&&typeof value==='object')for(const slot of AVATAR_SLOTS){const piece=value[slot];if(typeof piece==='string'&&/^[a-z0-9-]{1,24}$/.test(piece))avatar[slot]=piece}
  return avatar;
}

// Clasificación de una semana. members: [{hash,name,avatar,joinedAt}], results: {hash: {fecha: distancia}},
// today: fecha de hoy en Madrid; from (opcional): primer día que cuenta (el de creación de la liga).
// Solo entran quienes ya eran miembros antes de que acabara la semana.
export function standings(members,results,week,today,from=week.start){
  const inWeek=members.filter(member=>madridDate(new Date(member.joinedAt))<=week.end);
  const closed=week.days.filter(day=>day<today&&day>=from),penalty={};
  for(const day of closed){
    const played=inWeek.map(member=>results[member.hash]?.[day]).filter(Number.isFinite);
    penalty[day]=Math.max(RULES.missed,...played);
  }
  const rows=inWeek.map(member=>{
    const own=results[member.hash]||{},counted=[];
    const days=week.days.map(day=>{
      if(day>today||day<from)return null;
      if(Number.isFinite(own[day])){counted.push(own[day]);return {played:own[day]}}
      if(day<today){counted.push(penalty[day]);return {missed:penalty[day]}}
      return null; // hoy, aún sin jugar
    });
    const played=days.filter(day=>day?.played!==undefined).length;
    return {member,days,played,average:counted.length?counted.reduce((a,b)=>a+b,0)/counted.length:null};
  });
  rows.sort((a,b)=>(a.average??Infinity)-(b.average??Infinity)||b.played-a.played||a.member.joinedAt-b.member.joinedAt);
  // Puesto compartido si la media y los días jugados son iguales.
  rows.forEach((row,i)=>{const prev=rows[i-1];row.position=prev&&prev.average===row.average&&prev.played===row.played?prev.position:i+1});
  return rows;
}

// Almacén en memoria (pruebas) o en un archivo JSON (servidor local). Misma interfaz que el de Supabase (lib/stores.mjs).
export function memoryLeagues(file=null){
  let data={leagues:[],results:{}};
  if(file){try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}}
  const save=()=>{if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file)};
  const find=id=>data.leagues.find(league=>league.id===id);
  return {
    async byCode(code){const league=data.leagues.find(league=>league.code===code);return league?clone(league):null},
    async forPlayer(player){return data.leagues.filter(league=>league.members.some(member=>member.hash===player)).map(clone)},
    async create(league){
      if(data.leagues.some(other=>other.code===league.code))throw Error('Código de liga repetido');
      data.leagues.push(clone(league));save();
    },
    // 'ok' si entra, 'exists' si ya estaba (se actualizan su apodo y su avatar), 'full' si no cabe, 'missing' si la liga ya no existe.
    async addMember(league,member,max){
      const stored=find(league.id);if(!stored)return 'missing';
      const current=stored.members.find(other=>other.hash===member.hash);
      if(current){Object.assign(current,{name:member.name,avatar:member.avatar});save();return 'exists'}
      if(stored.members.length>=max)return 'full';
      stored.members.push(clone(member));save();return 'ok';
    },
    async removeMember(league,player){
      const stored=find(league.id);if(!stored)return;
      stored.members=stored.members.filter(member=>member.hash!==player);
      if(!stored.members.length)data.leagues=data.leagues.filter(other=>other!==stored);
      save();
    },
    async updateProfile(player,{name,avatar}){
      for(const league of data.leagues)for(const member of league.members)if(member.hash===player)Object.assign(member,{name,avatar});
      save();
    },
    // La primera distancia apuntada de un día es la que vale.
    async record(player,day,score){
      const own=data.results[player]??={};if(own[day]!==undefined)return;
      own[day]=score;save();
    },
    async results(players,from,to){
      const result={};
      for(const player of players)for(const [day,score] of Object.entries(data.results[player]||{}))if(day>=from&&day<=to)(result[player]??={})[day]=score;
      return result;
    }
  };
}

export function createLeagues({leagues,now=Date.now,random=Math.random}){
  const fail=(status,error)=>({status,body:{error}});
  const today=()=>madridDate(new Date(now()));
  const newCode=()=>{let code='';for(let i=0;i<6;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)];return code};
  const profile=(data,player,t)=>({hash:player,name:clean(data.name,16)||'Jugador',avatar:cleanAvatar(data.avatar),joinedAt:t});
  const readCode=value=>{const code=typeof value==='string'?value.trim().toUpperCase():'';return CODE.test(code)?code:null};

  async function table(league,week,day){
    const results=await leagues.results(league.members.map(member=>member.hash),week.start,week.end);
    return standings(league.members,results,week,day,madridDate(new Date(league.createdAt)));
  }
  const row=(entry,player)=>({name:entry.member.name,avatar:entry.member.avatar,position:entry.position,average:entry.average,played:entry.played,days:entry.days,you:entry.member.hash===player});
  // Lo que ve un miembro: la clasificación de esta semana. Nunca salen los identificadores (hash) de nadie.
  async function view(league,player){
    const day=today(),week=weekOf(day),rows=await table(league,week,day);
    return {code:league.code,name:league.name,member:true,members:league.members.length,max:RULES.maxMembers,
      week:{start:week.start,end:week.end,today:day,days:week.days,from:madridDate(new Date(league.createdAt))},missed:RULES.missed,rows:rows.map(entry=>row(entry,player))};
  }
  // Para la lista «Tus ligas»: tu puesto y quién va primero.
  async function brief(league,player){
    const day=today(),rows=await table(league,weekOf(day),day),mine=rows.find(entry=>entry.member.hash===player),leader=rows[0];
    return {code:league.code,name:league.name,members:league.members.length,position:mine?.position??null,average:mine?.average??null,
      leader:leader&&leader.average!=null?{name:leader.member.name,avatar:leader.member.avatar,you:leader.member.hash===player}:null};
  }
  // Resumen de la semana pasada: ganador con su avatar y tu puesto, en cada liga en la que ya estabas.
  async function summary(league,player){
    const last=weekOf(shiftDate(today(),-7)),rows=await table(league,last,shiftDate(last.end,1));
    const mine=rows.find(entry=>entry.member.hash===player),winner=rows[0];
    if(!mine||!winner||winner.played===0)return null; // nadie jugó: no hay nada que contar
    const winners=rows.filter(entry=>entry.position===1);
    return {code:league.code,name:league.name,week:{start:last.start,end:last.end},total:rows.length,position:mine.position,average:mine.average,played:mine.played,
      winners:winners.map(entry=>({name:entry.member.name,avatar:entry.member.avatar,average:entry.average,played:entry.played,you:entry.member.hash===player}))};
  }

  async function handle(data){
    if(typeof data.player!=='string'||!PLAYER.test(data.player))return fail(400,'Jugador no válido');
    const player=hash(data.player.toLowerCase());
    switch(data.action){
      case 'mias':{
        const mine=await leagues.forPlayer(player);
        return {status:200,body:{leagues:await Promise.all(mine.sort((a,b)=>a.createdAt-b.createdAt).map(league=>brief(league,player))),max:RULES.maxLeagues}};
      }
      case 'crear':{
        const name=clean(data.leagueName,RULES.nameLength);
        if(!name)return fail(400,'Ponle un nombre a la liga');
        if((await leagues.forPlayer(player)).length>=RULES.maxLeagues)return fail(409,`Puedes estar en ${RULES.maxLeagues} ligas como mucho. Sal de alguna para crear otra.`);
        for(let attempt=0;;attempt++){
          const t=now(),league={id:randomUUID(),code:newCode(),name,createdAt:t,members:[profile(data,player,t)]};
          try{await leagues.create(league);return {status:200,body:await view(league,player)}}catch(error){if(attempt>=2)throw error}
        }
      }
      case 'unirse':{
        const code=readCode(data.code);if(!code)return fail(400,'El código tiene 6 letras o números');
        const league=await leagues.byCode(code);if(!league)return fail(404,'No hay ninguna liga con ese código');
        const already=league.members.some(member=>member.hash===player);
        if(!already&&(await leagues.forPlayer(player)).length>=RULES.maxLeagues)return fail(409,`Puedes estar en ${RULES.maxLeagues} ligas como mucho. Sal de alguna para unirte a otra.`);
        const result=await leagues.addMember(league,profile(data,player,now()),RULES.maxMembers);
        if(result==='full')return fail(409,`La liga está completa: ya tiene ${RULES.maxMembers} personas`);
        if(result==='missing')return fail(404,'No hay ninguna liga con ese código');
        return {status:200,body:await view(await leagues.byCode(code),player)};
      }
      case 'ver':{
        const code=readCode(data.code);if(!code)return fail(400,'El código tiene 6 letras o números');
        const league=await leagues.byCode(code);if(!league)return fail(404,'No hay ninguna liga con ese código');
        if(league.members.some(member=>member.hash===player))return {status:200,body:await view(league,player)};
        // Quien llega por un enlace y aún no es miembro solo ve el nombre y cuántos son.
        return {status:200,body:{code:league.code,name:league.name,member:false,members:league.members.length,max:RULES.maxMembers,full:league.members.length>=RULES.maxMembers}};
      }
      case 'salir':{
        const code=readCode(data.code);if(!code)return fail(400,'El código tiene 6 letras o números');
        const league=await leagues.byCode(code);
        if(league?.members.some(member=>member.hash===player))await leagues.removeMember(league,player);
        return {status:200,body:{left:code}};
      }
      case 'perfil':{
        const {name,avatar}=profile(data,player,0);await leagues.updateProfile(player,{name,avatar});
        return {status:200,body:{name,avatar}};
      }
      case 'resumen':{
        const mine=await leagues.forPlayer(player),last=weekOf(shiftDate(today(),-7));
        // Solo las ligas que ya existían la semana pasada.
        const old=mine.filter(league=>madridDate(new Date(league.createdAt))<=last.end);
        return {status:200,body:{week:{start:last.start,end:last.end},leagues:(await Promise.all(old.map(league=>summary(league,player)))).filter(Boolean)}};
      }
      default:return fail(400,'Acción no válida');
    }
  }
  // Lo llama /api/answers cuando alguien completa el reto del día el mismo día. score: distancia media (1 = exacto).
  async function record(player,day,score){if(Number.isFinite(score)&&score>=1)await leagues.record(player,day,score)}
  return {handle,record};
}
