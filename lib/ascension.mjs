// Ascensión: puntos editoriales, reloj y progreso del lado del servidor.
// El navegador recibe la categoría al arrancar el reloj y solo las respuestas ya resueltas.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {madridDate} from '../content-engine.mjs';
import {createContinuations,AD_SECONDS} from './continuaciones.mjs';

export const ASCENSION_ROUNDS=7;
export const ASCENSION_SECONDS=25;
export const ASCENSION_METRES=10;
export const ASCENSION_TIERS=[
  {id:'miss',name:'Otro intento',points:0},
  {id:'common',name:'Conocida',points:10},
  {id:'familiar',name:'Ingeniosa',points:30},
  {id:'rare',name:'Rara',points:60},
  {id:'deep',name:'Extraordinaria',points:85},
  {id:'summit',name:'De cumbre',points:100}
];
const allowedPoints=new Set(ASCENSION_TIERS.slice(1).map(tier=>tier.points));
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));

// Tildes, mayúsculas, signos y espacios no hacen fallar una respuesta. Los demás nombres
// alternativos deben figurar en el banco: nunca se concede una rareza inferida por una IA.
export const ascensionNormalize=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'')
  .toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');

function categoryIndex(category){
  const index=new Map();
  for(const answer of category.answers)for(const alias of [answer.name,...answer.aliases]){
    const key=ascensionNormalize(alias),previous=index.get(key);
    if(previous&&previous.name!==answer.name)throw new Error(`Alias ambiguo en Ascensión: ${category.id}/${key}`);
    index.set(key,answer);
  }
  return index;
}

export function validateAscensionBank(raw){
  if(!raw||!Array.isArray(raw.categories)||raw.categories.length<ASCENSION_ROUNDS)throw new Error('Ascensión necesita al menos siete categorías');
  const ids=new Set();
  const categories=raw.categories.map(category=>{
    if(typeof category.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(category.id)||ids.has(category.id))throw new Error('Categoría de Ascensión no válida o repetida');
    ids.add(category.id);
    if(typeof category.title!=='string'||category.title.length<5||!Array.isArray(category.answers)||!category.answers.length)throw new Error(`Categoría vacía de Ascensión: ${category.id}`);
    const sources=category.sources||category.source;
    if(!Array.isArray(sources)||!sources.length||sources.some(source=>!source.title||!/^https:\/\//.test(source.url||'')))throw new Error(`Faltan fuentes de Ascensión: ${category.id}`);
    const answers=category.answers.map(answer=>{
      if(typeof answer.name!=='string'||!ascensionNormalize(answer.name)||!allowedPoints.has(answer.points))throw new Error(`Respuesta de Ascensión no válida: ${category.id}`);
      if(answer.aliases!==undefined&&(!Array.isArray(answer.aliases)||answer.aliases.some(alias=>typeof alias!=='string'||!ascensionNormalize(alias))))throw new Error(`Alias de Ascensión no válido: ${category.id}`);
      return {name:answer.name,aliases:[...new Set(answer.aliases||[])],points:answer.points};
    });
    if(new Set(answers.map(answer=>ascensionNormalize(answer.name))).size!==answers.length)throw new Error(`Respuesta repetida en Ascensión: ${category.id}`);
    const result={id:category.id,theme:typeof category.theme==='string'?category.theme:category.id,title:category.title,description:typeof category.description==='string'?category.description:'',sources:copy(sources),answers};
    categoryIndex(result);
    if(!answers.some(answer=>answer.points===100))throw new Error(`Categoría de Ascensión sin respuesta de cumbre: ${category.id}`);
    return result;
  }).sort((a,b)=>a.id.localeCompare(b.id));
  return {version:String(raw.version||digest(categories).slice(0,16)),categories};
}

// La versión editorial, el día y el número de práctica fijan la selección para todos.
// Se guardará una copia privada de las categorías para conservar las partidas iniciadas.
export function ascensionEdition(date,bank,game=0){
  const checked=validateAscensionBank(bank);
  const ordered=[...checked.categories].sort((a,b)=>digest(`${checked.version}/${date}/${game}/${a.id}`)
    .localeCompare(digest(`${checked.version}/${date}/${game}/${b.id}`)));
  const picked=[],themes=new Map();
  for(const category of ordered){
    if((themes.get(category.theme)||0)>=2)continue;
    picked.push(category);themes.set(category.theme,(themes.get(category.theme)||0)+1);
    if(picked.length===ASCENSION_ROUNDS)return picked;
  }
  // Bancos pequeños de pruebas o ediciones antiguas pueden tener menos de cuatro temas.
  return [...picked,...ordered.filter(category=>!picked.includes(category))].slice(0,ASCENSION_ROUNDS);
}

// Solo propone una corrección de una letra, nunca la acepta sin confirmación. Evita que
// una aproximación arbitraria termine convertida en una respuesta rara que no se escribió.
function oneEdit(a,b){
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,changes=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue}
    if(++changes>1)return false;
    if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}
  }
  return changes+(i<a.length||j<b.length?1:0)===1;
}

export function ascensionAnswer(category,value){
  const key=ascensionNormalize(value),index=categoryIndex(category),answer=index.get(key);
  if(answer)return {answer};
  if(key.length<6)return {answer:null,suggestion:null};
  const candidates=new Set();
  for(const [alias,entry] of index)if(oneEdit(key,alias))candidates.add(entry.name);
  return {answer:null,suggestion:candidates.size===1?[...candidates][0]:null};
}

function discoveries(category,accepted){
  const candidates=category.answers.filter(answer=>answer.name!==accepted?.name)
    .sort((a,b)=>digest(`${category.id}/${a.name}`).localeCompare(digest(`${category.id}/${b.name}`)));
  const selected=[];
  // Una muestra de cada nivel disponible, sin aliases ni el catálogo de la categoría.
  for(const tier of ASCENSION_TIERS.slice(1)){
    const sample=candidates.find(answer=>answer.points===tier.points);
    if(sample)selected.push(sample);
  }
  for(const answer of candidates){if(selected.length>=5)break;if(!selected.includes(answer))selected.push(answer)}
  return selected.slice(0,5).map(({name,points})=>({name,points}));
}

export function createAscension({store,bank,now=Date.now,scope='publico',log=()=>{},planOf=async()=>({plus:false})}){
  const editorial=validateAscensionBank(bank||JSON.parse(fs.readFileSync(new URL('../content/ascension.json',import.meta.url),'utf8')));
  const totalAnswers=editorial.categories.reduce((sum,category)=>sum+category.answers.length,0);
  const fail=(status,error,code)=>({status,body:{error,...(code?{code}:{})}});
  const tierOf=points=>ASCENSION_TIERS.find(tier=>tier.points===points)||ASCENSION_TIERS[0];
  const scoreOf=state=>state.results.reduce((sum,result)=>sum+result.points,0);
  function initial(day,player,game,time){
    const prompts=ascensionEdition(day,editorial,game),edition=digest({day,game,version:editorial.version,prompts}).slice(0,24);
    return {scope,day,player_hash:player,game,version:0,edition,score:0,finished_at:null,
      state:{v:1,bankVersion:editorial.version,edition,prompts,round:0,phase:'ready',startedAt:null,deadline:null,results:[],createdAt:time,finishedAt:null}};
  }
  function updated(row,state){
    return {...row,version:row.version+1,state,score:scoreOf(state),finished_at:state.finishedAt===null?null:new Date(state.finishedAt).toISOString()};
  }
  async function ensureDaily(day,player,time){
    const row=await store.get(scope,day,player,0);if(row)return row;
    const candidate=initial(day,player,0,time);
    if(await store.put(candidate,null))return candidate;
    return store.get(scope,day,player,0);
  }
  // El servicio común guarda sus recibos en el JSON privado existente de Ascensión.
  // Así esta modalidad no depende de la migración pendiente de otros modos.
  const ads=createContinuations({scope,now,planOf,store:{
    async get(_scope,day,player,key){
      if(key!=='ad:ascension')throw Object.assign(new Error('Modalidad de anuncio no válida.'),{status:400});
      const row=await ensureDaily(day,player,now());
      return {state:copy(row.state.continuationAds||{grants:[],pending:null}),version:row.version};
    },
    async put(_scope,day,player,key,value,version){
      if(key!=='ad:ascension')throw Object.assign(new Error('Modalidad de anuncio no válida.'),{status:400});
      const row=await store.get(scope,day,player,0);
      if(!row||row.version!==version)return false;
      return store.put(updated(row,{...row.state,continuationAds:copy(value)}),version);
    },
    async list(){return []}
  }});
  function settle(row,answer,reason,time){
    const state=copy(row.state),category=state.prompts[state.round],points=answer?.points||0;
    const result={round:state.round,category:category.id,title:category.title,answer:answer?.name||null,points,tier:tierOf(points),
      height:points*ASCENSION_METRES,totalHeight:(scoreOf(state)+points)*ASCENSION_METRES,reason,sources:category.sources,discoveries:discoveries(category,answer),acceptedAt:time};
    state.results.push(result);state.phase='result';
    if(state.results.length===ASCENSION_ROUNDS)state.finishedAt=time;
    return updated(row,state);
  }
  async function view(row,time,extra={}){
    const state=row.state,category=state.prompts[state.round];
    let ranking=null;
    if(row.game===0&&state.results.length===ASCENSION_ROUNDS){
      const scores=await store.scores(scope,row.day,row.edition);
      if(scores.length){
        const below=scores.filter(score=>score<row.score).length,above=scores.filter(score=>score>row.score).length;
        const peers=[...scores],ownIndex=peers.indexOf(row.score);
        if(ownIndex>=0)peers.splice(ownIndex,1);
        const bins=Array(14).fill(0);
        for(const score of peers)bins[Math.min(13,Math.max(0,Math.floor(score/50)))]++;
        const mean=peers.length?peers.reduce((sum,score)=>sum+score,0)/peers.length:0;
        const deviation=peers.length?Math.sqrt(peers.reduce((sum,score)=>sum+(score-mean)**2,0)/peers.length):0;
        ranking={total:scores.length,others:peers.length,position:above+1,tied:scores.filter(score=>score===row.score).length,
          percentile:peers.length?Math.round(below/peers.length*100):null,bins,top:[...scores].sort((a,b)=>b-a).slice(0,10),
          normal:peers.length>=5&&deviation>0?{mean,deviation}:null};
      }
    }
    return {date:row.day,game:row.game,edition:row.edition,bankVersion:state.bankVersion,round:state.round,rounds:ASCENSION_ROUNDS,
      seconds:ASCENSION_SECONDS,metresPerPoint:ASCENSION_METRES,phase:state.phase,now:now(),startedAt:state.startedAt,deadline:state.deadline,
      current:['question','result'].includes(state.phase)?{id:category.id,theme:category.theme,title:category.title,description:category.description,count:category.answers.length}:null,
      results:copy(state.results),score:row.score,height:row.score*ASCENSION_METRES,maxScore:ASCENSION_ROUNDS*100,
      bank:{version:state.bankVersion,categories:editorial.categories.length,answers:totalAnswers},catalog:{categories:editorial.categories.length,answers:totalAnswers},ranking,...extra};
  }
  const handle=async function handle(player,data={},signedIn=false){
    if(!player||typeof player!=='string')return fail(400,'Jugador no válido');
    if(!data||typeof data!=='object'||Array.isArray(data))return fail(400,'Solicitud no válida');
    const action=data.action,game=data.game??0;
    if(!['estado','empezar','responder','siguiente','preparar-practica','practica'].includes(action))return fail(400,'Acción no válida');
    if(!Number.isSafeInteger(game)||game<0||game>100000)return fail(400,'Partida no válida');
    const time=now(),day=madridDate(new Date(time));
    if((action!=='estado'&&data.date!==day)||(data.date!==undefined&&data.date!==day))return fail(409,'Ha empezado una edición nueva. Abre la partida de hoy.','edition');
    if(['empezar','responder','siguiente'].includes(action)&&(!Number.isInteger(data.round)||data.round<0||data.round>=ASCENSION_ROUNDS))return fail(400,'Ronda no válida');
    if(action==='responder'&&(typeof data.answer!=='string'||data.answer.length>160||/[\u0000-\u001f]/.test(data.answer)))return fail(400,'Escribe una respuesta de hasta 160 caracteres.');
    try{
      const plus=Boolean(signedIn&&(await planOf(player)).plus);
      async function viewWithAccess(row,time,extra={}){
        let resume=false,fromGame=row.game,seconds=AD_SECONDS.first;
        if(row.state.results.length===ASCENSION_ROUNDS){
          const latest=await store.latest(scope,day,player);
          fromGame=Math.max(row.game,latest);
          if(latest>row.game){const active=await store.get(scope,day,player,latest);resume=!!active&&active.state.results.length<ASCENSION_ROUNDS}
          seconds=(await ads.status(player,'ascension',signedIn)).seconds;
        }
        return view(row,time,{...extra,continuation:{plus,resume,fromGame,requiresAd:!plus&&!resume,adSeconds:seconds,simulated:true}});
      }
      const ok=async(row,time,extra)=>({status:200,body:await viewWithAccess(row,time,extra)});
      const daily=await ensureDaily(day,player,time);
      if(!daily)return fail(503,'No se pudo recuperar la partida. Inténtalo otra vez.');
      if(action==='practica'||action==='preparar-practica'){
        if(daily.state.results.length<ASCENSION_ROUNDS)return fail(409,'Completa la ascensión diaria antes de practicar.','daily');
        for(let attempt=0;attempt<8;attempt++){
          const latest=Math.max(0,await store.latest(scope,day,player));
          if(game>latest)return fail(409,'Recupera tu última partida antes de continuar.','game');
          const previous=await store.get(scope,day,player,latest);
          if(!previous)return fail(503,'No se pudo recuperar la partida.');
          if(previous.state.phase==='question'&&time>=previous.state.deadline){
            const expired=settle(previous,null,'timeout',previous.state.deadline);
            await store.put(expired,previous.version);
            continue;
          }
          if(game<latest||previous.state.results.length<ASCENSION_ROUNDS)return ok(previous,time);
          if(!plus){
            const purpose='ascension:'+(latest+1);
            const ticket=await ads.available(player,'ascension',purpose);
            if(action==='preparar-practica'){
              const offer=ticket?{...await ads.status(player,'ascension',signedIn),ticket,watch:false}:await ads.prepare(player,'ascension',signedIn);
              return ok(previous,time,{...offer,activate:true});
            }
            if(!data.ticket&&!ticket)return fail(409,'Completa el anuncio de prueba para abrir otra ascensión.','ad');
            await ads.consume(player,'ascension',data.ticket||ticket,purpose);
          }
          const next=initial(day,player,latest+1,time);
          if(await store.put(next,null))return ok(next,time);
        }
        return fail(409,'La partida está cambiando en otra pestaña. Vuelve a abrirla.','conflict');
      }
      for(let attempt=0;attempt<8;attempt++){
        const row=await store.get(scope,day,player,game);
        if(!row)return fail(404,'Esta partida no existe. Empieza desde la ascensión diaria.','game');
        const state=row.state;
        // La caducidad se resuelve en la siguiente petición, sin temporizadores en memoria:
        // funciona también al cerrar la pestaña y entre instancias de Vercel.
        if(state.phase==='question'&&time>=state.deadline){
          const expired=settle(row,null,'timeout',state.deadline);
          if(await store.put(expired,row.version))continue;
          continue;
        }
        if(action==='estado')return ok(row,time);
        if(data.round!==state.round){
          if(action==='responder'&&state.results.some(result=>result.round===data.round))return ok(row,time,{repeated:true});
          return {status:409,body:{...await viewWithAccess(row,time),error:'La ronda ya cambió. Recupera la partida actual.',code:'round'}};
        }
        if(action==='empezar'){
          if(state.phase!=='ready')return ok(row,time,{repeated:true});
          const next=updated(row,{...state,phase:'question',startedAt:time,deadline:time+ASCENSION_SECONDS*1000});
          if(await store.put(next,row.version))return ok(next,time);
          continue;
        }
        if(action==='responder'){
          if(state.phase==='result'||state.phase==='finished')return ok(row,time,{repeated:true});
          if(state.phase!=='question')return fail(409,'Empieza la ronda antes de responder.','start');
          const guess=data.answer.trim(),found=guess?ascensionAnswer(state.prompts[state.round],guess):{answer:null};
          if(guess&&!found.answer)return {status:422,body:{...await viewWithAccess(row,time),error:found.suggestion?'¿Querías decir esta respuesta? Confírmala antes de que termine el tiempo.':'No encontramos esa respuesta. Prueba otra; el reloj sigue corriendo.',code:'unknown',suggestion:found.suggestion}};
          const next=settle(row,found.answer,guess?'accepted':'pass',time);
          if(await store.put(next,row.version))return ok(next,time);
          continue;
        }
        if(action==='siguiente'){
          if(state.phase==='finished'||state.phase==='ready')return ok(row,time,{repeated:true});
          if(state.phase!=='result')return fail(409,'Responde o espera a que termine el tiempo.','answer');
          const last=state.round===ASCENSION_ROUNDS-1;
          const next=updated(row,{...state,round:last?state.round:state.round+1,phase:last?'finished':'ready',startedAt:null,deadline:null});
          if(await store.put(next,row.version))return ok(next,time);
        }
      }
      return fail(409,'La partida está cambiando en otra pestaña. Vuelve a abrirla.','conflict');
    }catch(error){
      if(error.status)return fail(error.status,error.message,'ad');
      log('Ascensión:',error?.message||error);
      return fail(503,'Ascensión no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.','unavailable');
    }
  };
  handle.continuation=async(player,data,signedIn=false)=>{
    if(data.mode!=='ascension'||!['estado','preparar','completar','cancelar'].includes(data.action))throw Object.assign(new Error('Acción de anuncio no válida.'),{status:400});
    const day=madridDate(new Date(now())),daily=await ensureDaily(day,player,now());
    if(daily.state.results.length<ASCENSION_ROUNDS)throw Object.assign(new Error('Completa la ascensión diaria antes de practicar.'),{status:409});
    if(data.action==='preparar'){
      const latest=await store.latest(scope,day,player);
      const result=await handle(player,{action:'preparar-practica',date:data.date||day,game:latest},signedIn);
      if(result.status!==200)throw Object.assign(new Error(result.body.error),{status:result.status});
      return result.body;
    }
    const result=await ads.handle(player,data,signedIn);
    if(data.action==='estado'){
      const latest=await store.latest(scope,day,player),active=latest>0?await store.get(scope,day,player,latest):null;
      if(active&&active.state.results.length<ASCENSION_ROUNDS)return {...result,id:String(latest),ready:true};
    }
    return result;
  };
  return handle;
}
