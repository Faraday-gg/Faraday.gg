import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {madridDate} from '../content-engine.mjs';

const legacy=JSON.parse(fs.readFileSync(new URL('../content/tendencias.json',import.meta.url),'utf8'));
const popular=JSON.parse(fs.readFileSync(new URL('../content/tendencias-pop.json',import.meta.url),'utf8'));
const bank=JSON.parse(fs.readFileSync(new URL('../content/tendencias-historias.json',import.meta.url),'utf8'));
const START=Date.parse('2026-11-17');
export const ROUNDS=3;
const MIN_COMMUNITY=3;
const AD_TIME=15_000;

export function trendEdition(date,offset=0,charts=bank){
  const day=Math.floor((Date.parse(date)-START)/86400000)+offset;
  const editions=charts.length/ROUNDS;
  const first=((day%editions)+editions)%editions*ROUNDS;
  return charts.slice(first,first+ROUNDS);
}

export function trendReplay(date,daily=trendEdition(date),charts=bank,game=1){
  const rotation=Array.from({length:charts.length/ROUNDS},(_,index)=>trendEdition(date,13+index,charts))
    .filter(edition=>edition.every(chart=>!daily.some(other=>other.id===chart.id)));
  return rotation[(game-1)%rotation.length];
}

function roundView(chart){
  const {id,title,detail,unit,start,cut,min,max,tick,precision,period,labels}=chart;
  return {id,title,detail,unit,start,cut,min,max,tick,precision,period,labels,history:chart.values.slice(0,cut+1),end:start+chart.values.length-1};
}

export function simulateTrends({id,history,start,end,cut,min,max,precision}){
  const periods=end-start-cut, last=history.at(-1);
  const recent=history.slice(-4);
  const localSlope=(last-recent[0])/(recent.length-1);
  const globalSlope=(last-history[0])/(history.length-1);
  const level=recent.reduce((sum,value)=>sum+value,0)/recent.length;
  const change=history.slice(1).reduce((sum,value,i)=>sum+Math.abs(value-history[i]),0)/(history.length-1);
  const noise=Math.min((max-min)*.12,Math.max((max-min)*.018,change*.65));
  const models=[
    ()=>0,
    step=>localSlope*Math.min(step,5)+globalSlope*Math.max(0,step-5)*.5,
    step=>globalSlope*step,
    step=>(level-last)*step/(step+periods/2),
  ];
  const totals=Array(periods).fill(0);
  const profiles=8;
  for(const [modelIndex,model] of models.entries()){
    for(let profile=0;profile<profiles;profile++){
      let seed=createHash('sha256').update(`${id}/${modelIndex}/${profile}`).digest().readUInt32LE();
      const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
      const slope=.65+random()*.7;
      const bias=(random()-.5)*noise*3;
      const variation=noise*(.5+profile/profiles);
      let deviation=0;
      for(let i=0;i<periods;i++){
        const step=i+1;
        deviation=.75*deviation+(random()-.5)*variation*2;
        const value=last+model(step)*slope+bias*step/periods+deviation;
        totals[i]+=Math.min(max,Math.max(min,value));
      }
    }
  }
  const count=models.length*profiles;
  return {count,values:totals.map(value=>Number((value/count).toFixed(precision)))};
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
  const replayKey=(scope,date,player,game)=>game===1?key(scope,date,player,'replay'):key(scope,date,player,'replay',game);
  const playerRows=(scope,date,player)=>Object.values(rows).filter(row=>row.scope===scope&&row.day===date&&row.player_hash===player);
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
    async answers(scope,date,player,game){
      return playerRows(scope,date,player).filter(row=>Math.floor(row.round/ROUNDS)===game);
    },
    async lastRound(scope,date,player){
      return playerRows(scope,date,player).reduce((last,row)=>Math.max(last,row.round),-1);
    },
    async add(row){
      const id=key(row.scope,row.day,row.player_hash,row.round);
      if(!rows[id])persist(id,row);
    },
    async replay(scope,date,player,game){
      return rows[replayKey(scope,date,player,game)]||null;
    },
    async startReplay(scope,date,player,game,now){
      const id=replayKey(scope,date,player,game);
      if(!rows[id]?.unlocked)persist(id,{requested_at:now,unlocked:false});
    },
    async unlockReplay(scope,date,player,game,requested){
      const id=replayKey(scope,date,player,game);
      if(!rows[id]||(requested!==undefined&&rows[id].requested_at!==requested))return false;
      persist(id,{...rows[id],unlocked:true});
      return true;
    },
    async community(scope,date,player,chart){
      const eligible=Object.values(rows).filter(row=>row.scope===scope&&row.day===date&&row.player_hash!==player&&row.chart===chart);
      const firstByPlayer=new Map();
      for(const row of eligible){
        if(!firstByPlayer.has(row.player_hash)||firstByPlayer.get(row.player_hash).round>row.round)firstByPlayer.set(row.player_hash,row);
      }
      const others=[...firstByPlayer.values()];
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
    let dailyAnswers=await store.answers(scope,date,player,0);
    const first=dailyAnswers.find(row=>row.round===0)?.chart;
    const currentEdition=trendEdition(date);
    const older=[trendEdition(date,0,popular),trendEdition(date,0,legacy)];
    const previous=older.find(edition=>edition[0].id===first);
    const daily=previous||currentEdition;
    const replayBank=previous?popular:bank;
    let dailyDone=dailyAnswers.length===ROUNDS;
    const nextGame=dailyDone?Math.floor((await store.lastRound(scope,date,player)+1)/ROUNDS):0;
    let replay=nextGame?await store.replay(scope,date,player,nextGame):null;
    let plus=Boolean(signedIn&&dailyDone&&(await planOf(player)).plus);
    if(data.action.endsWith('-extra')){
      if(!dailyDone)return failure(409,'Acaba la partida diaria primero.');
      if(data.game!==nextGame)return failure(409,'La partida extra ya cambió. Carga la partida actual.');
      if(!replay?.unlocked){
        if(data.action==='preparar-extra'){
          await store.startReplay(scope,date,player,nextGame,time);
          if(!plus)return {status:200,body:{watch:true}};
          await store.unlockReplay(scope,date,player,nextGame);
        }else{
          if(!replay||time-replay.requested_at<AD_TIME)return failure(400,'Completa el anuncio de prueba para desbloquear la partida.');
          if(!await store.unlockReplay(scope,date,player,nextGame,replay.requested_at))return failure(409,'Vuelve a iniciar el anuncio de prueba.');
        }
        replay={unlocked:true};
      }
    }
    const game=nextGame&&!replay?.unlocked?nextGame-1:nextGame;
    const charts=game?trendReplay(date,daily,replayBank,game):daily;
    let answers=game?await store.answers(scope,date,player,game):dailyAnswers;
    if(data.action==='revelar'){
      if((data.game??0)!==game)return failure(409,'La partida ya cambió. Carga la partida actual.');
      const index=charts.findIndex(chart=>chart.id===data.chart);
      const chart=charts[index];
      if(!chart)return failure(400,'Gráfica no válida');
      const round=game*ROUNDS+index;
      if(!answers.some(row=>row.round===round)){
        if(index!==answers.length)return failure(409,'Completa primero la gráfica anterior');
        if(!Array.isArray(data.guess)||data.guess.length!==chart.values.length-chart.cut-1||
          !data.guess.every(value=>Number.isFinite(value)&&value>=chart.min&&value<=chart.max)){
          return failure(400,'Completa todos los puntos dentro de la gráfica');
        }
        const guess=data.guess.map(value=>Number(value.toFixed(chart.precision)));
        await store.add({scope,day:date,player_hash:player,round,chart:chart.id,guess});
        answers=await store.answers(scope,date,player,game);
        if(game===0)dailyAnswers=answers;
        if(!dailyDone&&dailyAnswers.length===ROUNDS){
          dailyDone=true;
          plus=Boolean(signedIn&&(await planOf(player)).plus);
        }
      }
    }
    const visible=game?[...dailyAnswers,...answers]:dailyAnswers;
    visible.sort((a,b)=>a.round-b.round);
    const results=await Promise.all(visible.map(async ({round,guess})=>{
      const chart=(round<ROUNDS?daily:charts)[round%ROUNDS];
      const view=roundView(chart);
      const sample=await store.community(scope,date,player,chart.id);
      return {...view,...trendScore(chart,guess),actual:chart.values.slice(chart.cut+1),guess,
        community:{count:sample.count,values:sample.count>=MIN_COMMUNITY?sample.values:null},
        simulation:sample.count<MIN_COMMUNITY?simulateTrends(view):null,
        source:chart.source,context:chart.context};
    }));
    return {status:200,body:{date,game,rounds:ROUNDS,results,current:charts[answers.length]?roundView(charts[answers.length]):null,
      extra:game?(answers.length===ROUNDS?'completed':'started'):dailyDone?'available':null,plus}};
  };
}
