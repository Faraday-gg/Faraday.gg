import fs from 'node:fs';
import path from 'node:path';
import {madridDate} from '../content-engine.mjs';

const legacy=JSON.parse(fs.readFileSync(new URL('../content/tendencias.json',import.meta.url),'utf8'));
const popular=JSON.parse(fs.readFileSync(new URL('../content/tendencias-pop.json',import.meta.url),'utf8'));
const bank=JSON.parse(fs.readFileSync(new URL('../content/tendencias-historias.json',import.meta.url),'utf8'));
const START=Date.parse('2026-11-17');
const ROUNDS=3;
const MIN_COMMUNITY=3;
const AD_TIME=15_000;

export function trendEdition(date,offset=0,charts=bank){
  const day=Math.floor((Date.parse(date)-START)/86400000)+offset;
  const editions=charts.length/ROUNDS;
  const first=((day%editions)+editions)%editions*ROUNDS;
  return charts.slice(first,first+ROUNDS);
}

export function trendReplay(date,daily=trendEdition(date),charts=bank){
  let offset=13,extra;
  do{extra=trendEdition(date,offset++,charts)}while(extra.some(chart=>daily.some(other=>other.id===chart.id)));
  return extra;
}

function roundView(chart){
  const {id,title,detail,unit,start,cut,min,max,tick,precision,period,labels}=chart;
  return {id,title,detail,unit,start,cut,min,max,tick,precision,period,labels,history:chart.values.slice(0,cut+1),end:start+chart.values.length-1};
}

export function trendScore(chart,guess){
  const actual=chart.values.slice(chart.cut+1);
  const error=actual.reduce((sum,value,index)=>sum+Math.abs(guess[index]-value),0)/actual.length;
  const score=Math.max(0,Math.round(1000*(1-2*error/(chart.max-chart.min))));
  return {score,error};
}

export function fileTrends(target){
  let rows={};
  if(target){
    try{rows=JSON.parse(fs.readFileSync(target,'utf8'))}
    catch(error){if(error.code!=='ENOENT')throw error}
  }
  const key=(scope,date,player,...parts)=>[scope,date,player,...parts].join('/');
  function persist(id,row){
    const updated={...rows,[id]:row};
    if(target){
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target+'.tmp',JSON.stringify(updated),{mode:0o600});
      fs.renameSync(target+'.tmp',target);
    }
    rows=updated;
  }
  return {
    async answers(scope,date,player){
      return Object.values(rows).filter(row=>row.scope===scope&&row.day===date&&row.player_hash===player);
    },
    async add(row){
      const id=key(row.scope,row.day,row.player_hash,row.round);
      if(!rows[id])persist(id,row);
    },
    async replay(scope,date,player){
      return rows[key(scope,date,player,'replay')]||null;
    },
    async startReplay(scope,date,player,now){
      const id=key(scope,date,player,'replay');
      persist(id,{requested_at:now,unlocked:rows[id]?.unlocked??false});
    },
    async unlockReplay(scope,date,player,requested){
      const id=key(scope,date,player,'replay');
      if(requested!==undefined&&rows[id]?.requested_at!==requested)return false;
      persist(id,{...rows[id],unlocked:true});
      return true;
    },
    async community(scope,date,player,chart){
      const others=Object.values(rows).filter(row=>row.scope===scope&&row.day===date&&row.player_hash!==player&&row.chart===chart);
      return {count:others.length,values:others.length<MIN_COMMUNITY?null:others[0].guess.map((_,index)=>
        others.reduce((sum,row)=>sum+row.guess[index],0)/others.length)};
    }
  };
}

export function createTrends({store,now=Date.now,scope='publico',planOf=async()=>({plus:false})}){
  return async function handle(player,data,signedIn){
    const accepted=['estado','revelar','preparar-extra','activar-extra'];
    const failure=(status,error)=>({status,body:{error}});
    if(!accepted.includes(data.action))return failure(400,'Acción no válida');
    const time=now(),date=madridDate(new Date(time));
    if(data.action!=='estado'&&data.date!==date)return failure(409,'Ya empezó una edición nueva. Carga la partida de hoy.');
    let answers=await store.answers(scope,date,player);
    const first=answers.find(row=>row.round===0)?.chart;
    const currentEdition=trendEdition(date);
    const older=[trendEdition(date,0,popular),trendEdition(date,0,legacy)];
    const previous=older.find(edition=>edition[0].id===first);
    const daily=previous||currentEdition;
    const replayBank=previous?popular:bank;
    let dailyDone=answers.filter(row=>row.round<ROUNDS).length===ROUNDS;
    let replay=dailyDone?await store.replay(scope,date,player):null;
    let plus=Boolean(signedIn&&dailyDone&&(await planOf(player)).plus);
    if(data.action.endsWith('-extra')){
      if(!dailyDone)return failure(409,'Acaba la partida diaria primero.');
      if(!replay?.unlocked){
        if(data.action==='preparar-extra'){
          await store.startReplay(scope,date,player,time);
          if(!plus)return {status:200,body:{watch:true}};
          await store.unlockReplay(scope,date,player);
        }else{
          if(!replay||time-replay.requested_at<AD_TIME)return failure(400,'Completa el anuncio de prueba para desbloquear la partida.');
          if(!await store.unlockReplay(scope,date,player,replay.requested_at))return failure(409,'Vuelve a iniciar el anuncio de prueba.');
        }
        replay={unlocked:true};
      }
    }
    let charts=replay?.unlocked?[...daily,...trendReplay(date,daily,replayBank)]:daily;
    if(data.action==='revelar'){
      const index=charts.findIndex(chart=>chart.id===data.chart);
      const chart=charts[index];
      if(!chart)return failure(400,'Gráfica no válida');
      if(!answers.some(row=>row.round===index)){
        if(index!==answers.length)return failure(409,'Completa primero la gráfica anterior');
        if(!Array.isArray(data.guess)||data.guess.length!==chart.values.length-chart.cut-1||
          !data.guess.every(value=>Number.isFinite(value)&&value>=chart.min&&value<=chart.max)){
          return failure(400,'Completa todos los puntos dentro de la gráfica');
        }
        const guess=data.guess.map(value=>Number(value.toFixed(chart.precision)));
        await store.add({scope,day:date,player_hash:player,round:index,chart:chart.id,guess});
        answers=await store.answers(scope,date,player);
        if(!dailyDone&&answers.filter(row=>row.round<ROUNDS).length===ROUNDS){
          dailyDone=true;
          plus=Boolean(signedIn&&(await planOf(player)).plus);
          replay=await store.replay(scope,date,player);
          if(replay?.unlocked)charts=[...daily,...trendReplay(date,daily,replayBank)];
        }
      }
    }
    answers.sort((a,b)=>a.round-b.round);
    const results=await Promise.all(answers.map(async ({round,guess})=>{
      const chart=charts[round];
      const sample=await store.community(scope,date,player,chart.id);
      return {...roundView(chart),...trendScore(chart,guess),actual:chart.values.slice(chart.cut+1),guess,
        community:{count:sample.count,values:sample.count>=MIN_COMMUNITY?sample.values:null},
        source:chart.source,context:chart.context};
    }));
    return {status:200,body:{date,rounds:ROUNDS,results,current:charts[answers.length]?roundView(charts[answers.length]):null,
      extra:replay?.unlocked?(results.length===charts.length?'completed':'started'):dailyDone?'available':null,plus}};
  };
}
