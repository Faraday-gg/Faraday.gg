// Preguntas de la comunidad (decisión 0049). Los jugadores con cuenta proponen preguntas y votan las de los demás
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
  let data={progress:{},proposals:[],votes:[]};
  if(file){try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}}
  const save=()=>{if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file)};
  const clone=value=>JSON.parse(JSON.stringify(value));
  return {
    async progress(player){const row=data.progress[player];return row?clone({state:row.state,coins:row.coins}):null},
    async saveProgress(player,state,delta,day,dailyCap,firstCap){
      let row=data.progress[player];
      if(!row){row=data.progress[player]={state,coins:Math.max(0,Math.min(delta,firstCap)),gainDay:day,gained:0};save();return row.coins}
      if(row.gainDay!==day)row.gained=0;
      const accepted=Math.min(delta,Math.max(0,dailyCap-row.gained));
      Object.assign(row,{state,coins:Math.max(0,row.coins+accepted),gainDay:day,gained:row.gained+Math.max(accepted,0)});save();return row.coins;
    },
    async credit(player,amount){const row=data.progress[player]??={state:{},coins:0,gainDay:null,gained:0};row.coins+=Math.max(0,amount);save();return row.coins},
    async propose(entry,cost,max){
      if(data.proposals.filter(p=>p.player===entry.player&&p.round===entry.round).length>=max)return {error:'limite'};
      const row=data.progress[entry.player];if(!row||row.coins<cost)return {error:'saldo'};
      row.coins-=cost;data.proposals.push({...clone(entry),votes:0,status:'abierta',questionId:null});save();return {coins:row.coins};
    },
    async vote(id,round,player,cost){
      const proposal=data.proposals.find(p=>p.id===id);
      if(!proposal)return {error:'no-existe'};
      if(proposal.round!==round||proposal.status!=='abierta')return {error:'cerrada'};
      if(proposal.player===player)return {error:'propia'};
      if(data.votes.some(v=>v.id===id&&v.player===player))return {error:'repetido'};
      const row=data.progress[player];if(!row||row.coins<cost)return {error:'saldo'};
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
      await community.credit(proposal.player,RULES.authorPrize);
    }
  };
  return {day,done};
}

// Rutas /api/comunidad y /api/progreso. account = cuenta con sesión iniciada (o null); player = SHA-256 de su jugador.
export function createCommunity({community,now=Date.now,moderate=null,log=console.error}){
  const today=()=>madridDate(new Date(now()));
  const errors={
    limite:[429,`Ya has propuesto ${RULES.maxProposals} preguntas esta semana.`],
    saldo:[402,'No te llegan los faradios.'],
    'no-existe':[404,'Esa pregunta ya no existe.'],
    cerrada:[409,'La votación de esa pregunta ya está cerrada.'],
    propia:[409,'No puedes votar tu propia pregunta.'],
    repetido:[409,'Ya has votado esta pregunta.']
  };
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
      const result=await community.vote(data.id.toLowerCase(),current,player,RULES.voteCost);
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
    const result=await community.propose({id:randomUUID(),round:current,player,name,avatar:cleanAvatar(data.avatar),...proposal,createdAt:now()},RULES.proposeCost,RULES.maxProposals);
    return result.error?failed(result.error):{status:200,body:{coins:result.coins,title:proposal.title,unit:proposal.unit}};
  }

  // Progreso con cuenta: leer lo guardado o guardar el del navegador. delta = cuánto cambió el saldo desde la última vez.
  async function progress(data,{player}){
    if(!player)return {status:401,body:{error:'Sin cuenta, el progreso se guarda solo en este navegador.',code:'cuenta'}};
    if(data.action==='leer'){const row=await community.progress(player);return {status:200,body:row?{state:row.state,coins:row.coins}:{state:null,coins:null}}}
    if(data.action!=='guardar')return {status:400,body:{error:'Acción no válida'}};
    const state=data.state,delta=Number.isInteger(data.delta)?data.delta:0;
    if(!state||typeof state!=='object'||Array.isArray(state)||Math.abs(delta)>1e7)return {status:400,body:{error:'Progreso no válido'}};
    const {coins,...rest}=state;
    const coinsNow=await community.saveProgress(player,rest,delta,today(),RULES.dailyGain,RULES.firstGain);
    return {status:200,body:{coins:coinsNow}};
  }
  return {handle,progress};
}
