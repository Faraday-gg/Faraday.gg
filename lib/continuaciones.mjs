// Anuncios de continuación de prueba. El proveedor real deberá confirmar su propia recompensa.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {madridDate} from '../content-engine.mjs';

export const CONTINUATION_MODES=['daily','trends','duel','duel3','ranked','practice','ascension','archivo-vivo'];
export const DUEL_AD_MODES=['duel','duel3','ranked','practice'];
export const AD_SECONDS={first:15,long:60};
const UUID=/^[a-f0-9-]{36}$/i;
export function fileContinuations(target){
  let rows={};
  if(target)try{rows=JSON.parse(fs.readFileSync(target,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
  const id=(scope,day,player,key)=>[scope,day,player,key].join('/');
  function save(){if(target){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.tmp',JSON.stringify(rows),{mode:0o600});fs.renameSync(target+'.tmp',target)}}
  return {
    async get(scope,day,player,key){return structuredClone(rows[id(scope,day,player,key)]||null)},
    async put(scope,day,player,key,state,version){
      const keyId=id(scope,day,player,key),old=rows[keyId];
      if((old?.version||0)!==version)return false;
      rows[keyId]={state:structuredClone(state),version:version+1};save();return true;
    },
    async list(scope,day,player,prefix){return Object.entries(rows).filter(([key])=>key.startsWith(id(scope,day,player,prefix))).map(([key,row])=>({key:key.split('/').at(-1),...structuredClone(row)}))}
  };
}

export function createContinuations({store,now=Date.now,scope='publico',planOf=async()=>({plus:false}),canDaily=async()=>true,questions=()=>[]}){
  const today=()=>madridDate(new Date(now()));
  const fail=(status,message)=>Object.assign(new Error(message),{status});
  const key=mode=>'ad:'+mode;
  const data=async(player,mode)=>(await store.get(scope,today(),player,key(mode)))?.state||{grants:[],pending:null};
  async function change(player,rowKey,edit){
    const day=today();
    for(let retry=0;retry<12;retry++){
      const row=await store.get(scope,day,player,rowKey),state=row?.state||{grants:[],pending:null};
      const result=edit(state);
      if(result?.unchanged)return result.value;
      if(await store.put(scope,day,player,rowKey,state,row?.version||0))return result;
    }
    throw fail(409,'Hay otra operación en marcha. Inténtalo de nuevo.');
  }
  async function status(player,mode,signedIn=false){
    if(!CONTINUATION_MODES.includes(mode))throw fail(400,'Modalidad no válida.');
    const row=await data(player,mode),plus=!!(signedIn&&(await planOf(player)).plus);
    let id=null,ticket=!DUEL_AD_MODES.includes(mode)?row.grants.find(grant=>!grant.usedFor)?.id:null;
    if(mode==='daily'){
      const games=await store.list(scope,today(),player,'daily:');
      id=games.find(game=>game.state.guesses.length<3)?.key.slice(6)||null;
      ticket??=row.grants.find(grant=>grant.usedFor?.startsWith('daily:')&&!games.some(game=>game.key===grant.usedFor))?.id;
    }
    return {date:today(),mode,plus,watched:row.grants.length,seconds:row.grants.length?AD_SECONDS.long:AD_SECONDS.first,simulated:true,id,ticket:ticket||null,ready:!!ticket};
  }
  async function prepare(player,mode,signedIn=false){
    const info=await status(player,mode,signedIn);
    if(mode==='daily'&&!await canDaily(player))throw fail(409,'Termina primero el reto de hoy.');
    if(info.id)return {...info,watch:false};
    if(info.plus)return {...info,watch:false};
    if(!DUEL_AD_MODES.includes(mode)){
      const ticket=info.ticket||await available(player,mode);
      if(ticket)return {...info,watch:false,ticket};
    }
    return change(player,key(mode),row=>{
      if(!row.pending||now()-row.pending.at>15*60_000)row.pending={id:randomUUID(),at:now(),seconds:row.grants.length?AD_SECONDS.long:AD_SECONDS.first};
      return {...info,seconds:row.pending.seconds,ticket:row.pending.id,watch:true};
    });
  }
  async function complete(player,mode,ticket){
    if(!CONTINUATION_MODES.includes(mode)||!UUID.test(ticket||''))throw fail(400,'Anuncio no válido.');
    return change(player,key(mode),row=>{
      const old=row.grants.find(grant=>grant.id===ticket);
      if(old)return {unchanged:true,value:{ticket,watched:row.grants.length}};
      if(row.pending?.id!==ticket||now()-row.pending.at<row.pending.seconds*1000||now()-row.pending.at>15*60_000)throw fail(409,'Completa el anuncio antes de continuar.');
      row.grants.push({id:ticket,at:now(),usedFor:null});row.pending=null;
      return {ticket,watched:row.grants.length};
    });
  }
  async function cancel(player,mode,ticket){
    if(!CONTINUATION_MODES.includes(mode))throw fail(400,'Modalidad no válida.');
    return change(player,key(mode),row=>{if(row.pending?.id===ticket)row.pending=null;return {cancelled:true}});
  }
  async function available(player,mode,purpose){
    const grants=(await data(player,mode)).grants;
    return (grants.find(grant=>purpose&&grant.usedFor===purpose)||grants.find(grant=>!grant.usedFor))?.id||null;
  }
  async function consume(player,mode,ticket,purpose){
    return change(player,key(mode),row=>{
      const grant=row.grants.find(one=>one.id===ticket);
      if(!grant||grant.usedFor&&grant.usedFor!==purpose)throw fail(409,'Ese anuncio ya desbloqueó otra partida.');
      grant.usedFor=purpose;return {ticket};
    });
  }
  async function duelBonus(player){
    const rows=await Promise.all(DUEL_AD_MODES.map(mode=>data(player,mode)));
    return rows.reduce((sum,row)=>sum+row.grants.length,0);
  }
  const practiceView=(id,state)=>({id,date:today(),practice:true,name:'Reto extra de práctica',questions:state.questions,guesses:state.guesses});
  async function extra(player,{ticket,id},signedIn){
    if(!await canDaily(player))throw fail(409,'Termina primero el reto de hoy.');
    const plus=!!(signedIn&&(await planOf(player)).plus);
    if(id){
      if(!UUID.test(id))throw fail(400,'Partida no válida.');
      const row=await store.get(scope,today(),player,'daily:'+id);
      if(!row)throw fail(404,'Esa partida extra no existe hoy.');
      return practiceView(id,row.state);
    }
    const unfinished=(await store.list(scope,today(),player,'daily:')).find(row=>row.state.guesses.length<3);
    if(unfinished)return practiceView(unfinished.key.slice(6),unfinished.state);
    let game=randomUUID();
    if(!plus){
      const grant=(await data(player,'daily')).grants.find(one=>one.id===ticket);
      if(!grant)throw fail(409,'Completa un anuncio para jugar otra partida.');
      if(grant.usedFor){if(!grant.usedFor.startsWith('daily:'))throw fail(409,'Ese anuncio ya se usó.');game=grant.usedFor.slice(6)}
      await consume(player,'daily',ticket,'daily:'+game);
    }
    const old=await store.get(scope,today(),player,'daily:'+game);
    if(old)return practiceView(game,old.state);
    const pool=questions(today());
    const ordered=pool.map(question=>({question,rank:createHash('sha256').update(game+question.id).digest('hex')})).sort((a,b)=>a.rank.localeCompare(b.rank));
    const picked=[];
    for(const one of ordered)if(picked.length<3&&!picked.some(question=>question.category===one.question.category))picked.push(one.question);
    for(const one of ordered)if(picked.length<3&&!picked.some(question=>question.id===one.question.id))picked.push(one.question);
    if(picked.length!==3)throw fail(503,'No hay preguntas extra disponibles ahora.');
    const state={questions:picked,guesses:[],at:now()};
    await store.put(scope,today(),player,'daily:'+game,state,0);
    return practiceView(game,(await store.get(scope,today(),player,'daily:'+game)).state);
  }
  async function answer(player,{id,index,guess}){
    if(!UUID.test(id||'')||!Number.isInteger(index)||index<0||index>2||!Number.isFinite(guess)||guess<=0)throw fail(400,'Respuesta no válida.');
    if(!await store.get(scope,today(),player,'daily:'+id))throw fail(404,'Esa partida extra no existe hoy.');
    const state=await change(player,'daily:'+id,row=>{
      if(index>row.guesses.length)throw fail(409,'Responde primero la pregunta anterior.');
      if(index===row.guesses.length)row.guesses.push(guess);
      return row;
    });
    return practiceView(id,state);
  }
  async function handle(player,body,signedIn){
    const {action,mode}=body;
    if(body.date&&body.date!==today())throw fail(409,'Ya ha empezado un día nuevo. Vuelve a abrir la partida.');
    if(action==='estado')return status(player,mode,signedIn);
    if(action==='preparar')return prepare(player,mode,signedIn);
    if(action==='completar')return complete(player,mode,body.ticket);
    if(action==='cancelar')return cancel(player,mode,body.ticket);
    if(action==='reto-extra')return extra(player,body,signedIn);
    if(action==='responder-extra')return answer(player,body);
    throw fail(400,'Acción no válida.');
  }
  return {handle,status,prepare,complete,available,consume,duelBonus,pending:async(player,mode)=>(await data(player,mode)).pending};
}
