// Premios en faradios que calcula el servidor (decisión 0058, segunda entrega de la fase 1 de la decisión 0055).
// De momento, completar el reto del día y completar un reto del archivo. El servidor los saca de lo que ya guarda:
// las respuestas (answers) y la distancia media del reto jugado el mismo día (daily_results, la de las ligas).
// Las cifras son las de dist/progress.js (REWARD), que las usa para los jugadores sin cuenta y para enseñar el aviso;
// tests/premios.test.mjs avisa si dejan de coincidir.
export const PRIZES={
  todayCoins:20,                    // completar el reto de hoy
  accuracy:[[1.5,15],[2,10],[3,5]], // extra por precisión: distancia media por debajo de cada límite
  streakCoins:2,streakCap:7,        // extra por día de racha, hasta 7 días
  archiveCoins:5                    // completar un reto del archivo
};
const DAY=86400000,shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*DAY).toISOString().slice(0,10);

// Faradios por completar el reto del día con esa distancia media y esa racha (días seguidos, contando este).
export function todayPrize(score,streak){
  const bonus=(PRIZES.accuracy.find(([limit])=>score<limit)||[0,0])[1];
  return PRIZES.todayCoins+bonus+Math.min(Math.max(1,streak),PRIZES.streakCap)*PRIZES.streakCoins;
}
// Días seguidos con el reto del día jugado, acabando en `date`. `results` = {fecha: distancia} del jugador.
export function streakAt(results,date){
  let count=0;
  while(count<PRIZES.streakCap&&results[shift(date,-count)]!==undefined)count++;
  return count;
}

// Devuelve la función que dice qué premio le toca a un jugador por una jornada: {reason:'reto'|'archivo', amount} o null
// si no la ha completado. Solo mira lo que el servidor guardó cuando el jugador respondió.
//   loadDay(date) -> jornada con sus preguntas; guesses(player) -> {idPregunta: cifra};
//   results(player, from, to) -> {fecha: distancia}; record(player, date, score) apunta la distancia; today() -> fecha de Madrid.
export function createPrizes({loadDay,guesses,results,record,today}){
  return async function prize(player,date){
    const now=today();
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>now)return null;
    const day=await loadDay(date);if(!day)return null;
    let own=await results(player,shift(date,-(PRIZES.streakCap-1)),date);
    if(own[date]===undefined){
      const answered=await guesses(player),mine=day.questions.map(question=>answered[question.id]);
      if(!mine.every(Number.isFinite))return null;
      // Completado otro día: es un reto del archivo.
      if(date!==now)return {reason:'archivo',amount:PRIZES.archiveCoins};
      // Completado hoy, pero su distancia aún no estaba apuntada: se apunta ahora.
      const score=day.questions.reduce((sum,question,i)=>sum+Math.max(mine[i]/question.answer,question.answer/mine[i]),0)/day.questions.length;
      await record(player,date,score);own={...own,[date]:score};
    }
    return {reason:'reto',amount:todayPrize(own[date],streakAt(own,date))};
  };
}
