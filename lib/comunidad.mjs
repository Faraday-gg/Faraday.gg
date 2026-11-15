// Preguntas de la comunidad (decisión 0052). Los jugadores con cuenta proponen preguntas y votan las de los demás
// pagando faradios; el domingo a las 00:01 (el mismo cron que genera la jornada de mañana) las 3 más votadas de la
// semana se resuelven con OpenAI y búsqueda web, y forman la jornada del lunes con el nombre y el avatar de su autor.
//
// Rondas: la ronda R es el lunes en que se publica. Admite propuestas y votos del domingo R−8 al sábado R−2 (hora de
// Madrid). El domingo R−1 se resuelve y empieza a la vez la ronda R+7.
//
// Faradios en el servidor: para cobrar los votos el servidor tiene que conocer el saldo. Con cuenta, el progreso del
// navegador (dist/progress.js) se guarda también en el servidor (tabla player_progress) y el saldo lo lleva el
// servidor: el navegador solo manda cuánto ha cambiado, con un tope diario de ganancias (RULES.dailyGain).
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {madridDate,getDay} from '../content-engine.mjs';
import {AVATAR_SLOTS} from './duelos.mjs';
import {XP,FIRST_XP,MISSIONS,levelOf,roll,addAnswer,addDay,addDuel,missions,claim,dailyIds,weeklyIds} from './misiones.mjs';
import {Chests,CHARGE,GIFT_CAP,GIFT_TYPES,chestBox,grant,charge,streakDay,levelChest,setChest,chestState} from './cofres.mjs';
import {PIECES,HINT_COST} from './catalogo.mjs';
import {betStake,betOpen,betResult,betPayout,BET_CAP} from './apuestas.mjs';
import {askOpenAI,questionSchema,validateQuestion,brokenSources,DEFAULT_MODEL,categories,AMBITOS} from './generar.mjs';

export const RULES={
  proposeCost:50,    // faradios por proponer una pregunta
  voteCost:10,       // faradios por cada voto
  maxProposals:3,    // propuestas por jugador y ronda
  minVotes:1,        // votos mínimos para poder salir
  candidates:6,      // las más votadas que se mandan a resolver
  authorPrize:200,   // faradios para el autor cuando su pregunta sale en el reto
  dailyGain:1500,    // faradios ganados en el navegador que el servidor acepta por día (contra trampas)
  firstGain:5000,    // saldo máximo que se acepta la primera vez que se sube el progreso a la cuenta
  list:100,          // propuestas que se enseñan por ronda
  stateBytes:60000   // tamaño máximo del progreso guardado
};
// Libro contable (decisión 0057): cada cambio de saldo queda apuntado con su motivo. Estos son los motivos que puede
// declarar el navegador mientras sus premios no se calculen en el servidor; lo que no venga desglosado se apunta como
// «sin-desglose» y lo que recorta el tope diario, como «tope». Los que apunta el servidor llevan source «servidor».
// «reto» y «archivo» ya no están: esos premios los calcula y los paga el servidor (decisión 0058, lib/premios.mjs).
// «duelos» tampoco: decisión 0059.
// «apuestas» tampoco: con cuenta, el bote lo lleva el servidor (decisión 0060).
// Ni «misiones» ni «nivel»: decisión 0061.
// Ni «tienda» ni «pistas»: decisión 0062.
// Ni «cofres» ni «cofres-compra»: decisión 0063.
export const REASONS=['bienvenida','referidos','otros'];
export const LEDGER_PAGE=50;
const DAY=86400000,noon=date=>Date.parse(date+'T12:00:00Z');
export const shiftDate=(date,days)=>new Date(noon(date)+days*DAY).toISOString().slice(0,10);
const mondayOf=date=>shiftDate(date,-((new Date(noon(date)).getUTCDay()+6)%7));
// Ronda abierta en una fecha de Madrid: el lunes de mañana más 7 días.
export const openRound=today=>shiftDate(mondayOf(shiftDate(today,1)),7);
// Último día para proponer y votar en la ronda R: el sábado anterior.
export const closesOn=round=>shiftDate(round,-2);

const clean=(value,max)=>(typeof value==='string'?value:'').replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
export function cleanAvatar(value){
  const avatar={};
  if(value&&typeof value==='object')for(const slot of AVATAR_SLOTS){const piece=value[slot];if(typeof piece==='string'&&/^[a-z0-9-]{1,24}$/.test(piece))avatar[slot]=piece}
  return avatar;
}
// Comprobaciones básicas, sin IA: longitud, que sea una pregunta y que no lleve enlaces.
export function checkProposal({title,unit,note}){
  title=clean(title,160);unit=clean(unit,24);note=clean(note,280);
  if(title.length<10)return {error:'Escribe la pregunta (al menos 10 letras).'};
  if(!/\?$/.test(title))title=(title.startsWith('¿')?title:'¿'+title)+'?';
  if(!title.startsWith('¿'))title='¿'+title;
  title='¿'+title.slice(1).charAt(0).toLocaleUpperCase('es')+title.slice(2);
  if(!unit)return {error:'Di en qué se mide la respuesta (km, personas, veces…).'};
  if(/https?:|www\./i.test(title+unit+note))return {error:'Sin enlaces, por favor.'};
  return {title,unit,note};
}

// Almacén en memoria (pruebas) o en un archivo JSON (servidor local). Misma interfaz que el de Supabase (lib/stores.mjs).
export function memoryCommunity(file=null){
  let data={progress:{},proposals:[],votes:[],ledger:[],items:{}};
  if(file){try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}}
  data.ledger??=[];data.items??={};
  // Apunta en el libro los movimientos [motivo, cantidad, referencia] de un jugador, con el saldo tras cada uno.
  const note=(player,before,entries,source,day)=>{let balance=before;for(const [reason,amount,ref=null] of entries){if(!amount)continue;balance+=amount;data.ledger.push({id:data.ledger.length+1,player,amount,reason,source,ref,balance,day:day??null,at:Date.now()})}};
  const save=()=>{if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file)};
  const clone=value=>JSON.parse(JSON.stringify(value));
  return {
    async progress(player){const row=data.progress[player];return row?clone({state:row.state,coins:row.coins}):null},
    // moves = {motivo: cantidad} con el desglose de delta. Lo que el tope o el saldo mínimo recortan se apunta como «tope».
    async saveProgress(player,state,delta,day,dailyCap,firstCap,moves={}){
      let row=data.progress[player];
      if(!row){row=data.progress[player]={state,coins:Math.max(0,Math.min(delta,firstCap)),gainDay:day,gained:0};note(player,0,[['saldo-inicial',row.coins]],'navegador',day);save();return row.coins}
      if(row.gainDay!==day)row.gained=0;
      const accepted=Math.min(delta,Math.max(0,dailyCap-row.gained)),before=row.coins;
      Object.assign(row,{state,coins:Math.max(0,row.coins+accepted),gainDay:day,gained:row.gained+Math.max(accepted,0)});
      const entries=Object.entries(moves),rest=row.coins-before-entries.reduce((sum,[,amount])=>sum+amount,0);
      note(player,before,[...entries,['tope',rest]],'navegador',day);save();return row.coins;
    },
    // Con referencia, el mismo premio no se paga dos veces.
    async credit(player,amount,reason='premio',ref=null,day=null){
      const row=data.progress[player]??={state:{},coins:0,gainDay:null,gained:0};amount=Math.max(0,amount);
      if(ref!=null&&data.ledger.some(entry=>entry.player===player&&entry.reason===reason&&entry.ref===ref))return row.coins;
      note(player,row.coins,[[reason,amount,ref]],'servidor',day);row.coins+=amount;save();return row.coins;
    },
    // Mueve faradios desde el servidor (amount > 0 da, < 0 cobra) y lo apunta. Con referencia no se repite. Devuelve
    // {coins}, {coins, repeated} o {error: 'saldo', coins} si no llega para cobrar.
    async move(player,amount,reason,ref=null,day=null){
      const row=data.progress[player]??={state:{},coins:0,gainDay:null,gained:0};
      if(ref!=null&&data.ledger.some(entry=>entry.player===player&&entry.reason===reason&&entry.ref===ref))return {coins:row.coins,repeated:true};
      if(row.coins+amount<0)return {error:'saldo',coins:row.coins};
      note(player,row.coins,[[reason,amount,ref]],'servidor',day);row.coins+=amount;save();return {coins:row.coins};
    },
    // Experiencia y contadores de misiones que lleva el servidor (decisión 0061). declared = la experiencia que dice el
    // navegador, para la primera vez. saveStats solo guarda si nadie ha cambiado la fila desde que se leyó.
    async stats(player){const row=data.progress[player];return row?clone({xp:row.xp||0,stats:row.stats||{},version:row.sv||0,declared:row.state?.xp??0}):null},
    async saveStats(player,xp,stats,version){const row=data.progress[player];if(!row||(row.sv||0)!==version)return false;Object.assign(row,{xp,stats:clone(stats),sv:version+1});save();return true},
    // Inventario (decisión 0062): las piezas que tiene un jugador y de dónde salió cada una.
    async items(player){return clone(data.items[player]||[])},
    async hasItem(player,item){return (data.items[player]||[]).some(one=>one.item===item)},
    async addItems(player,items,source){const own=data.items[player]??=[];for(const item of items)if(!own.some(one=>one.item===item))own.push({item,source});save()},
    async addItem(player,item,source){const own=data.items[player]??=[];if(!own.some(one=>one.item===item)){own.push({item,source});save()}},
    async ledgerHas(player,reason,ref){return data.ledger.some(entry=>entry.player===player&&entry.reason===reason&&entry.ref===ref)},
    // Cuántos apuntes tiene un jugador un día con alguno de esos motivos (para los topes diarios).
    async ledgerCount(player,reasons,day){return data.ledger.filter(entry=>entry.player===player&&entry.day===day&&reasons.includes(entry.reason)).length},
    // Últimos movimientos de un jugador, del más reciente al más antiguo.
    async ledger(player,limit=LEDGER_PAGE){return clone(data.ledger.filter(entry=>entry.player===player).slice(-limit).reverse().map(({amount,reason,source,ref,balance,day})=>({amount,reason,source,ref,balance,day})))},
    async propose(entry,cost,max,day=null){
      if(data.proposals.filter(p=>p.player===entry.player&&p.round===entry.round).length>=max)return {error:'limite'};
      const row=data.progress[entry.player];if(!row||row.coins<cost)return {error:'saldo'};
      note(entry.player,row.coins,[['comunidad-proponer',-cost,entry.id]],'servidor',day);
      row.coins-=cost;data.proposals.push({...clone(entry),votes:0,status:'abierta',questionId:null});save();return {coins:row.coins};
    },
    async vote(id,round,player,cost,day=null){
      const proposal=data.proposals.find(p=>p.id===id);
      if(!proposal)return {error:'no-existe'};
      if(proposal.round!==round||proposal.status!=='abierta')return {error:'cerrada'};
      if(proposal.player===player)return {error:'propia'};
      if(data.votes.some(v=>v.id===id&&v.player===player))return {error:'repetido'};
      const row=data.progress[player];if(!row||row.coins<cost)return {error:'saldo'};
      note(player,row.coins,[['comunidad-votar',-cost,id]],'servidor',day);
      row.coins-=cost;data.votes.push({id,player});proposal.votes++;save();return {coins:row.coins,votes:proposal.votes};
    },
    async proposals(round,limit=RULES.list){return clone(data.proposals.filter(p=>p.round===round).sort((a,b)=>b.votes-a.votes||a.createdAt-b.createdAt).slice(0,limit))},
    async votedBy(player,ids){return new Set(data.votes.filter(v=>v.player===player&&ids.includes(v.id)).map(v=>v.id))},
    async setStatus(id,status,questionId=null){const proposal=data.proposals.find(p=>p.id===id);if(proposal){proposal.status=status;proposal.questionId=questionId;save()}}
  };
}

// Filtro automático con OpenAI (sin búsqueda web): descarta lo ofensivo y lo que no tiene una cifra comprobable.
// Sin clave de OpenAI (servidor local, pruebas) solo se hacen las comprobaciones básicas.
const moderationSchema={type:'object',additionalProperties:false,required:['ok','reason','title','unit'],properties:{ok:{type:'boolean'},reason:{type:'string'},title:{type:'string'},unit:{type:'string'}}};
export function openaiModerator({apiKey,model=process.env.OPENAI_MODERATION_MODEL||'gpt-5-mini',fetch:request=globalThis.fetch}={}){
  if(!apiKey)return null;
  return async({title,unit,note})=>{
    const system=`Eres el moderador de «Casi Casi», un juego de estimación en español: cada pregunta tiene como respuesta un único número positivo que se puede comprobar con fuentes públicas fiables. Revisa una pregunta propuesta por un jugador.
Recházala (ok: false) si: es ofensiva, sexual, violenta, discriminatoria o trata tragedias, política partidista o a personas privadas; contiene datos personales, insultos, publicidad o enlaces; no tiene una respuesta numérica única; o la cifra no se puede encontrar ni calcular con datos públicos.
Si la aceptas, corrige solo la ortografía del título (que empiece por «¿» y acabe en «?») y da la unidad de la respuesta en plural y en minúsculas. reason: una frase corta en español para el jugador (si la rechazas, por qué; si la aceptas, vacía).`;
    const user=`Pregunta: ${title}\nUnidad: ${unit}${note?`\nAclaración del jugador: ${note}`:''}`;
    return await askOpenAI({apiKey,model,request,system,user,format:{name:'moderacion',schema:moderationSchema},search:false,timeout:40000});
  };
}

// Resolución de la ronda con OpenAI y búsqueda web: cada candidata se convierte en una pregunta completa del juego.
const resolutionSchema={type:'object',additionalProperties:false,required:['results'],properties:{results:{type:'array',items:{type:'object',additionalProperties:false,required:['id','ok','reason','question'],properties:{id:{type:'string'},ok:{type:'boolean'},reason:{type:'string'},question:questionSchema}}}}};
export function resolutionPrompt(candidates){
  const system=`Eres el editor de «Casi Casi», un juego diario de estimación en español neutro para jugadores de España y Latinoamérica. Esta semana las preguntas las han propuesto y votado los jugadores. Para cada pregunta propuesta, busca en la web la cifra de referencia y prepárala para el juego.
Reglas:
1. Respeta la pregunta del jugador: corrige la ortografía y aclara las condiciones si hace falta, pero no cambies lo que pregunta. title acaba en «?».
2. La cifra sale de fuentes que hayas consultado con la búsqueda web (organismos oficiales, fabricantes, prensa seria; Wikipedia como último recurso). Nunca inventes datos ni URL. Si no hay forma de dar una cifra fiable y única, o la pregunta es inapropiada, devuelve ok: false con el motivo en reason (y rellena question con valores vacíos o 0).
3. Explica cómo se llega a la solución para que cualquiera lo entienda: math con las cifras de las fuentes, calc por pasos y reasoning en 3 pasos.
Formato de question (como el resto del juego):
- category: una de ${Object.entries(categories).map(([k,v])=>`${k} (${v})`).join(', ')}. ambito: ${Object.keys(AMBITOS).join(', ')} (el que encaje). actualidad: false.
- tag: 2 o 3 palabras. title: la pregunta. detail: 1 o 2 frases con las condiciones del juego y algo de gracia. unit: unidad en plural.
- answer: la cifra (número). math: el cálculo explicado, con números en formato español.
- referenceExpression: la cuenta que da answer, solo con números sin separador de miles (coma decimal), ×, ÷, +, − y paréntesis. Debe dar exactamente answer.
- assumptions: supuestos y lo que no se cuenta. confidence: «Dato documentado», «Dato documentado + cálculo» o «Dato documentado + modelo».
- sources: 1 a 3 fuentes con title («Organismo · Título»), url (https, la página exacta) y fact (el dato que sacas de ella).
- reasoning: heading corto y exactamente 3 steps (estimación a ojo, orden de magnitud y afinar con el dato real).
- calc: intro (una frase), rows (2 a 6 filas con label y value; desde la segunda, value empieza por la operación: «× 182», «÷ 7 kg») y result (nombre del resultado).
Devuelve un resultado por cada pregunta, con su mismo id y en el mismo orden.`;
  const user=`Preguntas propuestas, de más a menos votada:\n${candidates.map(c=>`- id ${c.id}: «${c.title}» (unidad: ${c.unit})${c.note?` Aclaración del autor: ${c.note}`:''}`).join('\n')}`;
  return {system,user};
}

const weekday=date=>new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'Europe/Madrid'}).format(new Date(date+'T12:00:00Z')).replace(/^./,c=>c.toUpperCase());

// Jornada del lunes `date` con las más votadas de su ronda. Devuelve {day, done} o null si no hay ninguna que sirva
// (entonces se genera la jornada de siempre). Si salen menos de 3, se completa con preguntas del banco editorial.
//   resolve (opcional, pruebas): (candidates) => results, en lugar de llamar a OpenAI.
export async function communityDay({date,community,apiKey,model=DEFAULT_MODEL,fetch:request=globalThis.fetch,resolve,checkUrls=true,now=new Date(),log=console.log}){
  const open=(await community.proposals(date)).filter(p=>p.status==='abierta'&&p.votes>=RULES.minVotes);
  const candidates=open.slice(0,RULES.candidates);
  if(!candidates.length)return null;
  const results=resolve?await resolve(candidates):(await askOpenAI({apiKey,model,request,...resolutionPrompt(candidates),format:{name:'comunidad',schema:resolutionSchema}})).results;
  const byId=new Map((results||[]).map(r=>[r.id,r])),chosen=[],today=madridDate(now);
  for(const proposal of candidates){
    if(chosen.length===3)break;
    const result=byId.get(proposal.id);
    if(!result?.ok){log(`Comunidad ${date}: «${proposal.title}» descartada (${result?.reason||'sin respuesta'})`);continue}
    const errors=validateQuestion(result.question);
    if(!errors.length&&checkUrls)errors.push(...(await brokenSources({questions:[result.question]},request)).map(m=>'fuente que no existe: '+m));
    if(errors.length){log(`Comunidad ${date}: «${proposal.title}» no válida: ${errors.join('; ')}`);continue}
    chosen.push({proposal,question:result.question});
  }
  if(!chosen.length)return null;
  const questions=chosen.map(({proposal,question},i)=>({...question,id:`comunidad-${date}-${i+1}`,revision:1,verifiedAt:today,actualidad:false,
    author:{name:proposal.name,avatar:proposal.avatar||{}},community:{proposal:proposal.id,votes:proposal.votes},
    generated:{by:'openai',model:resolve?'prueba':model,at:now.toISOString()}}));
  // Si faltan, se completan con las del banco editorial de esa fecha (sin repetir categoría si se puede).
  if(questions.length<3){
    const bank=getDay(date,{persist:false})?.questions||[],used=new Set(questions.map(q=>q.category));
    const fill=[...bank.filter(q=>!used.has(q.category)),...bank.filter(q=>used.has(q.category))].slice(0,3-questions.length);
    if(fill.length<3-questions.length)return null;
    questions.push(...fill.map((q,i)=>({...q,id:`comunidad-${date}-${questions.length+i+1}`})));
  }
  const day={id:date,name:weekday(date),theme:'Preguntas de la comunidad',community:true,questions};
  const done=async()=>{
    for(const [i,{proposal}] of chosen.entries()){
      await community.setStatus(proposal.id,'publicada',questions[i].id);
      await community.credit(proposal.player,RULES.authorPrize,'comunidad-autor',proposal.id,today);
    }
  };
  return {day,done};
}

// Rutas /api/comunidad y /api/progreso. account = cuenta con sesión iniciada (o null); player = SHA-256 de su jugador.
// prize (opcional): (jugador, fecha) => {reason, amount} o null; el premio por completar esa jornada (lib/premios.mjs).
// duelPrize (opcional): (jugador, idDuelo, pagados) => {reason, amount} o null; el premio de un duelo (decisión 0059).
// duelState (opcional): idDuelo => estado guardado del duelo o null; para las apuestas en bote (decisión 0060).
// random (opcional): el azar del sorteo de los cofres, para poder probarlo.
export function createCommunity({community,now=Date.now,moderate=null,log=console.error,prize=null,duelPrize=null,duelState=null,random=Math.random}){
  const today=()=>madridDate(new Date(now()));
  const errors={
    limite:[429,`Ya has propuesto ${RULES.maxProposals} preguntas esta semana.`],
    saldo:[402,'No te llegan los faradios.'],
    'no-existe':[404,'Esa pregunta ya no existe.'],
    cerrada:[409,'La votación de esa pregunta ya está cerrada.'],
    propia:[409,'No puedes votar tu propia pregunta.'],
    repetido:[409,'Ya has votado esta pregunta.']
  };
  // Experiencia y misiones (decisión 0061). Lee los contadores del jugador, deja que `change` los toque y los guarda;
  // si otra petición se adelantó, repite. `change` devuelve la experiencia ganada, o null si no hay nada que apuntar.
  // Al cruzar un nivel paga su premio, una vez por nivel. Devuelve {xp, level, coins} (coins solo si pagó) o null.
  async function withStats(player,change){
    try{
      for(let attempt=0;attempt<4;attempt++){
        const row=await community.stats(player);if(!row)return null;
        // La primera vez se parte de la experiencia que declara el navegador, con tope.
        const started=row.stats&&row.stats.v===1,before=started?row.xp:Math.min(FIRST_XP,Math.max(0,Math.floor(Number(row.declared)||0)));
        // Cofres (decisión 0063). La primera vez se parte también de los cofres, la batería y la racha que declara el
        // navegador, y sus piezas ya compradas pasan al inventario: hacen falta para no sortear una pieza repetida.
        const saved=started||!Chests?null:(await community.progress(player))?.state||{};
        const stats=roll(row.stats,today());if(Chests)chestBox(stats,saved);
        const gained=change(stats);
        if(gained==null&&started)return {xp:before,level:levelOf(before),stats};
        const xp=before+(gained||0);
        // Subir de nivel da un cofre, además de los faradios.
        if(Chests)for(let level=levelOf(before)+1;level<=levelOf(xp);level++)levelChest(stats,level);
        if(!await community.saveStats(player,xp,stats,row.version))continue;
        if(saved){const owned=(Array.isArray(saved.owned)?saved.owned:[]).filter(key=>typeof key==='string'&&PIECES.has(key)).slice(0,1000);if(owned.length)await community.addItems(player,owned,'inicial')}
        let coins;
        for(let level=levelOf(before)+1;level<=levelOf(xp);level++)coins=(await community.move(player,XP.levelCoins,'nivel','nivel-'+level,today())).coins;
        return {xp,level:levelOf(xp),coins,stats};
      }
    }catch(error){log('Progreso (experiencia y misiones):',error?.message||error)}
    return null;
  }
  // Lo llama /api/answers con cada respuesta guardada: cuenta para las misiones y da experiencia. Solo con cuenta.
  const answered=(player,question,factor)=>withStats(player,stats=>addAnswer(stats,{question,factor})||null);
  const failed=code=>{const [status,error]=errors[code]||[500,'No se pudo hacer'];return {status,body:{error,code}}};
  const shape=(p,player,voted)=>({id:p.id,name:p.name,avatar:p.avatar||{},title:p.title,unit:p.unit,note:p.note||'',votes:p.votes,status:p.status,mine:p.player===player,voted:voted.has(p.id)});

  async function round(player){
    const date=today(),current=openRound(date),previous=shiftDate(current,-7);
    const [list,last]=await Promise.all([community.proposals(current),community.proposals(previous)]);
    const voted=player?await community.votedBy(player,list.map(p=>p.id)):new Set();
    const wallet=player?await community.progress(player):null;
    return {status:200,body:{round:current,closes:closesOn(current),today:date,rules:{proposeCost:RULES.proposeCost,voteCost:RULES.voteCost,maxProposals:RULES.maxProposals,authorPrize:RULES.authorPrize},
      account:Boolean(player),coins:wallet?.coins??null,
      proposals:list.map(p=>shape(p,player,voted)),
      // La ronda anterior: si es domingo, se está resolviendo; desde el lunes, sus ganadoras ya están en el reto.
      previous:{round:previous,resolved:date>=previous,winners:last.filter(p=>p.status==='publicada').map(p=>shape(p,player,new Set()))}}};
  }

  async function handle(data,{account,player}){
    if(data.action==='ronda')return await round(player);
    if(data.action!=='proponer'&&data.action!=='votar')return {status:400,body:{error:'Acción no válida'}};
    if(!account)return {status:401,body:{error:'Entra con tu cuenta para proponer y votar.',code:'cuenta'}};
    if(!player)return {status:409,body:{error:'Vuelve a cargar la página para terminar de entrar.'}};
    const current=openRound(today());
    if(data.action==='votar'){
      if(typeof data.id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.id))return {status:400,body:{error:'Pregunta no válida'}};
      const result=await community.vote(data.id.toLowerCase(),current,player,RULES.voteCost,today());
      return result.error?failed(result.error):{status:200,body:{coins:result.coins,votes:result.votes}};
    }
    const name=clean(data.name,16);
    if(!name)return {status:400,body:{error:'Elige el nombre con el que saldrá tu pregunta.'}};
    let proposal=checkProposal(data);if(proposal.error)return {status:400,body:{error:proposal.error}};
    if(moderate){
      let verdict;
      try{verdict=await moderate(proposal)}catch(error){log('Comunidad, moderación:',error?.message||error);return {status:503,body:{error:'No hemos podido revisar tu pregunta. Inténtalo en un rato.'}}}
      if(!verdict?.ok)return {status:422,body:{error:verdict?.reason||'Esta pregunta no encaja en el juego.',code:'rechazada'}};
      const polished=checkProposal({title:verdict.title||proposal.title,unit:verdict.unit||proposal.unit,note:proposal.note});
      if(!polished.error)proposal=polished;
    }
    const result=await community.propose({id:randomUUID(),round:current,player,name,avatar:cleanAvatar(data.avatar),...proposal,createdAt:now()},RULES.proposeCost,RULES.maxProposals,today());
    return result.error?failed(result.error):{status:200,body:{coins:result.coins,title:proposal.title,unit:proposal.unit}};
  }

  // Progreso con cuenta: leer lo guardado o guardar el del navegador. delta = cuánto cambió el saldo desde la última vez.
  async function progress(data,{player}){
    if(!player)return {status:401,body:{error:'Sin cuenta, el progreso se guarda solo en este navegador.',code:'cuenta'}};
    if(data.action==='leer'){const row=await community.progress(player);return {status:200,body:row?{state:row.state,coins:row.coins}:{state:null,coins:null}}}
    // Apuestas en bote (decisión 0060). «apostar» cobra la parte del jugador mientras se juega la primera pregunta;
    // «cobrar-apuesta» paga al terminar: el bote menos la comisión a quien gana, lo suyo a cada uno si empatan o si el
    // rival no llegó a poner su parte. Las dos se pueden repetir sin cobrar ni pagar dos veces.
    if(data.action==='apostar'||data.action==='cobrar-apuesta'){
      const id=typeof data.duel==='string'&&/^[0-9a-f-]{36}$/i.test(data.duel)?data.duel.toLowerCase():null;
      const state=id&&duelState?await duelState(id):null,me=state?state.players.findIndex(one=>one.hash===player):-1;
      if(me<0)return {status:409,body:{error:'Ese duelo no es tuyo.',code:'incompleto'}};
      const stake=betStake(state),balance=async()=>(await community.progress(player))?.coins??0;
      const paid=await community.ledgerHas(player,'apuesta',id);
      if(data.action==='apostar'){
        if(!stake)return {status:409,body:{error:'En este duelo no hay bote.',code:'sin-bote'}};
        if(paid)return {status:200,body:{coins:await balance(),stake}};
        if(!betOpen(state))return {status:409,body:{error:'El duelo ya está en marcha: va sin apuesta.',code:'tarde'}};
        if(await community.ledgerCount(player,['apuesta'],today())>=BET_CAP)return {status:409,body:{error:'Ya has hecho las apuestas de hoy.',code:'tope'}};
        const moved=await community.move(player,-stake,'apuesta',id,today());
        return moved.error?{status:402,body:{error:'No te llegan los faradios.',code:'saldo'}}:{status:200,body:{coins:moved.coins,stake}};
      }
      if(state.status!=='finished')return {status:409,body:{error:'Ese duelo no ha terminado.',code:'incompleto'}};
      if(!paid)return {status:200,body:{coins:await balance(),amount:0,stake:0,result:'none'}};
      const result=await community.ledgerHas(state.players[1-me].hash,'apuesta',id)?betResult(state,me):'void',amount=betPayout(result,stake);
      const coins=amount?(await community.move(player,amount,result==='won'?'apuesta-premio':'apuesta-devuelta',id,today())).coins:await balance();
      return {status:200,body:{coins,amount,stake,result}};
    }
    // Misiones y nivel (decisión 0061). «estado» dice cómo van según el servidor; «mision» recoge una completada.
    if(data.action==='estado'){
      const info=await withStats(player,()=>null);
      if(!info)return {status:503,body:{error:'El progreso no está disponible ahora mismo.'}};
      return {status:200,body:{xp:info.xp,level:info.level,missions:missions(info.stats,today()),...(Chests?chestState(info.stats):{})}};
    }
    if(data.action==='mision'){
      if(typeof data.id!=='string'||!Object.hasOwn(MISSIONS,data.id))return {status:400,body:{error:'Misión no válida'}};
      // Recoger las tres del día da un cofre Chispa; las tres de la semana, un cofre Rayo (decisión 0063).
      let won=null,chest=null;const info=await withStats(player,stats=>{
        won=claim(stats,data.id,today());chest=null;if(!won)return null;
        if(Chests){const daily=dailyIds(today()).includes(data.id);chest=setChest(daily?stats.day:stats.week,daily?dailyIds(today()):weeklyIds(today()),daily?'day':'week',stats)}
        return won.xp;
      });
      if(!info||!won)return {status:409,body:{error:'Esa misión no está completada.',code:'incompleto'}};
      const moved=await community.move(player,won.coins,'misiones',won.ref,today());
      return {status:200,body:{coins:moved.coins,amount:won.coins,xp:info.xp,level:info.level,...(chest?{chest}:{})}};
    }
    // Tienda y pistas (decisión 0062). «comprar» cobra el precio del catálogo y apunta la pieza en el inventario;
    // «pista» cobra una pista, una vez por pregunta; «inventario» devuelve las piezas compradas con cuenta.
    if(data.action==='comprar'){
      if(!PIECES.size)return {status:503,body:{error:'La tienda no está disponible ahora mismo.'}};
      const piece=typeof data.item==='string'?PIECES.get(data.item):null;
      if(!piece)return {status:400,body:{error:'Esa pieza no se puede comprar.'}};
      if(await community.hasItem(player,data.item))return {status:409,body:{error:'Esa pieza ya es tuya.',code:'tienes'}};
      // La referencia es la pieza: si ya se cobró y falló el apunte en el inventario, no se cobra otra vez.
      const moved=await community.move(player,-piece.price,'tienda',data.item,today());
      if(moved.error)return {status:402,body:{error:'No te llegan los faradios.',code:'saldo'}};
      await community.addItem(player,data.item,'tienda');
      return {status:200,body:{coins:moved.coins,item:data.item,price:piece.price}};
    }
    if(data.action==='pista'){
      if(typeof data.question!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(data.question))return {status:400,body:{error:'Pregunta no válida'}};
      const moved=await community.move(player,-HINT_COST,'pistas',data.question,today());
      return moved.error?{status:402,body:{error:'No te llegan los faradios.',code:'saldo'}}:{status:200,body:{coins:moved.coins}};
    }
    if(data.action==='inventario')return {status:200,body:{items:await community.items(player)}};
    // Cofres (decisión 0063). «comprar-cofre» cobra y da el cofre; «abrir-cofre» lo sortea aquí y reparte los premios;
    // «regalo-cofre» apunta un cofre del Circuito de amigos, que todavía declara el navegador (con tope diario).
    if(data.action==='comprar-cofre'||data.action==='abrir-cofre'||data.action==='regalo-cofre'){
      if(!Chests||!PIECES.size)return {status:503,body:{error:'Los cofres no están disponibles ahora mismo.'}};
      const type=typeof data.type==='string'&&Object.hasOwn(Chests.CHESTS,data.type)?data.type:null;
      if(!type)return {status:400,body:{error:'Cofre no válido'}};
      // Asegura que el progreso del servidor está iniciado (cofres y piezas que ya tenía el jugador).
      if(!await withStats(player,()=>null))return {status:503,body:{error:'Los cofres no están disponibles ahora mismo.'}};
      const balance=async()=>(await community.progress(player))?.coins??0;
      if(data.action==='regalo-cofre'){
        if(!GIFT_TYPES.includes(type))return {status:400,body:{error:'Cofre no válido'}};
        let given=false;const info=await withStats(player,stats=>{
          const gifts=stats.gifts&&stats.gifts.day===today()?stats.gifts:{day:today(),count:0};given=false;
          if(gifts.count>=GIFT_CAP)return null;
          gifts.count++;stats.gifts=gifts;grant(stats,type);given=true;return 0;
        });
        return given&&info?{status:200,body:chestState(info.stats)}:{status:409,body:{error:'Hoy ya no se pueden apuntar más cofres de regalo.',code:'tope'}};
      }
      if(data.action==='comprar-cofre'){
        if(await community.ledgerCount(player,['cofres-compra'],today())>=Chests.BUY_CAP)return {status:409,body:{error:'Hoy ya has comprado todos los cofres que se puede.',code:'tope'}};
        const price=Chests.CHESTS[type].price,moved=await community.move(player,-price,'cofres-compra',randomUUID(),today());
        if(moved.error)return {status:402,body:{error:'No te llegan los faradios.',code:'saldo'}};
        const info=await withStats(player,stats=>{grant(stats,type);return 0});
        // Si no se pudo apuntar el cofre, se devuelve lo cobrado.
        if(!info){await community.move(player,price,'cofres-devuelto',randomUUID(),today());return {status:503,body:{error:'No se pudo comprar el cofre. Inténtalo otra vez.'}}}
        return {status:200,body:{coins:moved.coins,...chestState(info.stats)}};
      }
      // Abrir: solo salen piezas que el jugador no tiene, del cuerpo que lleva puesto (y las comunes), como en el navegador.
      const body=(await community.progress(player))?.state?.look?.body==='mujer'?'mujer':'hombre';
      const owned=new Set((await community.items(player)).map(one=>one.item));
      const missing=[...PIECES].filter(([key,piece])=>(!piece.body||piece.body===body)&&!owned.has(key)).map(([key,piece])=>({key,rarity:piece.rarity}));
      let result=null,serial=0;
      const info=await withStats(player,stats=>{
        result=null;if(!(stats.chests[type]>0))return null;
        stats.chests[type]--;result=Chests.roll(type,{items:missing.map(item=>({...item})),pity:stats.pity||0,random});
        stats.pity=result.pity;serial=stats.opened=(stats.opened||0)+1;return 0;
      });
      if(!info||!result)return {status:409,body:{error:'No tienes ese cofre.',code:'sin-cofre'}};
      // Los premios: las piezas, al inventario; los lotes de faradios, al saldo, con el cofre como referencia.
      let coins=null;const rewards=[];
      for(const [index,reward] of Array.from(result.rewards).entries()){
        if(reward.kind==='coins')coins=(await community.move(player,reward.amount,'cofres',`cofre-${serial}-${index}`,today())).coins;
        else await community.addItem(player,reward.key,'cofre');
        rewards.push({...reward});
      }
      return {status:200,body:{rewards,coins:coins??await balance(),...chestState(info.stats)}};
    }
    if(data.action==='movimientos')return {status:200,body:{moves:await community.ledger(player,LEDGER_PAGE)}};
    // Premio por completar una jornada (decisión 0058): lo calcula el servidor con las respuestas guardadas y lo paga una
    // sola vez, con la fecha como referencia. Si se pide otra vez, devuelve el saldo sin volver a pagar.
    if(data.action==='premio'){
      // Con `duel`, el premio de un duelo terminado (decisión 0059); la referencia es el duelo.
      if(data.duel!==undefined){
        const paid=(who,reasons)=>community.ledgerCount(who,reasons,today());
        const won=duelPrize?await duelPrize(player,data.duel,paid):null;
        if(!won)return {status:409,body:{error:'Ese duelo no ha terminado.',code:'incompleto'}};
        // Experiencia y misiones del duelo (una vez por duelo), y después los faradios.
        await withStats(player,stats=>{
          const played=stats.duel.count,xp=addDuel(stats,{id:data.duel.toLowerCase(),result:won.result,abandoned:won.abandoned,bot:won.bot,rounds:won.rounds});
          // La batería de cofres (decisión 0063): no carga al abandonar ni al repetir contra el bot; pasado el tope diario, menos.
          if(xp!=null&&Chests&&!won.abandoned&&!(won.bot&&!won.amount))charge(stats,played>=XP.duel.full?CHARGE.duelCapped:CHARGE.duel);
          return xp;
        });
        const coins=won.amount?await community.credit(player,won.amount,won.reason,data.duel.toLowerCase(),today()):(await community.progress(player))?.coins??0;
        return {status:200,body:{coins,amount:won.amount,reason:won.reason}};
      }
      const won=prize?await prize(player,data.day):null;
      if(!won)return {status:409,body:{error:'Ese reto no está completo.',code:'incompleto'}};
      const moved=await community.move(player,won.amount,won.reason,data.day,today());
      // La primera vez que se cobra la jornada, cuenta también para la experiencia y las misiones.
      const info=moved.repeated?null:await withStats(player,stats=>{
        const xp=addDay(stats,won.reason);
        // Batería y racha de cofres (decisión 0063).
        if(Chests){charge(stats,won.reason==='reto'?CHARGE.today:CHARGE.archive);if(won.reason==='reto')streakDay(stats,data.day)}
        return xp;
      });
      return {status:200,body:{coins:info?.coins??moved.coins,amount:won.amount,reason:won.reason}};
    }
    if(data.action!=='guardar')return {status:400,body:{error:'Acción no válida'}};
    const state=data.state,delta=Number.isInteger(data.delta)?data.delta:0;
    if(!state||typeof state!=='object'||Array.isArray(state)||Math.abs(delta)>1e7)return {status:400,body:{error:'Progreso no válido'}};
    // Desglose de delta por motivo (decisión 0057). Solo motivos conocidos; lo que falte para sumar delta va a «sin-desglose».
    const moves={};let known=0;
    if(data.moves&&typeof data.moves==='object'&&!Array.isArray(data.moves))for(const reason of REASONS){const amount=data.moves[reason];if(Number.isInteger(amount)&&amount&&Math.abs(amount)<=1e7){moves[reason]=amount;known+=amount}}
    if(delta!==known)moves['sin-desglose']=delta-known;
    const {coins,...rest}=state;
    const coinsNow=await community.saveProgress(player,rest,delta,today(),RULES.dailyGain,RULES.firstGain,moves);
    return {status:200,body:{coins:coinsNow}};
  }
  return {handle,progress,answered};
}
