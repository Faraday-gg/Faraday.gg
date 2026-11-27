// Premios en faradios que calcula el servidor (decisión 0058, segunda entrega de la fase 1 de la decisión 0055).
// De momento, completar el reto del día y completar un reto del archivo. El servidor los saca de lo que ya guarda:
// las respuestas (answers) y la distancia media del reto jugado el mismo día (daily_results, la de las ligas).
// Las cifras son las de dist/progress.js (REWARD), que las usa para los jugadores sin cuenta y para enseñar el aviso;
// tests/premios.test.mjs avisa si dejan de coincidir.
import {gameStakes} from './apuestas.mjs';

export const PRIZES={
  todayCoins:20,                    // completar el reto de hoy
  accuracy:[[1.5,15],[2,10],[3,5]], // extra por precisión: distancia media por debajo de cada límite
  streakCoins:2,streakCap:7,        // extra por día de racha, hasta 7 días
  archiveCoins:5                    // completar un reto del archivo
};
// Duelos (decisión 0059): lo que da cada resultado; los `full` primeros premios del día van enteros y los siguientes,
// al `capped`. Contra Faraday-bot solo se paga el primero del día. Abandonar no da nada. Cifras de dist/progress.js
// (REWARD.duel) y dist/duel.js (DAILY_FULL, CAPPED_FACTOR).
export const DUEL={win:15,draw:8,loss:5,full:3,capped:.25};
// Traza: solo la partida diaria de tres gráficas. Mismo premio con y sin Plus (decisión 0095).
export const TREND_PRIZES=[{min:2700,amount:35,chest:'chispa'},{min:2400,amount:25,chest:null},
  {min:1800,amount:15,chest:null},{min:0,amount:10,chest:null}];
export const trendPrize=score=>TREND_PRIZES.find(tier=>Number.isInteger(score)&&score>=tier.min&&score<=3000)||null;
// Protector de racha (decisiones 0056 y 0069): si ayer no se jugó el reto y la racha era de `from` días o más, se puede
// pagar `price` para que ese día no la rompa. keep = cuántos días protegidos se recuerdan.
export const SHIELD={price:150,from:3,keep:10};
// Días hacia atrás que hay que mirar para contar la racha: los que cuentan más los protegidos que puede haber en medio.
export const STREAK_WINDOW=PRIZES.streakCap+SHIELD.keep;
export const DUEL_REASONS=['duelos','duelos-bot'];
const DAY=86400000,shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*DAY).toISOString().slice(0,10);

// Faradios por completar el reto del día con esa distancia media y esa racha (días seguidos, contando este).
export function todayPrize(score,streak){
  const bonus=(PRIZES.accuracy.find(([limit])=>score<limit)||[0,0])[1];
  return PRIZES.todayCoins+bonus+Math.min(Math.max(1,streak),PRIZES.streakCap)*PRIZES.streakCoins;
}
// Días seguidos con el reto del día jugado, acabando en `date`. `results` = {fecha: distancia} del jugador.
// shields = días protegidos (decisión 0069): hacen de puente, la racha no se rompe en ellos, pero no suman.
export function streakAt(results,date,shields=[]){
  let count=0;
  for(let back=0;count<PRIZES.streakCap&&back<STREAK_WINDOW;back++){
    const day=shift(date,-back);
    if(results[day]!==undefined)count++;else if(!shields.includes(day))break;
  }
  return count;
}

// Devuelve la función que dice qué premio le toca a un jugador por una jornada: {reason:'reto'|'archivo', amount} o null
// si no la ha completado. Solo mira lo que el servidor guardó cuando el jugador respondió.
//   loadDay(date) -> jornada con sus preguntas; guesses(player) -> {idPregunta: cifra};
//   results(player, from, to) -> {fecha: distancia}; record(player, date, score) apunta la distancia; today() -> fecha de Madrid.
// shields = días protegidos del jugador: cuentan para la racha como si se hubieran jugado. El premio lleva también la
// racha (`streak`), que es la misma que usan los cofres de racha.
export function createPrizes({loadDay,guesses,results,record,today}){
  return async function prize(player,date,shields=[]){
    const now=today();
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>now)return null;
    const day=await loadDay(date);if(!day)return null;
    let own=await results(player,shift(date,-(STREAK_WINDOW-1)),date);
    if(own[date]===undefined){
      const answered=await guesses(player),mine=day.questions.map(question=>answered[question.id]);
      if(!mine.every(Number.isFinite))return null;
      // Completado otro día: es un reto del archivo.
      if(date!==now)return {reason:'archivo',amount:PRIZES.archiveCoins};
      // Completado hoy, pero su distancia aún no estaba apuntada: se apunta ahora.
      const score=day.questions.reduce((sum,question,i)=>sum+Math.max(mine[i]/question.answer,question.answer/mine[i]),0)/day.questions.length;
      await record(player,date,score);own={...own,[date]:score};
    }
    const streak=streakAt(own,date,shields);
    return {reason:'reto',amount:todayPrize(own[date],streak),streak};
  };
}

// Faradios de un duelo con ese resultado ('win', 'draw' o 'loss'), habiendo cobrado ya `paid` duelos hoy.
export function duelCoins(result,paid){return Math.round(DUEL[result]*(paid>=DUEL.full?DUEL.capped:1))}

// Devuelve la función que dice qué premio le toca a un jugador por un duelo: {reason, amount} (amount 0 si no hay nada
// que cobrar: abandonó, ya cobró hoy su duelo contra el bot o el juego no paga faradios) o null si el duelo no existe, no
// ha terminado o no es suyo.
//   duel(id) -> estado del duelo guardado (lib/duelos.mjs) o null; paid(player, reasons) -> premios ya cobrados hoy.
export function createDuelPrizes({duel,paid}){
  return async function duelPrize(player,id){
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return null;
    const state=await duel(id.toLowerCase());
    if(!state||state.status!=='finished'||state.players.length<(state.size||2)||state.reason==='cancelado'||state.winner===null)return null;
    const me=state.players.findIndex(one=>one.hash===player);if(me<0)return null;
    // Duelo de tres (decisión 0082): gana quien queda arriba, empatan los que comparten el primer puesto y el resto pierde. Nunca hay bot.
    const three=state.size===3,bot=!three&&!!state.players[1-me].bot,reason=bot?'duelos-bot':'duelos';
    // result, abandoned, bot y rounds son lo que necesita lib/misiones.mjs para la experiencia y las misiones.
    const result=three?(state.winners?.includes(me)?state.winners.length>1?'draw':'win':'loss'):state.winner==='draw'?'draw':state.winner===me?'win':'loss',
      abandoned=three?!!state.players[me].left:state.reason==='abandono'&&state.winner===1-me;
    const info={reason,result,abandoned,bot,rounds:state.rounds.length,at:state.createdAt};
    if(abandoned)return {...info,amount:0};
    // Un duelo de un juego sin faradios (lib/apuestas.mjs, NO_STAKES: hoy, Archivo Vivo) no paga nada, se gane o se pierda.
    // Sigue contando para la experiencia y las misiones, que salen de `result`.
    if(!gameStakes(state.game))return {...info,amount:0};
    if(bot&&await paid(player,['duelos-bot'])>0)return {...info,amount:0};
    return {...info,amount:duelCoins(result,await paid(player,DUEL_REASONS))};
  };
}
