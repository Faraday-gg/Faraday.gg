import {createHash,randomUUID} from 'node:crypto';
import {madridDate} from '../content-engine.mjs';
import * as catalog from '../dist/archivo-vivo-rondas.js';
import {createContinuations} from './continuaciones.mjs';

const MODE='archivo-vivo';
const ROW_KEY='ad:practice';
const STORAGE_DAY='1970-01-01';
const LEGACY_IDS=['01','02','03'];
const ROUNDS=3;
// Tiempo por foto (Contrato 5): 45 s desde que el navegador avisa de que la foto está a la vista («archivo-ver»).
// Como en Ascensión, el plazo vive en el estado privado de la partida (state.clock, que no sale en la vista) y se
// resuelve en la siguiente petición: pasado el plazo más GRACE, la foto queda sin respuesta (null en guesses, 0 puntos).
// Una partida abierta por un navegador que nunca envía «archivo-ver» (una pestaña antigua) sigue sin plazo.
export const ARCHIVO_SECONDS=45;
const GRACE=3000;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const emptyAd=()=>({grants:[],pending:null});
const empty=()=>({ad:null,initialDay:null,run:null,seen:[]});
const finished=run=>run.index===run.scenes.length;
const validYear=value=>Number.isInteger(value)&&value>=catalog.MIN_YEAR&&value<=catalog.MAX_YEAR;
const adFor=(state,day)=>state?.ad?.date===day?state.ad:emptyAd();
const openPhoto=run=>!!run&&!finished(run)&&run.guesses.length===run.index;
// El plazo vigente: solo cuenta si es el de la foto que está abierta ahora mismo.
const clockOf=state=>{const clock=state?.clock,run=state?.run;return clock&&openPhoto(run)&&clock.run===run.id&&clock.index===run.index?clock:null};
const overdue=(state,time)=>{const clock=clockOf(state);return !!clock&&time>=clock.deadline+GRACE};
// Cierra sin respuesta la foto cuyo plazo ya pasó. Devuelve true si ha cambiado el estado.
function expire(state,time){
  if(!overdue(state,time))return false;
  state.run.guesses.push(null);state.clock=null;
  return true;
}

function legacyRun(value){
  if(!Array.isArray(value?.guesses)||value.guesses.length>ROUNDS||!value.guesses.every(validYear)||
     !Number.isInteger(value.index)||value.index<0||value.index>ROUNDS||
     (value.index!==value.guesses.length&&value.index!==value.guesses.length-1))return null;
  return {index:value.index,guesses:value.guesses};
}

export function createArchivoVivo({
  store,now=Date.now,scope='publico',planOf=async()=>({plus:false}),
  sceneIds=catalog.activeSceneIds,
  initialIds=catalog.initialSceneIdsForDay??catalog.INITIAL_SCENE_IDS??LEGACY_IDS
}){
  const archiveScope='archivo-vivo-'+scope;
  const read=player=>store.get(archiveScope,STORAGE_DAY,player,ROW_KEY);
  const write=(player,state,version)=>store.put(archiveScope,STORAGE_DAY,player,ROW_KEY,state,version);
  const view=(day,run)=>({date:day,...run});
  const scenePool=[...new Set(sceneIds)];

  // Un ámbito exclusivo reutiliza el esquema ya desplegado. El día de la fila es técnico.
  // El propio estado fecha el contador y conserva la partida si el jugador cruza medianoche.
  async function change(player,edit){
    for(let attempt=0;attempt<12;attempt++){
      const row=await read(player),state=row?.state||empty();
      if(edit(state)===false)return state;
      if(await write(player,state,row?.version||0))return state;
    }
    throw fail(409,'Hay otra operación en marcha. Inténtalo de nuevo.');
  }
  function continuationsAt(time){
    return createContinuations({scope:archiveScope,now:()=>time,planOf,store:{
      async get(_scope,day,player){
        const row=await read(player);
        return row?{state:adFor(row.state,day),version:row.version}:null;
      },
      async put(_scope,day,player,adKey,value,version){
        if(adKey!=='ad:'+MODE)return false;
        const row=await read(player);
        if((row?.version||0)!==version)return false;
        const state=row?.state||empty();
        if(state.ad?.date>day||state.initialDay>day)throw fail(409,'Ya ha empezado un día nuevo.');
        return write(player,{...state,ad:{...value,date:day}},version);
      }
    }});
  }

  function nextScenes(seen,previous,id){
    const ordered=scenePool.map(scene=>({scene,rank:createHash('sha256').update(id+':'+scene).digest('hex')}))
      .sort((a,b)=>a.rank.localeCompare(b.rank)).map(one=>one.scene);
    if(ordered.length<ROUNDS)throw fail(503,'No hay suficientes fotografías para otra partida.');
    const unplayed=ordered.filter(scene=>!seen.includes(scene));
    const older=ordered.filter(scene=>seen.includes(scene)&&!previous.includes(scene));
    const previousAvailable=ordered.filter(scene=>seen.includes(scene)&&previous.includes(scene));
    const next=[...unplayed,...older,...previousAvailable].slice(0,ROUNDS);
    return {next,seen:unplayed.length<ROUNDS?next:[...seen,...next]};
  }

  function openRound(state,day,{free,legacy,grant}){
    const previous=state.run;
    const id=randomUUID();
    let picks;
    if(free){
      const opening=legacy?LEGACY_IDS:typeof initialIds==='function'?initialIds(day):initialIds;
      if(opening.length!==ROUNDS||new Set(opening).size!==ROUNDS||(!legacy&&!opening.every(scene=>scenePool.includes(scene)))){
        throw fail(503,'La colección inicial de Archivo Vivo no está disponible.');
      }
      picks={next:opening,seen:[...opening]};
    }else{
      picks=nextScenes(state.seen,previous.scenes,id);
    }
    if(free)state.initialDay=day;
    if(grant)grant.usedFor=id;
    state.seen=picks.seen;
    state.run={id,kind:legacy?'legacy':free?'initial':'extra',from:previous?.id||null,
      scenes:picks.next,guesses:legacy?.guesses||[],index:legacy?.index||0};
  }

  async function load(day,player,input,time){
    function needsRound(state){
      return !state?.run||(finished(state.run)&&state.initialDay<day);
    }
    const current=(await read(player))?.state;
    if(!needsRound(current)&&!overdue(current,time))return view(day,current.run);
    const state=await change(player,state=>{
      const late=expire(state,time);
      if(!needsRound(state))return late?undefined:false;
      openRound(state,day,{free:true,legacy:state.run?null:legacyRun(input)});
    });
    return view(day,state.run);
  }

  // El navegador tiene la foto a la vista: arranca su plazo (una sola vez por foto) y lo devuelve junto con la hora
  // del servidor, para que el reloj de la pantalla cuente lo mismo aunque el del dispositivo esté desajustado.
  async function watch(day,player,data,time){
    const {id,index}=data;
    if(typeof id!=='string'||!Number.isInteger(index)||index<0||index>=ROUNDS)throw fail(400,'Foto no válida.');
    const state=await change(player,state=>{
      const run=state.run;
      if(run?.id!==id)throw fail(409,'La partida ha cambiado. Vuelve a abrir Archivo Vivo.');
      const late=expire(state,time);
      if(index!==run.index||!openPhoto(run)||clockOf(state))return late?undefined:false;
      state.clock={run:id,index,deadline:time+ARCHIVO_SECONDS*1000};
    });
    const clock=clockOf(state);
    return {...view(day,state.run),clock:clock?{deadline:clock.deadline,now:time,seconds:ARCHIVO_SECONDS}:null};
  }

  async function extra(day,player,data,signedIn){
    const plus=!!(signedIn&&(await planOf(player)).plus);
    const state=await change(player,state=>{
      const current=state.run;
      if(!current)throw fail(409,'Termina primero la partida de Archivo Vivo.');
      if(current.id!==data.from){
        if(current.from===data.from||(current.kind==='extra'&&!finished(current)&&current.id===data.id))return false;
        throw fail(409,'La partida ha cambiado. Vuelve a abrir Archivo Vivo.');
      }
      if(!finished(current))throw fail(409,'Termina primero la partida de Archivo Vivo.');
      const free=state.initialDay<day;
      const grant=adFor(state,day).grants.find(one=>one.id===data.ticket&&!one.usedFor);
      if(!free&&!plus&&!grant)throw fail(409,'Completa un anuncio para jugar otra partida.');
      openRound(state,day,{free,grant});
    });
    return view(day,state.run);
  }

  // `timeout`: al navegador se le agotó el tiempo. Con un año válido (el que marcaba el selector) cuenta ese año;
  // sin él, la foto queda sin respuesta. Una respuesta que llega pasado el plazo y su margen ya no entra.
  async function update(day,player,data,time){
    const {id,index,guess,action}=data;
    if(typeof id!=='string'||!Number.isInteger(index)||index<0||index>=ROUNDS||
       (action==='archivo-responder'&&!validYear(guess)&&data.timeout!==true))throw fail(400,'Respuesta no válida.');
    const state=await change(player,state=>{
      const run=state.run;
      if(run?.id!==id)throw fail(409,'La partida ha cambiado. Vuelve a abrir Archivo Vivo.');
      const same=expire(state,time)?undefined:false;
      if(index<run.index)return same;
      if(index>run.index)throw fail(409,'Avanza primero a la foto anterior.');
      if(action==='archivo-responder'){
        if(run.guesses.length>index)return same;
        run.guesses.push(validYear(guess)?guess:null);
      }else{
        if(run.guesses.length<=index)throw fail(409,'Responde antes de pasar a la siguiente foto.');
        run.index++;
      }
      state.clock=null;
    });
    return view(day,state.run);
  }

  return async function handle(player,data,signedIn){
    const time=now(),day=madridDate(new Date(time));
    const {action}=data;
    if(action==='archivo-estado')return load(day,player,data.legacy,time);
    if(action==='archivo-ver')return watch(day,player,data,time);
    // El resultado de una foto sigue perteneciendo a su partida si entre medias cambia el día.
    if(action==='archivo-responder'||action==='archivo-siguiente')return update(day,player,data,time);
    if(data.date&&data.date!==day)throw fail(409,'Ya ha empezado un día nuevo. Vuelve a abrir Archivo Vivo.');
    if(action==='archivo-extra')return extra(day,player,data,signedIn);
    if(!['estado','preparar','completar','cancelar'].includes(action))throw fail(400,'Acción de anuncio no válida.');
    const ads=continuationsAt(time);
    if(action==='estado'||action==='preparar'){
      const state=(await read(player))?.state;
      const run=state?.run;
      const resume=run?.kind==='extra'&&!finished(run);
      const free=!!run&&finished(run)&&state.initialDay<day;
      if(action==='preparar'&&(!run||!finished(run)&&!resume)){
        throw fail(409,'Termina primero la partida de Archivo Vivo.');
      }
      if(action==='estado'||resume||free){
        const info=await ads.status(player,MODE,signedIn);
        return {...info,id:resume?run.id:null,free,watch:false};
      }
    }
    return ads.handle(player,{...data,mode:MODE},signedIn);
  };
}
