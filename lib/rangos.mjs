// Clasificatorias y rangos de los duelos 1 vs 1 (decisión 0043). Al estilo de Rocket League, Valorant o League of
// Legends: cada rango tiene tres divisiones (III → II → I) y se sube ganando puntos de rango (PR). El máximo,
// Científico, no tiene divisiones: se ordena por puntos.
//
// El servidor manda: los PR se calculan aquí, con la valoración que tenía cada jugador al empezar el duelo, y cada
// duelo solo se apunta una vez (el almacén guarda los últimos duelos de cada jugador y devuelve el mismo resultado si
// se le pide otra vez). El navegador solo pinta.
//
// Por dentro cada jugador tiene una sola cifra, rating: 100 puntos por división, desde 0 (Bronce III).
//   tier = floor(rating / 100) → rango = floor(tier / 3), división = III, II o I. Desde 2100, Científico.
import fs from 'node:fs';
import path from 'node:path';

// Las clasificatorias se desbloquean en el nivel 10, el mismo umbral que las apuestas de faradios. El nivel vive en el
// navegador (dist/progress.js) y llega con el perfil del duelo, así que el servidor lo comprueba, pero se puede falsear.
export const RANKED_MIN_LEVEL=10;
export const RANKS=[
  {id:'bronce',name:'Bronce',color:'#b0703f',line:'Todo el mundo empieza contando con los dedos.'},
  {id:'plata',name:'Plata',color:'#8d9aa8',line:'Ya sabes si algo son cientos o millones.'},
  {id:'oro',name:'Oro',color:'#d29a1e',line:'Aciertas el orden de magnitud casi siempre.'},
  {id:'calculista',name:'Calculista',color:'#1f9a8a',line:'Haces la cuenta de cabeza antes de que el rival abra la calculadora.'},
  {id:'estimador',name:'Estimador',color:'#2f74d0',line:'Lo tuyo es el ≈: no sabes la cifra, pero la clavas.'},
  {id:'doctorando',name:'Doctorando',color:'#7a4cd0',line:'Cuatro años de tesis para responder «depende», pero con intervalo de confianza.'},
  {id:'eminencia',name:'Eminencia',color:'#c43d6c',line:'Te citan en las sobremesas: «lo ha dicho una eminencia».'},
  {id:'cientifico',name:'Científico',color:'#ff5a36',line:'La cumbre: sin divisiones, solo puntos y la clasificación.'}
];
export const RULES={
  division:100,      // PR que hay que ganar para subir de división
  divisions:3,       // III, II, I
  start:300,         // valoración inicial (Plata III), oculta hasta terminar el posicionamiento
  placement:5,       // partidas de posicionamiento
  k:36,              // ganar contra alguien de tu mismo nivel da +18; perder, −18
  placementK:72,     // en el posicionamiento se mueve el doble
  scale:400,         // cada 400 de diferencia, 10 veces más probable ganar (Elo)
  minWin:6,          // ganar siempre suma algo; perder siempre resta algo
  maxChange:40,      // y nunca más de esto
  shield:3,          // partidas de colchón tras subir de división: no se puede bajar de ella
  history:30         // duelos que se recuerdan por jugador para no apuntar ninguno dos veces
};
export const TOP=(RANKS.length-1)*RULES.divisions*RULES.division; // 2100: desde aquí, Científico
const DIVISION=['III','II','I'];

// Rango a la vista a partir de la valoración: {rank, name, division, pr, color, tier, top}.
export function rankOf(rating){
  const value=Math.max(0,Math.round(rating||0));
  if(value>=TOP){const top=RANKS.at(-1);return {rank:RANKS.length-1,id:top.id,name:top.name,division:'',pr:value-TOP,color:top.color,tier:(RANKS.length-1)*RULES.divisions,top:true,label:top.name}}
  const tier=Math.floor(value/RULES.division),rank=Math.floor(tier/RULES.divisions),info=RANKS[rank],division=DIVISION[tier%RULES.divisions];
  return {rank,id:info.id,name:info.name,division,pr:value%RULES.division,color:info.color,tier,top:false,label:`${info.name} ${division}`};
}
export const tierStart=tier=>tier*RULES.division;
export const expected=(mine,rival)=>1/(1+10**((rival-mine)/RULES.scale));

// Un jugador sin partidas.
export const fresh=()=>({rating:RULES.start,games:0,wins:0,losses:0,draws:0,shield:0,peak:RULES.start});

// Aplica un resultado (score: 1 gana, 0.5 empata, 0 pierde) a la ficha de un jugador. mine y rival son las
// valoraciones al empezar el duelo (las que se vieron en pantalla). Devuelve la ficha nueva y lo que cambió.
export function applyResult(record,{score,mine,rival}){
  const before={...fresh(),...record},placing=before.games<RULES.placement,k=placing?RULES.placementK:RULES.k;
  let delta=0;
  if(score!==.5){
    const raw=Math.round(k*(score-expected(mine??before.rating,rival??before.rating)));
    delta=score===1?Math.min(RULES.maxChange*(placing?2:1),Math.max(RULES.minWin,raw)):-Math.min(RULES.maxChange*(placing?2:1),Math.max(RULES.minWin,-raw));
  }
  const fromTier=rankOf(before.rating).tier;
  let rating=Math.max(0,before.rating+delta),shield=Math.max(0,before.shield-1),shielded=false;
  // Colchón: justo después de subir de división, perder no te devuelve a la anterior.
  if(delta<0&&before.shield>0&&!placing&&rating<tierStart(fromTier)){rating=tierStart(fromTier);shielded=true}
  const toTier=rankOf(rating).tier;
  if(toTier>fromTier&&!placing)shield=RULES.shield;
  const after={rating,games:before.games+1,wins:before.wins+(score===1),losses:before.losses+(score===0),draws:before.draws+(score===.5),shield,peak:Math.max(before.peak,rating)};
  const placed=placing&&after.games>=RULES.placement;
  const change=placing&&!placed?'placement':placed?'placed':toTier>fromTier?(rankOf(rating).rank>rankOf(before.rating).rank?'rank-up':'division-up'):toTier<fromTier?(rankOf(rating).rank<rankOf(before.rating).rank?'rank-down':'division-down'):'same';
  return {record:after,outcome:{delta:rating-before.rating,from:before.rating,to:rating,change,shielded,score}};
}

// Lo que ve el navegador de un jugador.
export function publicRank(record){
  const r={...fresh(),...record},placing=r.games<RULES.placement;
  return {...(placing?{rank:null,id:'sin-rango',name:'Sin clasificar',division:'',pr:0,label:'Sin clasificar',color:'#8a8f98',tier:-1,top:false}:rankOf(r.rating)),
    rating:placing?null:r.rating,games:r.games,wins:r.wins,losses:r.losses,draws:r.draws,placing,placementLeft:Math.max(0,RULES.placement-r.games),shield:placing?0:r.shield};
}

// Almacén en memoria (pruebas) o en un archivo JSON (servidor local). Misma interfaz que el de Supabase (lib/stores.mjs).
//   get(player) -> ficha o null.  settle(player, duelId, update, profile) -> resultado (el mismo si ese duelo ya se apuntó).
//   top(limit) -> [{hash, name, avatar, rating}] de los Científicos, de más a menos puntos.
export function memoryRanks(file=null){
  let data={};
  if(file){try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}}
  const save=()=>{if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file)};
  const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
  return {
    async get(player){return clone(data[player]?.record??null)},
    async settle(player,duelId,update,profile){
      const row=data[player]??={record:fresh(),seen:{},name:'',avatar:{}};
      if(row.seen[duelId])return clone(row.seen[duelId]);
      const {record,outcome}=update(row.record);
      row.record=record;row.seen[duelId]=outcome;row.name=profile.name;row.avatar=profile.avatar;
      const keys=Object.keys(row.seen);if(keys.length>RULES.history)for(const key of keys.slice(0,keys.length-RULES.history))delete row.seen[key];
      save();return clone(outcome);
    },
    async top(limit){return Object.entries(data).filter(([,row])=>row.record.rating>=TOP&&row.record.games>=RULES.placement).sort((a,b)=>b[1].record.rating-a[1].record.rating).slice(0,limit).map(([hash,row])=>({hash,name:row.name,avatar:clone(row.avatar),rating:row.record.rating}))}
  };
}

// Motor de clasificatorias que usa lib/duelos.mjs. ranks: almacén (memoryRanks o el de Supabase).
export function createRanked({ranks}){
  return {
    // Lo que se guarda en el duelo al empezar: la valoración del jugador en ese momento y su rango a la vista.
    async snapshot(player){return publicRankWithRating(await ranks.get(player))},
    // Apunta el resultado de un duelo clasificatorio terminado. Devuelve true si ha cambiado el estado del duelo.
    // Si el almacén falla, no se marca como apuntado y se vuelve a intentar en la siguiente consulta.
    async settle(state){
      if(state.mode!=='ranked'||state.rankSettled||state.status!=='finished'||state.players.length<2||state.players.some(p=>p.bot)||!state.rounds.length)return false;
      const outcomes=[];
      for(const index of [0,1]){
        const player=state.players[index],rival=state.players[1-index];
        const score=state.winner==='draw'?.5:state.winner===index?1:0;
        const mine=player.rank?.rating??RULES.start,theirs=rival.rank?.rating??RULES.start;
        const outcome=await ranks.settle(player.hash,state.id,record=>applyResult(record,{score,mine,rival:theirs}),{name:player.name,avatar:player.avatar});
        outcomes.push({...outcome,rank:publicRank(await ranks.get(player.hash))});
      }
      state.rankResult=outcomes;state.rankSettled=true;return true;
    },
    // Tu rango y, si hay Científicos, la clasificación de la cumbre.
    async mine(player){
      const record=await ranks.get(player),top=typeof ranks.top==='function'?await ranks.top(10):[];
      const position=top.findIndex(row=>row.hash===player);
      return {status:200,body:{rank:publicRank(record),top:top.map((row,i)=>({position:i+1,name:row.name,avatar:row.avatar,pr:row.rating-TOP,you:row.hash===player})),position:position>=0?position+1:null}};
    }
  };
}
// Igual que publicRank, pero con la valoración aunque esté en posicionamiento (el servidor la necesita para el Elo).
function publicRankWithRating(record){const r={...fresh(),...record};return {...publicRank(r),rating:r.rating}}
