// Duelos 1 vs 1 (decisión 0023). Dos jugadores responden a la vez la misma pregunta; quien queda más lejos
// pierde vida. El servidor manda: guarda el estado, el reloj y las cifras, y el navegador solo pregunta
// cada segundo («estado») y pinta. No hay conexiones abiertas, así que funciona igual en local y en Vercel.
//
// El estado de un duelo es un objeto JSON que avanza solo con el reloj (advance): no hace falta ningún
// proceso en segundo plano. Cada petición lo lee, lo pone al día y, si ha cambiado, lo guarda con control
// de versión (si otra petición lo cambió antes, se reintenta).
import {createHash,randomUUID} from 'node:crypto';

export const RULES={
  maxHp:6000,          // vida inicial de cada jugador
  maxPoints:5000,      // puntos de una respuesta exacta
  zeroAt:1.5,          // órdenes de magnitud de distancia a partir de los cuales la respuesta vale 0 puntos (≈ 32×)
  roundMs:180000,      // 3 minutos por pregunta
  rushMs:30000,        // cuando uno responde, al otro le quedan como mucho 30 segundos
  graceMs:1500,        // margen de red: una respuesta enviada justo al acabar el tiempo aún cuenta
  introMs:5000,        // pantalla «VS» antes de la primera pregunta
  revealMs:10000,      // tiempo que se ve el resultado de cada ronda
  maxRounds:10,        // si nadie cae antes, gana quien tenga más vida
  freshMs:12000        // una partida rápida en espera solo se ofrece si su creador sigue mirando
};
// Daño progresivo (decisión 0034): como en GeoGuessr, el multiplicador sube en cada ronda. Las primeras rondas
// quitan poca vida (una paliza de 5000 a 0 en la primera solo resta 1000), así que nadie queda fuera de juego
// pronto y las partidas se deciden al final. Con diferencias de 1500 por ronda el K.O. llega en la octava;
// ganando todas por 5000, en la cuarta.
export const DAMAGE=[.2,.3,.4,.5,.6,.8,1,1.25,1.5,2];
export const multiplier=round=>DAMAGE[Math.min(Math.max(round,1),DAMAGE.length)-1];
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
export const AVATAR_SLOTS=['body','skin','face','hair','hairColor','top','bottom','shoes','hat','glasses','neck','extra','badge'];

// Almacén en memoria para el servidor local y las pruebas. Misma interfaz que el de Supabase (lib/stores.mjs).
export function memoryDuels(){
  const rows=new Map();
  const out=row=>row?{state:clone(row.state),version:row.version}:null;
  return {
    async get(id){return out(rows.get(id))},
    async byCode(code){return out([...rows.values()].find(row=>row.state.code===code))},
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
// ranked (opcional): motor de clasificatorias (lib/rangos.mjs, decisión 0040). Sin él, solo hay duelos normales.
import {RANKED_MIN_LEVEL} from './rangos.mjs';

export function createDuels({duels,questions,pool,now=Date.now,random=Math.random,ranked=null}){
  const fail=(status,error)=>({status,body:{error}});
  const gauss=()=>Math.sqrt(-2*Math.log(1-random()))*Math.cos(2*Math.PI*random());
  function profile(data,player){
    const name=(typeof data.name==='string'?data.name:'').replace(/[\u0000-\u001f<>&"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,16)||'Jugador';
    // Avatar por capas (dist/avatar.js): solo se guardan los identificadores de cada pieza; el navegador los valida contra su catálogo.
    const avatar={};
    if(data.avatar&&typeof data.avatar==='object')for(const slot of AVATAR_SLOTS){const piece=data.avatar[slot];if(typeof piece==='string'&&/^[a-z0-9-]{1,24}$/.test(piece))avatar[slot]=piece}
    const level=Number.isInteger(data.level)&&data.level>=1&&data.level<=99?data.level:1;
    return {hash:player,name,avatar,level,hp:RULES.maxHp};
  }
  function newDuel(owner,isPublic,t){
    let code='';for(let i=0;i<6;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)];
    return {id:randomUUID(),code,public:isPublic,status:'waiting',createdAt:t,seenAt:t,players:[owner],questions:[],rounds:[],winner:null,reason:null,next:null};
  }
  function newRound(state,startsAt){
    const round={startsAt,deadline:startsAt+RULES.roundMs,guesses:[null,null],ats:[null,null]};
    if(state.players[1].bot){
      // El bot estima como una persona corriente: cerca, pero rara vez clavado, y con cifras redondas.
      const answer=questions.get(state.questions[state.rounds.length]).answer,raw=answer*10**(gauss()*.3-.04);
      round.bot={guess:Number(raw.toPrecision(2)),at:startsAt+15000+Math.floor(random()*40000)};
    }
    return round;
  }
  function start(state,rival,t){
    const ids=[...pool()];
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}
    state.players.push(rival);state.questions=ids.slice(0,RULES.maxRounds);state.status='playing';state.seenAt=t;
    state.rounds=[newRound(state,t+RULES.introMs)];
  }
  function record(round,index,guess,at){
    round.guesses[index]=guess;round.ats[index]=at;
    if(round.guesses[1-index]!=null)return;
    round.deadline=Math.min(round.deadline,at+RULES.rushMs);
    // El bot no deja pasar los 30 segundos: responde poco después que la persona.
    if(index===0&&round.bot&&round.bot.at>at+RULES.rushMs-8000)round.bot.at=at+4000+Math.floor(random()*16000);
  }
  function resolve(state,round,at){
    const number=state.rounds.length,answer=questions.get(state.questions[number-1]).answer;
    const scored=round.guesses.map(guess=>guess==null?0:points(guess,answer)),diff=scored[0]-scored[1];
    round.points=scored;round.loser=diff===0?null:diff>0?1:0;round.damage=Math.round(Math.abs(diff)*multiplier(number));round.resolvedAt=at;
    if(round.loser!==null){const loser=state.players[round.loser];loser.hp=Math.max(0,loser.hp-round.damage)}
    const [a,b]=state.players.map(player=>player.hp);
    if(a<=0||b<=0){state.status='finished';state.winner=a<=0?1:0;state.reason='ko'}
    else if(number>=RULES.maxRounds){state.status='finished';state.winner=a===b?'draw':a>b?0:1;state.reason='rondas'}
  }
  // Pone el duelo al día con el reloj: respuestas del bot, fin del tiempo, resultado de la ronda y ronda siguiente.
  function advance(state,t){
    let changed=false;
    while(state.status==='playing'){
      const round=state.rounds.at(-1);
      if(round.resolvedAt==null){
        if(t<round.startsAt)break;
        if(round.bot&&round.guesses[1]==null&&t>=round.bot.at&&round.bot.at<=round.deadline){record(round,1,round.bot.guess,round.bot.at);changed=true}
        if(round.guesses[0]!=null&&round.guesses[1]!=null)resolve(state,round,Math.max(...round.ats));
        else if(t>=round.deadline+RULES.graceMs)resolve(state,round,round.deadline);
        else break;
        changed=true;
      }else{
        const next=round.resolvedAt+RULES.revealMs;if(t<next)break;
        state.rounds.push(newRound(state,next));changed=true;
      }
    }
    return changed;
  }
  // Lo que ve un jugador. Nunca incluye la cifra real ni la respuesta del rival hasta que la ronda termina.
  function view(state,me,t){
    const relative=index=>index===me?'you':'rival';
    const data={now:t,id:state.id,code:state.code,public:state.public,status:state.status,you:me,maxHp:RULES.maxHp,maxRounds:RULES.maxRounds,
      players:state.players.map(({name,avatar,level,hp,bot,rank})=>({name,avatar,level,hp,bot:!!bot,...(rank?{rank:{...rank,rating:rank.placing?null:rank.rating}}:{})})),phase:state.status,
      ...(state.mode==='ranked'?{mode:'ranked',rankResult:state.rankResult?.[me]??null}:{})};
    // Chat: solo lo que ya ha «llegado» (la respuesta del bot se escribe con unos segundos de retraso).
    data.chat=(state.chat||[]).filter(m=>m.at<=t).sort((a,b)=>a.at-b.at||a.n-b.n).map(({n,from,kind,value,at})=>({n,from:relative(from),kind,value,at}));
    if(state.status==='waiting')return data;
    if(!state.rounds.length)return {...data,winner:null,reason:state.reason,next:null,rounds:[]}; // espera cancelada
    const round=state.rounds.at(-1),number=state.rounds.length,q=questions.get(state.questions[number-1]),done=round.resolvedAt!=null;
    data.phase=state.status==='finished'?'finished':t<round.startsAt?'intro':done?'reveal':'question';
    data.round={number,multiplier:multiplier(number),startsAt:round.startsAt,deadline:round.deadline,rushed:round.deadline<round.startsAt+RULES.roundMs,
      answered:round.guesses.map(guess=>guess!=null),yourGuess:round.guesses[me],
      question:{id:q.id,title:q.title,unit:q.unit,category:q.category,...(q.image?{image:q.image}:{})}};
    if(done){
      const source=q.sources?.[0];
      Object.assign(data.round,{answer:q.answer,source:source?{title:source.title,url:source.url}:null,guesses:round.guesses,points:round.points,damage:round.damage,
        loser:round.loser===null?null:relative(round.loser),resolvedAt:round.resolvedAt,nextAt:round.resolvedAt+RULES.revealMs,nextMultiplier:multiplier(number+1)});
    }
    if(state.status==='finished'){
      data.winner=state.winner===null?null:state.winner==='draw'?'draw':relative(state.winner);data.reason=state.reason;data.next=state.next;
      data.rounds=state.rounds.filter(r=>r.resolvedAt!=null).map(r=>({points:r.points,damage:r.damage,loser:r.loser===null?null:relative(r.loser)}));
    }
    return data;
  }
  const seat=(state,player)=>state.players.findIndex(p=>p.hash===player);
  const ok=(state,me,t)=>({status:200,body:view(state,me,t)});
  // Lee, pone al día, aplica el cambio y guarda. Si otra petición guardó antes (versión distinta), se repite.
  async function mutate(read,change){
    for(let attempt=0;attempt<5;attempt++){
      const row=await read();if(!row)return fail(404,'Duelo no encontrado');
      const t=now(),state=row.state;advance(state,t);
      const result=change(state,t);if(result?.status)return result;
      await settle(state);
      if(await duels.save(state,row.version))return ok(state,result.me,t);
    }
    return fail(409,'El duelo está ocupado. Inténtalo de nuevo.');
  }
  // Clasificatorias: al terminar, se apuntan los PR de los dos (una sola vez). Si falla, se reintenta en la siguiente consulta.
  async function settle(state){
    if(!ranked)return false;
    try{return await ranked.settle(state)}catch(error){return false}
  }
  async function create(owner,isPublic,rival,mode){
    for(let attempt=0;;attempt++){
      const t=now(),state=newDuel(owner,isPublic,t);if(mode==='ranked')state.mode='ranked';if(rival)start(state,rival,t);
      try{await duels.create(state);return ok(state,0,t)}catch(error){if(attempt>=2)throw error}
    }
  }
  const join=(read,player,data,who=null)=>mutate(read,(state,t)=>{
    const me=seat(state,player);if(me>=0)return {me};
    if(state.status!=='waiting')return fail(409,state.players.length>1?'Ese duelo ya ha empezado':'Ese duelo ya no está disponible');
    if(state.mode==='ranked'&&!who?.rank)return fail(409,'Ese duelo es una clasificatoria: búscala desde «Clasificatoria»');
    start(state,who||profile(data,player),t);return {me:1};
  });

  async function handle(data){
    if(typeof data.player!=='string'||!PLAYER.test(data.player))return fail(400,'Jugador no válido');
    const player=hash(data.player.toLowerCase()),byId=()=>duels.get(data.id);
    const needsId=['estado','responder','bot','salir','revancha','chat'].includes(data.action);
    if(needsId&&(typeof data.id!=='string'||!PLAYER.test(data.id)))return fail(400,'Duelo no válido');
    switch(data.action){
      case 'crear':return create(profile(data,player),false);
      case 'buscar':{
        // Clasificatoria o normal: cada modo solo se empareja con el suyo. En clasificatoria se prefiere al rival de
        // valoración más parecida, pero si solo hay uno, se juega con él.
        const mode=data.mode==='ranked'&&ranked?'ranked':'normal',who=profile(data,player);
        if(data.mode==='ranked'&&!ranked)return fail(503,'Las clasificatorias no están disponibles ahora mismo');
        if(mode==='ranked'&&who.level<RANKED_MIN_LEVEL)return fail(403,`Las clasificatorias se desbloquean en el nivel ${RANKED_MIN_LEVEL}`);
        if(mode==='ranked'){try{who.rank=await ranked.snapshot(player)}catch(error){return fail(503,'Las clasificatorias no están disponibles ahora mismo')}}
        const gap=row=>Math.abs((row.state.players[0]?.rank?.rating??0)-(who.rank?.rating??0));
        const rows=(await duels.open(now()-RULES.freshMs)).filter(row=>(row.state.mode||'normal')===mode).sort((a,b)=>gap(a)-gap(b));
        for(const row of rows){
          if(seat(row.state,player)>=0)continue;
          const joined=await join(()=>duels.get(row.state.id),player,data,who);if(joined.status===200)return joined;
        }
        return create(who,true,null,mode);
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
      case 'estado':{
        // La consulta de cada segundo: solo guarda si el reloj ha cambiado algo o toca avisar de que sigo esperando.
        for(let attempt=0;attempt<3;attempt++){
          const row=await byId();if(!row)return fail(404,'Duelo no encontrado');
          const t=now(),state=row.state,me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
          let changed=advance(state,t);
          if(state.status==='waiting'&&me===0&&t-state.seenAt>4000){state.seenAt=t;changed=true}
          if(await settle(state))changed=true;
          if(!changed||await duels.save(state,row.version))return ok(state,me,t);
        }
        return fail(409,'El duelo está ocupado. Inténtalo de nuevo.');
      }
      case 'responder':{
        if(!Number.isFinite(data.guess)||data.guess<=0||data.guess>1e30)return fail(400,'Respuesta no válida');
        return mutate(byId,(state,t)=>{
          const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
          const round=state.rounds.at(-1);
          if(state.status!=='playing'||round.resolvedAt!=null||t<round.startsAt)return fail(409,'Se acabó el tiempo de esta pregunta');
          if(round.guesses[me]!=null)return {me};
          record(round,me,data.guess,Math.min(t,round.deadline));advance(state,t);return {me};
        });
      }
      case 'chat':{
        const kind=data.kind;let value;
        if(kind==='reaction'&&CHAT.reactions.includes(data.value))value=data.value;
        else if(kind==='phrase'&&CHAT.phrases.includes(data.value))value=data.value;
        else if(kind==='text')value=chatText(data.value);
        if(!value)return fail(400,'Mensaje no válido');
        return mutate(byId,(state,t)=>{
          const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
          if(state.players.length<2||!['playing','finished'].includes(state.status))return fail(409,'El chat se abre cuando empieza el duelo');
          const chat=state.chat||(state.chat=[]),mine=chat.filter(m=>m.from===me&&m.at>t-CHAT.burstMs);
          if(mine.length>=CHAT.burst||mine.some(m=>m.at>t-CHAT.gapMs))return fail(429,'Vas muy rápido. Espera un momento.');
          state.chatSeq=(state.chatSeq||0)+1;chat.push({n:state.chatSeq,from:me,kind,value,at:t});
          // Faraday-bot contesta a veces, un par de segundos después, y nunca dos veces seguidas en poco tiempo.
          const bot=state.players[1-me].bot,busyBot=chat.some(m=>m.from!==me&&m.at>t-4000);
          if(bot&&!busyBot&&random()<.75){
            const [replyKind,replyValue]=kind!=='text'&&BOT_REPLY[value]||['reaction',BOT_REACTIONS[Math.floor(random()*BOT_REACTIONS.length)]];
            state.chatSeq++;chat.push({n:state.chatSeq,from:1-me,kind:replyKind,value:replyValue,at:t+1200+Math.floor(random()*1800)});
          }
          if(chat.length>CHAT.keep)chat.splice(0,chat.length-CHAT.keep);
          return {me};
        });
      }
      case 'bot':return mutate(byId,(state,t)=>{
        const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
        if(state.status==='waiting'){state.public=false;delete state.mode;start(state,{...BOT,hash:'bot',hp:RULES.maxHp},t)}
        return {me};
      });
      case 'salir':return mutate(byId,(state,t)=>{
        const me=seat(state,player);if(me<0)return fail(403,'No participas en este duelo');
        if(state.status==='waiting'){state.status='finished';state.reason='cancelado'}
        else if(state.status==='playing'){state.status='finished';state.winner=1-me;state.reason='abandono'}
        state.seenAt=t;return {me};
      });
      case 'revancha':{
        const row=await byId();if(!row)return fail(404,'Duelo no encontrado');
        const old=row.state,me=seat(old,player);if(me<0)return fail(403,'No participas en este duelo');
        if(old.status!=='finished'||old.players.length<2)return fail(409,'El duelo aún no ha terminado');
        if(old.next)return join(()=>duels.byCode(old.next),player,data);
        if(old.players[1-me].bot)return create(profile(data,player),false,{...BOT,hash:'bot',hp:RULES.maxHp});
        const created=await create(profile(data,player),false);
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
