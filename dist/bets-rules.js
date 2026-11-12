// Apuestas en los duelos (decisión 0041): reglas y cuentas, sin pantalla ni almacenamiento, para poder probarlas con Node
// (tests/apuestas.test.mjs). bets.js pone el selector, guarda el registro en el navegador y mueve los faradios con progress.js.
//
// Cada jugador apuesta lo suyo contra la «banca», no contra su rival: los faradios solo viven en el navegador de cada uno
// (decisión 0024), así que no hay un bote común que el servidor pueda guardar. Gana: recupera la apuesta y otro tanto.
// Pierde (o abandona): la pierde. Empate: la recupera. La apuesta se cobra al empezar el duelo, así que cerrar la
// pestaña o abandonar no la salva.
(root=>{
  // Se desbloquean por nivel: la primera en el 10, como pidió Luis, y las más altas cuando ya se tiene más rodaje.
  // Las cantidades salen de la economía actual: un duelo ganado da 15 ≈, un día de juego 100–150 ≈, un cofre Chispa
  // cuesta 120 ≈ y uno Tormenta 1.100 ≈. Lo más que se puede perder en un día es 5 × 150 = 750 ≈.
  const TIERS={
    chispazo:{name:'Chispazo',amount:25,level:10,hint:'Para calentar'},
    calambre:{name:'Calambre',amount:60,level:12,hint:'Ya pica'},
    'alto-voltaje':{name:'Alto voltaje',amount:150,level:15,hint:'Solo para valientes'}
  };
  const IDS=Object.keys(TIERS);
  const UNLOCK=TIERS[IDS[0]].level;
  // Como mucho, cinco duelos con apuesta al día (hora de Madrid). Limita lo que se puede perder y el farmeo entre
  // dos navegadores propios. Poner DAILY_CAP = 0 desactiva las apuestas.
  const DAILY_CAP=5;
  // Lo que se guarda de cada duelo: tier, amount, status (open, won, lost, draw, void) y delta (lo ganado o perdido al final).
  const KEEP=40;

  const tier=id=>Object.hasOwn(TIERS,id)?TIERS[id]:null;
  const unlocked=(id,level)=>!!tier(id)&&Number.isFinite(level)&&level>=tier(id).level;
  const empty=()=>({choice:'',day:'',count:0,duels:{}});
  // Arregla lo que venga del almacenamiento: si algo no cuadra, se descarta sin romper el resto.
  function normalize(raw){
    const ledger=empty();if(!raw||typeof raw!=='object')return ledger;
    if(tier(raw.choice))ledger.choice=raw.choice;
    if(typeof raw.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.day))ledger.day=raw.day;
    if(Number.isInteger(raw.count)&&raw.count>=0)ledger.count=raw.count;
    if(raw.duels&&typeof raw.duels==='object')for(const [id,entry] of Object.entries(raw.duels)){
      if(!entry||!tier(entry.tier)||!['open','won','lost','draw','void'].includes(entry.status))continue;
      ledger.duels[id]={tier:entry.tier,amount:TIERS[entry.tier].amount,status:entry.status,delta:Number.isFinite(entry.delta)?entry.delta:0,at:Number.isFinite(entry.at)?entry.at:0};
    }
    return ledger;
  }
  const usedToday=(ledger,day)=>ledger.day===day?ledger.count:0;
  // ¿Se puede apostar este nivel ahora? reason: 'nivel', 'saldo' o 'tope'.
  function check(id,{level,coins,ledger,day}){
    const t=tier(id);if(!t)return {ok:false,reason:'nivel'};
    if(!unlocked(id,level))return {ok:false,reason:'nivel'};
    if(!(coins>=t.amount))return {ok:false,reason:'saldo'};
    if(usedToday(ledger,day)>=DAILY_CAP)return {ok:false,reason:'tope'};
    return {ok:true,reason:''};
  }
  // Cobra la apuesta de un duelo. Una sola vez por duelo: si ya hay apunte, no se vuelve a cobrar.
  // Devuelve {ledger, charged}: charged es lo que hay que restar del saldo (0 si no procede).
  function stake(ledger,duelId,id,{level,coins,day,now=0}){
    if(!duelId||ledger.duels[duelId])return {ledger,charged:0,reason:'repetida'};
    const result=check(id,{level,coins,ledger,day});if(!result.ok)return {ledger,charged:0,reason:result.reason};
    const amount=TIERS[id].amount;
    const next={...ledger,day,count:usedToday(ledger,day)+1,duels:{...ledger.duels,[duelId]:{tier:id,amount,status:'open',delta:-amount,at:now}}};
    return {ledger:prune(next),charged:amount,reason:''};
  }
  // Resultado de un duelo terminado, visto por un jugador (el `view` de lib/duelos.mjs). Abandonar cuenta como perder.
  function outcome(view){
    if(!view||view.status!=='finished')return null;
    if(view.reason==='cancelado')return 'void';
    return view.winner==='you'?'won':view.winner==='draw'?'draw':'lost';
  }
  const PAYOUT={won:2,draw:1,lost:0,void:1};
  // Liquida la apuesta de un duelo. Solo una vez: un apunte que ya no está abierto no paga nada más.
  // Devuelve {ledger, paid}: paid es lo que hay que sumar al saldo (la apuesta ya se restó al empezar).
  function settle(ledger,duelId,result){
    const entry=ledger.duels[duelId];
    if(!entry||entry.status!=='open'||!Object.hasOwn(PAYOUT,result))return {ledger,paid:0,entry:entry||null};
    const paid=entry.amount*PAYOUT[result],done={...entry,status:result,delta:paid-entry.amount};
    return {ledger:{...ledger,duels:{...ledger.duels,[duelId]:done}},paid,entry:done};
  }
  // Se guardan los últimos apuntes; los abiertos nunca se borran, para poder liquidarlos más tarde.
  function prune(ledger){
    const ids=Object.keys(ledger.duels);if(ids.length<=KEEP)return ledger;
    const closed=ids.filter(id=>ledger.duels[id].status!=='open').sort((a,b)=>ledger.duels[a].at-ledger.duels[b].at);
    const drop=new Set(closed.slice(0,ids.length-KEEP));
    return {...ledger,duels:Object.fromEntries(ids.filter(id=>!drop.has(id)).map(id=>[id,ledger.duels[id]]))};
  }
  root.BetRules={TIERS,IDS,UNLOCK,DAILY_CAP,tier,unlocked,normalize,empty,usedToday,check,stake,outcome,settle};
})(typeof window!=='undefined'?window:globalThis);
