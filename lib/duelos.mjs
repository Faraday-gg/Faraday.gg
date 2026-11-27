// Duelos 1 vs 1 (decisión 0023). Dos jugadores responden a la vez la misma pregunta; quien queda más lejos
// pierde vida. El duelo puede ser de estimación (el de siempre) o de Ascensión, Traza la tendencia o Archivo Vivo:
// cada juego trae sus rondas, su puntuación (siempre de 0 a 5000) y sus tiempos en lib/duelos-juegos.mjs.
// El servidor manda: guarda el estado, el reloj y las cifras, y el navegador solo pregunta cada segundo
// («estado») y pinta. No hay conexiones abiertas, así que funciona igual en local y en Vercel.
//
// El estado de un duelo es un objeto JSON que avanza solo con el reloj (advance): no hace falta ningún
// proceso en segundo plano. Cada petición lo lee, lo pone al día y, si ha cambiado, lo guarda con control
// de versión (si otra petición lo cambió antes, se reintenta).
import {createHash,randomUUID} from 'node:crypto';
import {betTier,visibleBet,gameStakes} from './apuestas.mjs';
import {madridDate} from '../content-engine.mjs';
import {GAME_IDS,GAME_RULES,gameId,gameList,createDuelGames} from './duelos-juegos.mjs';
// Voz de los duelos (lib/voz.mjs): aquí solo se engancha; lo que hace cada operación lo decide ese módulo.
import {voiceAction,voiceView,voiceSweep} from './voz.mjs';
const VOICE={voiceAction,voiceView,voiceSweep};
// Freno de «responder»: como mucho 30 intentos de cada jugador en un duelo cada 10 segundos (el mismo que la voz). Se
// lleva en la memoria de cada instancia del servidor, no en el duelo: guardarlo cambiaría el duelo en cada intento y
// volvería a estorbar al rival (ver mutate).
export const ANSWER_BRAKE={burst:30,burstMs:10000};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export const RULES={
  maxHp:6000,          // vida inicial de cada jugador
  maxPoints:5000,      // puntos de una respuesta exacta
  zeroAt:1.5,          // órdenes de magnitud de distancia a partir de los cuales la respuesta vale 0 puntos (≈ 32×)
  // Los tiempos son los del duelo de estimación; los de los demás juegos están en GAME_RULES (lib/duelos-juegos.mjs).
  roundMs:GAME_RULES.estimacion.roundMs,   // 60 segundos por pregunta
  rushMs:GAME_RULES.estimacion.rushMs,     // cuando uno responde, a los demás les quedan como mucho 20 segundos
  graceMs:1500,        // margen de red: una respuesta enviada justo al acabar el tiempo aún cuenta
  introMs:5000,        // pantalla «VS» antes de la primera pregunta
  revealMs:GAME_RULES.estimacion.revealMs, // tiempo que se ve el resultado de cada ronda
  maxRounds:GAME_RULES.estimacion.maxRounds, // si nadie cae antes, gana quien tenga más vida
  memory:25,           // sin repetir (decisión 0048): se evitan las preguntas de los últimos 25 duelos de cada jugador
  freshMs:12000,       // una partida rápida en espera solo se ofrece si su creador sigue mirando
  waitingMs:300000,    // reconexión (decisión 0042): un duelo en espera se ofrece de nuevo hasta 5 minutos después de la última señal
  resultMs:1800000     // reconexión: un duelo terminado mientras estabas fuera se puede ver hasta 30 minutos después
};
// Daño progresivo (0034) para la práctica con el bot y las partidas que ya empezaron con esa regla.
export const DAMAGE=[.2,.3,.4,.5,.6,.8,1,1.25,1.5,2];
export const multiplier=round=>DAMAGE[Math.min(Math.max(round,1),DAMAGE.length)-1];
// En un juego con menos de diez rondas, la misma escalera se recorre a saltos para acabar igual de fuerte.
export const scaledMultiplier=(round,rounds)=>DAMAGE[Math.round((Math.min(Math.max(round,1),rounds)-1)*(DAMAGE.length-1)/Math.max(1,rounds-1))];
const winBonus=.5;
function nextMultipliers(round){
  const winners=round.best??(round.loser===null?[]:[1-round.loser]);
  return round.multipliers.map((value,seat)=>winners.length===1&&winners[0]===seat?value+winBonus:value);
}
function damageMultiplier(round,number,winners,rounds){
  if(!round.multipliers)return scaledMultiplier(number,rounds);
  return Math.max(1,...winners.map(seat=>round.multipliers[seat]));
}
// Puntos según la distancia multiplicativa a la cifra real, en escala logarítmica: 1× = 5000, 2× ≈ 4000, 10× ≈ 1670, 32× o más = 0.
export function points(guess,answer){
  if(!Number.isFinite(guess)||guess<=0)return 0;
  return Math.round(RULES.maxPoints*Math.max(0,1-Math.abs(Math.log10(guess/answer))/RULES.zeroAt));
}

// Chat de la partida (decisión 0040): reacciones y frases de una lista cerrada, más texto libre corto. Se guardan
// solo los identificadores; el navegador (dist/duel-chat.js) tiene los emojis y los textos con las mismas claves.
export const CHAT={
  reactions:['ok','risa','sorpresa','sudor','fuego','miedo','cerebro','aplauso','pensar','llorar'],
  phrases:['suerte','igualmente','bien','casi','uff','ni-idea','facil','remontada','gg','revancha','gracias','vamos'],
  maxText:140,         // caracteres de un mensaje escrito
  keep:40,             // mensajes que se guardan por duelo (los más antiguos se descartan)
  burst:6,             // como mucho 6 mensajes de cada jugador…
  burstMs:10000,       // …cada 10 segundos
  gapMs:400            // y nunca dos en menos de 0,4 s
};
// Lo que contesta Faraday-bot: a algunas frases, con su frase; a lo demás, con una reacción al azar.
const BOT_REPLY={suerte:['phrase','igualmente'],bien:['phrase','gracias'],casi:['reaction','sudor'],gg:['phrase','gg'],revancha:['phrase','vamos'],gracias:['reaction','ok'],facil:['reaction','risa'],remontada:['phrase','vamos']};
const BOT_REACTIONS=['ok','risa','sorpresa','fuego','aplauso','pensar'];
export function chatText(value){
  if(typeof value!=='string')return '';
  return value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g,' ').replace(/\s+/g,' ').trim().slice(0,CHAT.maxText).trim();
}

const PLAYER=/^[a-f0-9-]{36}$/i,CODE=/^[A-Z2-9]{6}$/,ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const hash=player=>createHash('sha256').update(player).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const BOT={name:'Faraday-bot',avatar:{},level:1,bot:true};
// badge = la medalla destacada del jugador (decisión 0035): un identificador más, que el navegador valida contra su catálogo.
export const AVATAR_SLOTS=['body','costume','skin','face','hair','hairColor','top','bottom','shoes','hat','glasses','neck','extra','badge'];

// Almacén en memoria para el servidor local y las pruebas. Misma interfaz que el de Supabase (lib/stores.mjs).
export function memoryDuels(){
  const rows=new Map();
  const out=row=>row?{state:clone(row.state),version:row.version}:null;
  return {
    async get(id){return out(rows.get(id))},
    async byCode(code){return out([...rows.values()].find(row=>row.state.code===code))},
    // Duelos recientes de un jugador (hash), del más nuevo al más viejo. El filtro fino por reloj lo hace createDuels.
    async recent(hash){return [...rows.values()].filter(row=>row.state.players.some(p=>p.hash===hash)).sort((a,b)=>b.state.createdAt-a.state.createdAt).slice(0,5).map(out)},
    // Preguntas de los últimos duelos de un jugador, del más nuevo al más viejo: una lista de ids por duelo.
    async seen(hash,limit){return [...rows.values()].filter(row=>row.state.questions.length&&row.state.players.some(p=>p.hash===hash)).sort((a,b)=>b.state.createdAt-a.state.createdAt).slice(0,limit).map(row=>[...row.state.questions])},
    // Cuándo empezaron los duelos de un jugador que llegaron a jugarse, desde `since` (para el tope diario del plan gratuito).
    async played(hash,since){return [...rows.values()].filter(row=>row.state.status!=='waiting'&&row.state.createdAt>=since&&row.state.players.some(p=>p.hash===hash)).map(row=>row.state.createdAt)},
    async open(since){return [...rows.values()].filter(row=>row.state.status==='waiting'&&row.state.public&&row.updatedAt>=since).sort((a,b)=>a.state.createdAt-b.state.createdAt).slice(0,5).map(out)},
    async create(state){
      if([...rows.values()].some(row=>row.state.code===state.code))throw Error('Código de duelo repetido');
      rows.set(state.id,{state:clone(state),version:1,updatedAt:state.seenAt});
    },
    async save(state,version){
      const row=rows.get(state.id);if(!row||row.version!==version)return false;
      rows.set(state.id,{state:clone(state),version:version+1,updatedAt:state.seenAt});return true;
    }
  };
}

// questions: Map id → pregunta completa. pool(): ids de las preguntas que pueden salir en un duelo nuevo.
// ranked (opcional): motor de clasificatorias (lib/rangos.mjs, decisión 0043). Sin él, solo hay duelos normales.
import {RANKED_MIN_LEVEL} from './rangos.mjs';

// allowance (opcional): async hash → {plus, limit}: si el jugador tiene la suscripción y cuántos duelos al día da el plan
// gratuito (decisión 0076). Sin él, no hay tope.
// games (opcional): adaptadores de Ascensión, Traza y Archivo Vivo (createDuelGames). Sin él, se cargan solos de content/
// la primera vez que hacen falta, así que quien crea los duelos no tiene que pasar nada.
// voice (opcional): {voiceAction, voiceView}; por defecto, los de lib/voz.mjs. Con null, el duelo no tiene voz.
export function createDuels({duels,questions,pool,now=Date.now,random=Math.random,ranked=null,allowance=null,games=null,voice=VOICE}){
  const fail=(status,error,code)=>({status,body:{error,...(code?{code}:{})}});
  const gauss=()=>Math.sqrt(-2*Math.log(1-random()))*Math.cos(2*Math.PI*random());
  // «Cómo se calcula» (decisión 0029), igual que en el reto diario: solo se manda cuando la ronda ya ha terminado.
  const explain=q=>({calc:q.calc||null,reasoning:q.reasoning||null,referenceExpression:q.referenceExpression||'',math:q.math||'',assumptions:q.assumptions||'',
    sources:(q.sources||[]).map(({title,url,fact})=>({title,url,fact}))});
  // El juego de estimación, con la misma forma que los adaptadores de lib/duelos-juegos.mjs.
  const estimation={id:'estimacion',rules:GAME_RULES.estimacion,
    pool:()=>pool(),item:id=>questions.get(id),
    shape:guess=>Number.isFinite(guess)&&guess>0&&guess<=1e30,
    accept:(q,guess)=>({guess}),
    score:(q,guess)=>points(guess,q.answer),
    question:q=>({id:q.id,title:q.title,unit:q.unit,category:q.category,...(q.image?{image:q.image}:{})}),
    solved(q){const source=q.sources?.[0];return {answer:q.answer,source:source?{title:source.title,url:source.url}:null,explain:explain(q)}},
    review:q=>({question:{id:q.id,title:q.title,unit:q.unit,category:q.category,answer:q.answer,...(q.image?{image:q.image}:{})},explain:explain(q)}),
    // El bot estima como una persona corriente: cerca, pero rara vez clavado, y con cifras redondas.
    bot:(q,{gauss})=>Number((q.answer*10**(gauss()*.3-.04)).toPrecision(2))};
  let others=games;
  // Un duelo sin campo `game` (todos los de antes) es de estimación. Con un juego que este servidor no conoce también
  // se devuelve el de estimación, para que nada falle al leerlo: coherent() lo detecta y el duelo se cancela.
  const gameOf=state=>!state.game||state.game==='estimacion'?estimation:(others||(others=createDuelGames()))[state.game]||estimation;
  const rulesOf=state=>gameOf(state).rules;
  // ¿Se puede jugar este duelo aquí? Su juego existe y todas sus rondas están en el banco de ese juego. Preview y
  // producción comparten la tabla de duelos: un duelo de Traza arrancado por una versión del servidor que no conoce los
  // juegos trae preguntas de estimación, y uno de un juego futuro, rondas que aquí no existen.
  const coherent=state=>(!state.game||GAME_IDS.includes(state.game))&&state.questions.every(id=>!!gameOf(state).item(id));
  // Rondas que se van a jugar: las del juego, o menos si el banco no da para tantas.
  const lastRound=state=>Math.min(rulesOf(state).maxRounds,state.questions.length||Infinity);
  // Cuántos duelos ha jugado hoy (día de Madrid) y cuántos puede: {plus, limit, played}. Sin tope, limit es null.
  async function quota(player){
    const {plus=false,limit=null}=allowance?await allowance(player):{};
    if(plus||limit==null||typeof duels.played!=='function')return {plus:!!plus,limit:null,played:0};
    const today=madridDate(new Date(now())),stamps=await duels.played(player,now()-36*3600000);
    return {plus:false,limit,played:stamps.filter(at=>madridDate(new Date(at))===today).length};
  }
  // Si el jugador ya ha gastado sus duelos de hoy, la respuesta que lo dice; si no, null. Si algo falla, se deja jugar.
  async function spent(player){
    try{
      const {limit,played}=await quota(player);
      return limit!=null&&played>=limit?{status:403,body:{error:`Hoy ya has jugado tus ${limit} duelos disponibles. Mañana se renueva el cupo gratuito; puedes consultar las opciones para seguir jugando.`,code:'limite',limit,played}}:null;
    }catch{return null}
  }
  function profile(data,player){
    const name=(typeof data.name==='string'?data.name:'').replace(/[\u0000-\u001f<>&"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,16)||'Jugador';
    // Avatar por capas (dist/avatar.js): solo se guardan los identificadores de cada pieza; el navegador los valida contra su catálogo.
    const avatar={};
    if(data.avatar&&typeof data.avatar==='object')for(const slot of AVATAR_SLOTS){const piece=data.avatar[slot];if(typeof piece==='string'&&/^[a-z0-9-]{1,28}$/.test(piece))avatar[slot]=piece}
    const level=Number.isInteger(data.level)&&data.level>=1&&data.level<=99?data.level:1;
    // Solo identificadores cortos de gestos, separados por modo; nunca HTML ni código.
    const gestures={};
    for(const mode of ['duel','duel3','ranked']){
      const selected={};
      for(const cue of ['clavada','acierto','cerca','lejos','fallo','desastre','ko','victory','draw','defeat']){
        const value=data.gestures?.[mode]?.[cue];
        if(typeof value==='string'&&/^[a-z]{1,16}$/.test(value))selected[cue]=value;
      }
      if(Object.keys(selected).length)gestures[mode]=selected;
    }
    // bet = nivel de apuesta en faradios (decisión 0044, lib/apuestas.mjs): solo se guarda para que el rival lo vea.
    return {hash:player,name,avatar,level,hp:RULES.maxHp,bet:betTier(data.bet,level),...(Object.keys(gestures).length?{gestures}:{})};
  }
  function newDuel(owner,isPublic,t,size=2,game='estimacion'){
    let code='';for(let i=0;i<6;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)];
    // Los duelos de tres (decisión 0082) llevan size:3; los de dos no llevan el campo, como siempre.
    // Igual con el juego: solo llevan `game` los que no son de estimación.
    // En un juego sin faradios (lib/apuestas.mjs, NO_STAKES) nadie trae apuesta, la pida o no el navegador.
    return {id:randomUUID(),code,public:isPublic,status:'waiting',createdAt:t,seenAt:t,...(size===3?{size:3}:{}),...(game!=='estimacion'?{game}:{}),players:[gameStakes(game)?owner:{...owner,bet:null}],questions:[],rounds:[],winner:null,reason:null,next:null};
  }
  function newRound(state,startsAt){
    const game=gameOf(state),rules=game.rules;
    const count=state.players.length,round={startsAt,deadline:startsAt+rules.roundMs,guesses:Array(count).fill(null),ats:Array(count).fill(null)};
    const previous=state.rounds.at(-1);
    if(!previous&&!state.players.some(player=>player.bot))round.multipliers=Array(count).fill(1);
    else if(previous?.multipliers)round.multipliers=nextMultipliers(previous);
    // En tres, quien ya no tiene vida (o se ha ido) no juega la ronda: alive dice quiénes sí.
    if(count>2)round.alive=state.players.flatMap((player,index)=>player.hp>0&&!player.left?[index]:[]);
    if(count===2&&state.players[1].bot){
      // El bot responde como una persona corriente y tarda lo que tardaría alguien en ese juego.
      const guess=game.bot(game.item(state.questions[state.rounds.length]),{random,gauss});
      round.bot={guess,at:startsAt+rules.bot[0]+Math.floor(random()*rules.bot[1])};
    }
    return round;
  }
  // Sin repetir (decisión 0048): lo que cualquiera de los dos jugadores vio en sus últimos duelos va al final de la cola.
  // Primero salen, al azar, las preguntas que ninguno ha visto; si no llegan a diez, las que se vieron hace más tiempo.
  // history devuelve ids del duelo más reciente al más antiguo. El del creador se guarda en state.seen mientras espera rival.
  async function history(player){
    if(!player||player==='bot'||!duels.seen)return [];
    try{return (await duels.seen(player,RULES.memory)).flat()}catch(error){return []}  // si falla, se juega igual, al azar
  }
  function start(state,rival,t,seen=[]){
    const game=gameOf(state),ids=[...game.pool(t)],rank=new Map();
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}
    // Cada lista cuenta desde su duelo más reciente, así lo último de cualquiera de los dos pesa igual.
    for(const list of [state.seen||[],...(state.seenMore||[]),seen])list.forEach((id,index)=>rank.set(id,Math.min(rank.get(id)??Infinity,index)));
    const fresh=ids.filter(id=>!rank.has(id)),old=ids.filter(id=>rank.has(id)).sort((a,b)=>rank.get(b)-rank.get(a));
    delete state.seen;delete state.seenMore;
    const ordered=[...fresh,...old],rounds=game.rules.maxRounds;
    state.players.push(rival);state.questions=game.pick?game.pick(ordered,rounds):ordered.slice(0,rounds);state.status='playing';state.seenAt=t;
    // Sin faradios en este juego: el duelo empieza sin apuesta de nadie (también las de quienes esperaban al tercero).
    if(!gameStakes(state.game))for(const player of state.players)player.bet=null;
    state.rounds=[newRound(state,t+RULES.introMs)];
  }
  function record(round,index,guess,at,rules){
    round.guesses[index]=guess;round.ats[index]=at;
    if(round.guesses.some((other,seat)=>seat!==index&&other!=null))return;
    round.deadline=Math.min(round.deadline,at+rules.rushMs);
    // El bot no deja pasar el plazo recortado: responde poco después que la persona.
    if(index===0&&round.bot&&round.bot.at>at+rules.rushMs*.6)round.bot.at=at+Math.floor(rules.rushMs*(.15+random()*.55));
  }
  // Quiénes juegan una ronda (en el 1vs1, los dos; en tres, los que siguen en pie).
  const playing=(state,round)=>round.alive?round.alive.filter(index=>!state.players[index].left):state.players.map((_,index)=>index);
  // Duelo de tres (decisión 0082): cada jugador pierde lo que le falta para igualar al mejor de la ronda, por el multiplicador.
  function resolveThree(state,round,at){
    const number=state.rounds.length,game=gameOf(state),item=game.item(state.questions[number-1]),alive=playing(state,round);
    const scored=state.players.map((player,index)=>alive.includes(index)&&round.guesses[index]!=null?game.score(item,round.guesses[index]):0);
    const best=Math.max(...alive.map(index=>scored[index]));
    round.points=scored;round.best=alive.filter(index=>scored[index]===best);round.loser=null;round.resolvedAt=at;
    const boost=damageMultiplier(round,number,round.best,lastRound(state));
    round.damages=state.players.map((player,index)=>alive.includes(index)?Math.round((best-scored[index])*boost):0);
    if(round.multipliers)round.damageMultiplier=boost;
    round.damage=Math.max(...round.damages);
    state.players.forEach((player,index)=>{if(round.damages[index]){player.hp=Math.max(0,player.hp-round.damages[index]);if(!player.hp)(state.out||(state.out=[])).push({seat:index,round:number})}});
    const left=state.players.flatMap((player,index)=>player.hp>0&&!player.left?[index]:[]);
    if(left.length<=1)finishThree(state,left.length?left:[...round.best],'ko');
    else if(number>=lastRound(state)){const top=Math.max(...left.map(index=>state.players[index].hp));finishThree(state,left.filter(index=>state.players[index].hp===top),'rondas')}
  }
  // Cierra un duelo de tres. winners = los puestos de arriba (uno, o varios si empatan).
  function finishThree(state,winners,reason){
    state.status='finished';state.reason=reason;state.winners=winners;state.winner=winners.length>1?'draw':winners[0];
    // Puesto de cada uno: los que siguen en pie, por vida; después los eliminados, el que cayó más tarde mejor.
    const score=index=>{const player=state.players[index],out=(state.out||[]).find(entry=>entry.seat===index);return winners.includes(index)?1e9:out?out.round*1000+(player.left?state.out.indexOf(out):0):1e6+player.hp};
    state.places=state.players.map((player,index)=>1+state.players.filter((other,seat)=>score(seat)>score(index)).length);
  }
  function resolve(state,round,at){
    if(state.players.length>2)return resolveThree(state,round,at);
    const number=state.rounds.length,game=gameOf(state),item=game.item(state.questions[number-1]);
    const scored=round.guesses.map(guess=>guess==null?0:game.score(item,guess)),diff=scored[0]-scored[1];
    round.points=scored;round.loser=diff===0?null:diff>0?1:0;round.resolvedAt=at;
    const boost=damageMultiplier(round,number,round.loser===null?[]:[1-round.loser],lastRound(state));
    round.damage=Math.round(Math.abs(diff)*boost);
    if(round.multipliers)round.damageMultiplier=boost;
    if(round.loser!==null){const loser=state.players[round.loser];loser.hp=Math.max(0,loser.hp-round.damage)}
    const [a,b]=state.players.map(player=>player.hp);
    if(a<=0||b<=0){state.status='finished';state.winner=a<=0?1:0;state.reason='ko'}
    else if(number>=lastRound(state)){state.status='finished';state.winner=a===b?'draw':a>b?0:1;state.reason='rondas'}
  }
  // Pone el duelo al día con el reloj: respuestas del bot, fin del tiempo, resultado de la ronda y ronda siguiente.
  function advance(state,t){
    // Un duelo en marcha que aquí no se puede jugar (ver coherent) se cierra como cancelado en vez de fallar en cada
    // consulta: nadie gana ni pierde, no hay premio y las apuestas se devuelven.
    if(state.status==='playing'&&!coherent(state)){state.status='finished';state.winner=null;state.reason='cancelado';state.seenAt=t;return true}
    let changed=false;const rules=rulesOf(state);
    while(state.status==='playing'){
      const round=state.rounds.at(-1);
      if(round.resolvedAt==null){
        if(t<round.startsAt)break;
        if(round.bot&&round.guesses[1]==null&&t>=round.bot.at&&round.bot.at<=round.deadline){record(round,1,round.bot.guess,round.bot.at,rules);changed=true}
        if(playing(state,round).every(index=>round.guesses[index]!=null))resolve(state,round,Math.max(...round.ats));
        else if(t>=round.deadline+RULES.graceMs)resolve(state,round,round.deadline);
        else break;
        changed=true;
      }else{
        const next=round.resolvedAt+rules.revealMs;if(t<next)break;
        state.rounds.push(newRound(state,next));changed=true;
      }
    }
    return changed;
  }
  // Pone el duelo al día (advance) y recoge lo que la voz ya no necesita guardar (la oferta de conexión de una llamada
  // que ya no puede seguir). Devuelve true si ha cambiado algo.
  function refresh(state,t){
    const moved=advance(state,t),swept=!!voice?.voiceSweep?.(state,t);
    return moved||swept;
  }
  // Resultado para el asiento `me`: 'you', 'rival', 'draw' o null. En tres, empatar arriba es 'draw' solo para los que empatan.
  function outcome(state,me){
    if(state.winner===null||state.winner===undefined)return null;
    if(state.size===3&&state.winners)return state.winners.includes(me)?state.winners.length>1?'draw':'you':'rival';
    return state.winner==='draw'?'draw':state.winner===me?'you':'rival';
  }
  // Lo que ve un jugador. Nunca incluye la solución ni la respuesta del rival hasta que la ronda termina.
  // game = el juego del duelo; rules = sus tiempos, que el navegador pinta tal cual (no tiene los suyos).
  function view(state,me,t){
    const data=sight(state,me,t);
    // Voz (lib/voz.mjs): lo que este jugador necesita saber de la llamada del duelo, según la fase.
    // `until` le dice cuándo acaba el resultado de la ronda, que no dura lo mismo en todos los juegos.
    if(voice)data.voice=voice.voiceView(state,me,data.phase,{now:t,...(data.phase==='reveal'?{until:data.round.nextAt}:{})})??null;
    return data;
  }
  function sight(state,me,t){
    const relative=index=>index===me?'you':'rival';
    const three=state.size===3,game=gameOf(state),{roundMs,rushMs,revealMs}=game.rules,maxRounds=lastRound(state);
    // stakes = si este duelo admite apuesta y paga faradios (lib/apuestas.mjs): con false, el navegador no enseña ni lo uno ni lo otro.
    const data={now:t,id:state.id,code:state.code,public:state.public,status:state.status,you:me,game:game.id,stakes:gameStakes(state.game),rules:{roundMs,rushMs,revealMs,maxRounds},maxHp:RULES.maxHp,maxRounds,...(three?{size:3}:{}),
      players:state.players.map(player=>{const {name,avatar,level,hp,bot,rank,left,gestures}=player;return {name,avatar,level,hp,...(gestures?{gestures}:{}),bot:!!bot,bet:visibleBet(state,player),...(left?{left:true}:{}),...(rank?{rank:{...rank,rating:rank.placing?null:rank.rating}}:{})}}),phase:state.status,
      ...(state.mode==='ranked'?{mode:'ranked',rankResult:state.rankResult?.[me]??null}:{})};
    // Chat: solo lo que ya ha «llegado» (la respuesta del bot se escribe con unos segundos de retraso).
    data.chat=(state.chat||[]).filter(m=>m.at<=t).sort((a,b)=>a.at-b.at||a.n-b.n).map(({n,from,kind,value,at})=>({n,from:relative(from),...(three?{seat:from}:{}),kind,value,at}));
    if(state.status==='waiting')return data;
    if(!state.rounds.length)return {...data,winner:null,reason:state.reason,next:null,rounds:[]}; // espera cancelada
    // Un duelo cancelado por incoherente, o uno que terminó con rondas que este servidor no tiene: se enseña el
    // resultado sin rondas, porque no hay con qué pintarlas.
    if(state.reason==='cancelado'||!coherent(state))return {...data,winner:outcome(state,me),reason:state.reason,next:state.next??null,rounds:[]};
    const round=state.rounds.at(-1),number=state.rounds.length,item=game.item(state.questions[number-1]),done=round.resolvedAt!=null;
    data.phase=state.status==='finished'?'finished':t<round.startsAt?'intro':done?'reveal':'question';
    data.round={number,startsAt:round.startsAt,deadline:round.deadline,rushed:round.deadline<round.startsAt+roundMs,
      ...(round.multipliers?{multipliers:round.multipliers}:{multiplier:scaledMultiplier(number,maxRounds)}),
      answered:round.guesses.map(guess=>guess!=null),yourGuess:round.guesses[me],...(three?{alive:playing(state,round)}:{}),
      question:game.question(item)};
    if(done){
      // solved: en estimación, la cifra real, la fuente y el cálculo; en los demás juegos, {marks, reveal}.
      Object.assign(data.round,game.solved(item,round.guesses),{guesses:round.guesses,points:round.points,damage:round.damage,...(three?{damages:round.damages,best:round.best}:{}),
        loser:round.loser===null?null:relative(round.loser),resolvedAt:round.resolvedAt,nextAt:round.resolvedAt+revealMs,
        ...(round.multipliers?{multiplier:round.damageMultiplier??scaledMultiplier(number,maxRounds),nextMultipliers:nextMultipliers(round)}:{nextMultiplier:scaledMultiplier(number+1,maxRounds)})});
    }
    if(state.status==='finished'){
      data.winner=outcome(state,me);data.reason=state.reason;data.next=state.next;if(three)data.places=state.places;
      // Repaso final: cada ronda con su pregunta, las dos respuestas y el cálculo, para verlo con calma.
      data.rounds=state.rounds.filter(r=>r.resolvedAt!=null).map((r,i)=>{const one=game.item(state.questions[i]);
        return {points:r.points,damage:r.damage,...(three?{damages:r.damages,best:r.best}:{}),loser:r.loser===null?null:relative(r.loser),guesses:r.guesses,
          ...(one?game.review(one,r.guesses):{})}});
    }
    return data;
  }
  const seat=(state,player)=>state.players.findIndex(p=>p.hash===player);
  // Última señal de vida de un duelo: la de quien espera, o el último cambio de ronda.
  const lastSignal=state=>Math.max(state.seenAt||0,state.rounds.at(-1)?.resolvedAt||0,state.rounds.at(-1)?.startsAt||0);
  // Reconexión (decisión 0042): ¿tiene este jugador un duelo en marcha? Prefiere el que sigue vivo; si no hay,
  // devuelve el último terminado (para que no pierda el resultado ni el XP). Una salida voluntaria no cuenta: ya vio el final.
  async function active(player){
    const t=now(),rows=await duels.recent(player,t-RULES.resultMs-RULES.waitingMs);let finished=null;
    for(const row of rows){
      const state=row.state,me=seat(state,player);if(me<0)continue;
      if(refresh(state,t)){await duels.save(state,row.version)}  // si otra petición guardó antes, no pasa nada: se recalcula en la siguiente
      const live=(state.status==='playing'&&!state.players[me].left)||(state.status==='waiting'&&t-lastSignal(state)<=RULES.waitingMs);
      const other=state.players.find((one,index)=>index!==me),others=state.players.filter((one,index)=>index!==me);
      const summary=()=>({id:state.id,code:state.code,status:state.status,game:gameOf(state).id,phase:sight(state,me,t).phase,you:me,round:state.rounds.length||null,maxRounds:lastRound(state),
        hp:[state.players[me].hp,other?.hp??null],rival:other?{name:other.name,level:other.level,bot:!!other.bot}:null,
        ...(state.size===3?{size:3,rivals:others.map(one=>one.name),waitingFor:3-state.players.length}:{}),
        winner:state.status==='finished'?outcome(state,me)??null:undefined,reason:state.reason});
      if(live)return {status:200,body:{now:t,active:summary()}};
      const mine=state.status==='finished'&&state.players.length>1&&state.reason!=='cancelado'&&!(state.size===3?state.players[me].left:state.reason==='abandono'&&state.winner===1-me)&&t-lastSignal(state)<=RULES.resultMs;
      if(mine&&!finished)finished=summary();
    }
    return {status:200,body:{now:t,active:finished}};
  }
  const ok=(state,me,t)=>({status:200,body:view(state,me,t)});
  // Lee, pone al día, aplica el cambio y guarda. Si otra petición guardó antes (versión distinta), se repite.
  // Solo se guarda (y sube la versión) si el duelo ha cambiado de verdad: una operación que lo deja igual (responder
  // dos veces, salir de una llamada en la que no se está) no debe hacer fallar la que el rival tiene a medias.
  //   tries = intentos. `steady` es para lo que no se puede perder (responder, salir): más intentos y una espera corta
  //   y al azar entre ellos, para que una ráfaga de operaciones del rival no se lleve por delante la respuesta.
  //   Un cambio rechazado con `keep` (la voz, que lleva su freno en el propio duelo) guarda igualmente lo que haya
  //   tocado, sin insistir si no puede.
  const TRIES={quick:5,steady:12};
  async function mutate(read,change,{steady=false}={}){
    for(let attempt=0,tries=steady?TRIES.steady:TRIES.quick;attempt<tries;attempt++){
      if(steady&&attempt)await sleep(15+Math.random()*45);
      const row=await read();if(!row)return fail(404,'Duelo no encontrado');
      const t=now(),state=row.state,before=JSON.stringify(state);refresh(state,t);
      const result=change(state,t);
      if(!result?.status)voice?.voiceSweep?.(state,t); // si el cambio ha terminado el duelo, la voz recoge ya lo suyo
      if(result?.status){
        if(result.keep&&JSON.stringify(state)!==before){await settle(state);await duels.save(state,row.version)}
        return {status:result.status,body:result.body};
      }
      await settle(state);
      if(JSON.stringify(state)===before||await duels.save(state,row.version))return ok(state,result.me,t);
    }
    return fail(409,'El duelo está ocupado. Inténtalo de nuevo.');
  }
  // Freno en memoria (ANSWER_BRAKE): true si este jugador ya ha gastado sus intentos de la ventana en curso.
  const taps=new Map();
  function hurried(key,t){
    const hit=taps.get(key);
    if(!hit||t-hit[0]>=ANSWER_BRAKE.burstMs||t<hit[0]){if(taps.size>=5000)taps.clear();taps.set(key,[t,1]);return false}
    return ++hit[1]>ANSWER_BRAKE.burst;
  }
  // Clasificatorias: al terminar, se apuntan los PR de los dos (una sola vez). Si falla, se reintenta en la siguiente consulta.
  async function settle(state){
    if(!ranked)return false;
    try{return await ranked.settle(state)}catch(error){return false}
  }
  async function create(owner,isPublic,rival,mode,size=2,game='estimacion'){
    let seen;
    for(let attempt=0;;attempt++){
      const t=now(),state=newDuel(owner,isPublic,t,size,game);if(mode==='ranked')state.mode='ranked';
      state.seen=seen??=await history(owner.hash);if(rival)start(state,rival,t);
      try{await duels.create(state);return ok(state,0,t)}catch(error){if(attempt>=2)throw error}
    }
  }
  // seen: las preguntas recientes de quien se une (se pasa ya leído cuando se prueban varios duelos seguidos).
  const join=async(read,player,data,who=null,seen=null)=>{
    seen??=await history(player);
    return mutate(read,(state,t)=>{
      const me=seat(state,player);if(me>=0)return {me};
      if(state.status!=='waiting')return fail(409,state.players.length>1?'Ese duelo ya ha empezado':'Ese duelo ya no está disponible');
      if(!coherent(state))return fail(409,'Ese duelo ya no está disponible'); // de un juego que este servidor no conoce
      if(state.mode==='ranked'&&!who?.rank)return fail(409,'Ese duelo es una clasificatoria: búscala desde «Clasificatoria»');
      // Duelo de tres: los dos primeros que entran esperan al tercero; el que completa la mesa lo pone en marcha.
      if(state.size===3&&state.players.length<2){
        state.players.push(who||profile(data,player));(state.seenMore||(state.seenMore=[])).push(seen);state.seenAt=t;return {me:state.players.length-1};
      }
      start(state,who||profile(data,player),t,seen);return {me:state.players.length-1};
    });
  };

  // Salir de un duelo de tres (decisión 0082). Esperando: quien se va libera su sitio y, si es el creador, se cancela.
  // Jugando: queda eliminado con 0 de vida y la partida sigue entre los demás; si solo queda uno, gana.
  function leaveThree(state,me,t){
    if(state.status==='finished')return {me};
    state.seenAt=t;
    if(state.status==='waiting'){
      if(me===0){state.status='finished';state.reason='cancelado'}else state.players.splice(me,1);
      return {me};
    }
    if(state.status!=='playing')return {me};
    const player=state.players[me];
    if(player.left||player.hp<=0&&state.out?.some(entry=>entry.seat===me))return {me};
    player.left=true;player.hp=0;(state.out||(state.out=[])).push({seat:me,round:state.rounds.length-.5});
    const standing=state.players.flatMap((one,index)=>one.hp>0&&!one.left?[index]:[]);
    if(standing.length<=1)finishThree(state,standing,'abandono');
    else advance(state,t);
    return {me};
  }

  async function handle(data){
    if(typeof data.player!=='string'||!PLAYER.test(data.player))return fail(400,'Jugador no válido');
    const player=hash(data.player.toLowerCase()),byId=()=>duels.get(data.id);
    const needsId=['estado','responder','bot','salir','revancha','chat','voz'].includes(data.action);
    if(needsId&&(typeof data.id!=='string'||!PLAYER.test(data.id)))return fail(400,'Duelo no válido');
    // Plan gratuito: un tope de duelos al día (decisión 0076). Se comprueba al empezar uno, no al seguir el que ya se juega.
    if(['crear','buscar','unirse','revancha'].includes(data.action)){const stop=await spent(player);if(stop)return stop}
    // El juego se elige al crear o buscar un duelo; quien se une o pide revancha juega al que ya tiene ese duelo.
    const game=gameId(data.game);
    if(['crear','buscar'].includes(data.action)&&!game)return fail(400,'Juego no válido');
    switch(data.action){
      // Juegos disponibles, sus tiempos y si admiten apuesta y pagan faradios (`stakes`), para que el portal los
      // enseñe sin tener copia de ellos.
      case 'juegos':return {status:200,body:{games:gameList().map(one=>({...one,ranked:one.ranked&&!!ranked}))}};
      case 'limite':{try{return {status:200,body:await quota(player)}}catch{return {status:200,body:{plus:false,limit:null,played:0}}}}
      case 'crear':return create(profile(data,player),false,null,undefined,data.size===3?3:2,game);
      case 'buscar':{
        // Clasificatoria o normal: cada modo solo se empareja con el suyo. En clasificatoria se prefiere al rival de
        // valoración más parecida, pero si solo hay uno, se juega con él.
        const size=data.size===3?3:2,mode=data.mode==='ranked'&&ranked?'ranked':'normal',who=profile(data,player);
        if(size===3&&data.mode==='ranked')return fail(400,'Los duelos de tres no son clasificatorios');
        if(game!=='estimacion'&&data.mode==='ranked')return fail(400,'Las clasificatorias son solo de estimación');
        if(data.mode==='ranked'&&!ranked)return fail(503,'Las clasificatorias no están disponibles ahora mismo');
        if(mode==='ranked'&&who.level<RANKED_MIN_LEVEL)return fail(403,`Las clasificatorias se desbloquean en el nivel ${RANKED_MIN_LEVEL}`);
        if(mode==='ranked'){try{who.rank=await ranked.snapshot(player)}catch(error){return fail(503,'Las clasificatorias no están disponibles ahora mismo')}}
        const gap=row=>Math.abs((row.state.players[0]?.rank?.rating??0)-(who.rank?.rating??0));
        const rows=(await duels.open(now()-RULES.freshMs)).filter(row=>(row.state.mode||'normal')===mode&&(row.state.size||2)===size&&(row.state.game||'estimacion')===game).sort((a,b)=>gap(a)-gap(b));
        const seen=rows.length?await history(player):null;
        for(const row of rows){
          if(seat(row.state,player)>=0)continue;
          const joined=await join(()=>duels.get(row.state.id),player,data,who,seen);if(joined.status===200)return joined;
        }
        return create(who,true,null,mode,size,game);
      }
      case 'rango':{
        if(!ranked)return fail(503,'Las clasificatorias no están disponibles ahora mismo');
        try{return await ranked.mine(player)}catch(error){return fail(503,'Las clasificatorias no están disponibles ahora mismo')}
      }
      case 'unirse':{
        const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
        if(!CODE.test(code))return fail(400,'El código tiene 6 letras o números');
        return join(()=>duels.byCode(code),player,data);
      }
      case 'activo':return active(player);
      case 'estado':{
        // La consulta de cada segundo: solo guarda si el reloj ha cambiado algo o toca avisar de que sigo esperando.
        for(let attempt=0;attempt<3;attempt++){
          const row=await byId();if(!row)return fail(404,'Duelo no encontrado');
          const t=now(),state=row.state,me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
          let changed=refresh(state,t);
          if(state.status==='waiting'&&(me===0||state.size===3)&&t-state.seenAt>4000){state.seenAt=t;changed=true}
          if(await settle(state))changed=true;
          if(!changed||await duels.save(state,row.version))return ok(state,me,t);
        }
        return fail(409,'El duelo está ocupado. Inténtalo de nuevo.');
      }
      case 'responder':{
        // Freno: responder sin parar (aunque sea a una pregunta ya respondida) no cuesta lecturas ni estorba al rival.
        if(hurried(data.id.toLowerCase()+':'+player,now()))return fail(429,'Vas muy rápido. Espera un momento.');
        return mutate(byId,(state,t)=>{
          const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
          // La forma de la respuesta depende del juego: una cifra, un texto, un trazo o un año.
          const own=gameOf(state);
          if(!own.shape(data.guess))return fail(400,'Respuesta no válida');
          const round=state.rounds.at(-1);
          if(state.status!=='playing'||round.resolvedAt!=null||t<round.startsAt)return fail(409,'Se acabó el tiempo de esta pregunta');
          if(round.guesses[me]!=null)return {me};
          if(round.alive&&(!round.alive.includes(me)||state.players[me].left))return fail(409,'Estás fuera de este duelo');
          const taken=own.accept(own.item(state.questions[state.rounds.length-1]),data.guess);
          if(taken.guess==null)return fail(taken.status||400,taken.error||'Respuesta no válida',taken.code);
          record(round,me,taken.guess,Math.min(t,round.deadline),own.rules);advance(state,t);return {me};
        },{steady:true});
      }
      case 'chat':{
        const kind=data.kind;let value;
        if(kind==='reaction'&&CHAT.reactions.includes(data.value))value=data.value;
        else if(kind==='phrase'&&CHAT.phrases.includes(data.value))value=data.value;
        else if(kind==='text')value=chatText(data.value);
        if(!value)return fail(400,'Mensaje no válido');
        return mutate(byId,(state,t)=>{
          const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
          if(state.players.length<(state.size||2)||!['playing','finished'].includes(state.status))return fail(409,'El chat se abre cuando empieza el duelo');
          const chat=state.chat||(state.chat=[]),mine=chat.filter(m=>m.from===me&&m.at>t-CHAT.burstMs);
          if(mine.length>=CHAT.burst||mine.some(m=>m.at>t-CHAT.gapMs))return fail(429,'Vas muy rápido. Espera un momento.');
          state.chatSeq=(state.chatSeq||0)+1;chat.push({n:state.chatSeq,from:me,kind,value,at:t});
          // Faraday-bot contesta a veces, un par de segundos después, y nunca dos veces seguidas en poco tiempo.
          const bot=!state.size&&state.players[1-me].bot,busyBot=chat.some(m=>m.from!==me&&m.at>t-4000);
          if(bot&&!busyBot&&random()<.75){
            const [replyKind,replyValue]=kind!=='text'&&BOT_REPLY[value]||['reaction',BOT_REACTIONS[Math.floor(random()*BOT_REACTIONS.length)]];
            state.chatSeq++;chat.push({n:state.chatSeq,from:1-me,kind:replyKind,value:replyValue,at:t+1200+Math.floor(random()*1800)});
          }
          if(chat.length>CHAT.keep)chat.splice(0,chat.length-CHAT.keep);
          return {me};
        });
      }
      // Voz del duelo (lib/voz.mjs): la señalización de la llamada viaja en el propio duelo y solo entre sus jugadores.
      case 'voz':{
        if(!voice)return fail(503,'La voz no está disponible ahora mismo');
        let reply;
        const done=await mutate(byId,(state,t)=>{
          const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
          const result=voice.voiceAction(state,me,data,t)||{status:400};
          // Una operación rechazada también gasta el freno de la voz, que va guardado en el duelo (keep). Con el freno
          // ya agotado (429) no se guarda nada: así una ráfaga no cambia el duelo más de 30 veces cada 10 segundos.
          if(result.status!==200)return {status:result.status||400,body:result.body||{error:'Acción de voz no válida'},keep:result.status!==429};
          reply=result.body;return {me};
        });
        // Se responde con la vista del duelo (que ya lleva `voice`) más lo que lib/voz.mjs quiera añadir.
        return done.status===200&&reply&&typeof reply==='object'?{status:200,body:{...done.body,...reply}}:done;
      }
      case 'bot':return mutate(byId,(state,t)=>{
        const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
        if(state.size===3)return fail(409,'Los duelos de tres no tienen bot');
        if(state.status==='waiting'){state.public=false;delete state.mode;start(state,{...BOT,hash:'bot',hp:RULES.maxHp},t)}
        return {me};
      });
      case 'salir':return mutate(byId,(state,t)=>{
        const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
        if(state.size===3)return leaveThree(state,me,t);
        // Salir de un duelo ya terminado no cambia nada (ni mueve seenAt, del que dependen la reconexión y la voz).
        if(state.status==='waiting'){state.status='finished';state.reason='cancelado';state.seenAt=t}
        else if(state.status==='playing'){state.status='finished';state.winner=1-me;state.reason='abandono';state.seenAt=t}
        return {me};
      },{steady:true});
      case 'revancha':{
        const row=await byId();if(!row)return fail(404,'Duelo no encontrado');
        const old=row.state,me=seat(old,player);if(me<0)return fail(403,'No participas en este duelo');
        if(old.status!=='finished'||old.players.length<(old.size||2))return fail(409,'El duelo aún no ha terminado');
        if(old.next)return join(()=>duels.byCode(old.next),player,data);
        if(old.size===3){
          const made=await create(profile(data,player),false,null,undefined,3,old.game);
          const linked3=await mutate(byId,state=>{if(!state.next)state.next=made.body.code;return {me}});
          if(linked3.status===200&&linked3.body.next!==made.body.code)return join(()=>duels.byCode(linked3.body.next),player,data);
          return made;
        }
        // La revancha es del mismo juego que el duelo terminado.
        if(old.players[1-me].bot)return create(profile(data,player),false,{...BOT,hash:'bot',hp:RULES.maxHp},undefined,2,old.game);
        const created=await create(profile(data,player),false,null,undefined,2,old.game);
        // Se apunta la revancha en el duelo terminado para que el rival la vea. Si los dos la piden a la vez, gana la primera.
        const linked=await mutate(byId,state=>{if(!state.next)state.next=created.body.code;return {me}});
        if(linked.status===200&&linked.body.next!==created.body.code)return join(()=>duels.byCode(linked.body.next),player,data);
        return created;
      }
      default:return fail(400,'Acción no válida');
    }
  }
  return {handle};
}
