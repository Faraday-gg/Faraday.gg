// Apuestas en los duelos (decisión 0041), lado del servidor. Los faradios viven en el navegador (decisión 0024), así que el
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
