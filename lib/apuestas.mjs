// Apuestas en los duelos (decisión 0044), lado del servidor. Los faradios viven en el navegador (decisión 0024), así que el
// servidor no cobra ni paga nada: solo guarda qué nivel de apuesta trae cada jugador, para que su rival lo vea junto al
// nombre, y lo anula en los duelos contra Faraday-bot. Las cantidades y el cobro están en dist/bets-rules.js; la prueba
// tests/apuestas.test.mjs comprueba que esta lista y la del navegador coinciden.
export const BET_LEVELS={chispazo:10,calambre:12,'alto-voltaje':15};

// Nivel de apuesta que trae el jugador, o null si no es válido o aún no tiene nivel para él.
export function betTier(value,level){
  return typeof value==='string'&&Object.hasOwn(BET_LEVELS,value)&&Number.isInteger(level)&&level>=BET_LEVELS[value]?value:null;
}
// Lo que se enseña: contra el bot no se apuesta.
export const visibleBet=(state,player)=>state.players.some(p=>p.bot)?null:player.bet||null;

// Apuestas en bote (decisión 0060): con cuenta, la apuesta ya no es contra la banca, sino entre los dos jugadores, y la
// cobra y la paga el servidor. Se juega la más baja de las dos apuestas; quien gana se lleva el bote menos BET_RAKE, que
// se destruye. Las cantidades son las de dist/bets-rules.js (tests/apuestas.test.mjs comprueba que coinciden).
export const BET_AMOUNTS={chispazo:25,calambre:60,'alto-voltaje':150};
export const BET_RAKE=.1;   // parte del bote que se destruye
export const BET_CAP=5;     // duelos con apuesta al día
// Lo que pone cada jugador en el bote de un duelo: la apuesta más baja de las dos, o 0 si alguno no apuesta o hay bot.
export function betStake(state){
  if(!state||state.players.length<2||state.players.some(player=>player.bot))return 0;
  const [a,b]=state.players.map(player=>BET_AMOUNTS[player.bet]||0);
  return a&&b?Math.min(a,b):0;
}
// Solo se puede entrar en el bote mientras se juega la primera pregunta: después ya se sabe cómo va el duelo.
export const betOpen=state=>state.status==='playing'&&state.rounds.length===1&&state.rounds[0].resolvedAt==null;
// Resultado de un duelo terminado para el jugador `me` (0 o 1): 'won', 'lost', 'draw' o 'void' (cancelado). Abandonar es perder.
export function betResult(state,me){
  if(state.reason==='cancelado'||state.winner===null)return 'void';
  return state.winner==='draw'?'draw':state.winner===me?'won':'lost';
}
// Lo que cobra un jugador que puso `stake` en el bote: ganando, el bote menos la comisión; en empate o anulado, lo suyo.
export function betPayout(result,stake){
  return result==='won'?2*stake-Math.round(2*stake*BET_RAKE):result==='lost'?0:stake;
}
