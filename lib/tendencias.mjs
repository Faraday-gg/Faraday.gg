import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {madridDate} from '../content-engine.mjs';
import {trendPrize} from './premios.mjs';

const legacy=JSON.parse(fs.readFileSync(new URL('../content/tendencias.json',import.meta.url),'utf8'));
const popular=JSON.parse(fs.readFileSync(new URL('../content/tendencias-pop.json',import.meta.url),'utf8'));
const stories=JSON.parse(fs.readFileSync(new URL('../content/tendencias-historias.json',import.meta.url),'utf8'));
const bank=JSON.parse(fs.readFileSync(new URL('../content/tendencias-estables.json',import.meta.url),'utf8'));
const AUDITED_FROM='2026-11-18';
const START=Date.parse('2026-11-17');
const AUDITED_START=Date.parse(AUDITED_FROM);
export const ROUNDS=3;
const TRACE_PAGE=200;
const AD_TIME=15_000;
const chartById=new Map([...legacy,...popular,...stories,...bank].map(chart=>[chart.id,chart]));

const bankFor=date=>date>=AUDITED_FROM?bank:stories;

export function trendEdition(date,offset=0,charts=bankFor(date)){
  const start=charts===bank?AUDITED_START:START;
  const day=Math.floor((Date.parse(date)-start)/86400000)+offset;
  const editions=charts.length/ROUNDS;
  const first=((day%editions)+editions)%editions*ROUNDS;
  return charts.slice(first,first+ROUNDS);
}

export function trendReplay(date,daily=trendEdition(date),charts=bankFor(date),game=1){
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
  const traces=[];
  const profiles=50;
  for(const [modelIndex,model] of models.entries()){
    for(let profile=0;profile<profiles;profile++){
      let seed=createHash('sha256').update(`${id}/${modelIndex}/${profile}`).digest().readUInt32LE();
      const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
      const slope=.65+random()*.7;
      const bias=(random()-.5)*(max-min)*.52;
      const variation=noise*(.5+profile/profiles);
      let deviation=0;
      const trace=[];
      for(let i=0;i<periods;i++){
        const step=i+1;
        deviation=.75*deviation+(random()-.5)*variation*2;
        const value=last+model(step)*slope+bias*step/periods+deviation;
        trace.push(Number(Math.min(max,Math.max(min,value)).toFixed(precision)));
      }
      traces.push(trace);
    }
  }
  return traces;
}

export function trendScore(chart,guess){
  const actual=chart.values.slice(chart.cut+1);
  const error=actual.reduce((sum,value,index)=>sum+Math.abs(guess[index]-value),0)/actual.length;
  const score=Math.max(0,Math.round(1000*(1-2*error/(chart.max-chart.min))));
  return {score,error};
}

// Nunca acepta puntos del navegador ni partidas extra. Lee las tres respuestas persistidas.
export function createTrendPrizes({store,scope='publico',today}){
  return async (player,date)=>{
    if(date!==today())return null;
    const rows=await store.answers(scope,date,player,0);
    if(rows.length!==ROUNDS||new Set(rows.map(row=>row.round)).size!==ROUNDS)return null;
    let score=0;
    for(let round=0;round<ROUNDS;round++){
      const row=rows.find(answer=>answer.round===round),chart=chartById.get(row?.chart);
      if(!chart||row.guess.length!==chart.values.length-chart.cut-1)return null;
      score+=trendScore(chart,row.guess).score;
    }
    const prize=trendPrize(score);
    return prize?{...prize,score}:null;
  };
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
    async traces(scope,date,player,chart,after){
      const eligible=Object.values(rows).map((row,index)=>({row,id:index+1})).filter(({row})=>
        row.scope===scope&&row.day===date&&row.chart===chart);
      if(!eligible.some(({row})=>row.player_hash===player))return null;
      const firstByPlayer=new Map();
      for(const attempt of eligible){
        const {row}=attempt;
        if(row.player_hash===player)continue;
        if(!firstByPlayer.has(row.player_hash)||firstByPlayer.get(row.player_hash).row.round>row.round)firstByPlayer.set(row.player_hash,attempt);
      }
      const page=[...firstByPlayer.values()].filter(item=>item.id>after).sort((a,b)=>a.id-b.id).slice(0,TRACE_PAGE+1);
      return {traces:page.slice(0,TRACE_PAGE).map(({row})=>row.guess),next:page.length>TRACE_PAGE?page[TRACE_PAGE-1].id:null};
    }
  };
}

export function createTrends({store,now=Date.now,scope='publico',planOf=async()=>({plus:false})}){
  return async function handle(player,data,signedIn){
    const accepted=['estado','revelar','preparar-extra','activar-extra','trazos'];
    const failure=(status,error)=>({status,body:{error}});
    if(!accepted.includes(data.action))return failure(400,'Acción no válida');
    const time=now(),date=madridDate(new Date(time));
    if(data.action!=='estado'&&data.date!==date)return failure(409,'Ya empezó una edición nueva. Carga la partida de hoy.');
    if(data.action==='trazos'){
      const chart=chartById.get(data.chart),after=data.after??0;
      if(!chart||!Number.isSafeInteger(after)||after<0)return failure(400,'Gráfica o página no válida');
      const page=await store.traces(scope,date,player,chart.id,after);
      if(!page)return failure(409,'Revela la gráfica antes de ver los trazos.');
      const simulated=after===0&&page.traces.length===0;
      return {status:200,body:simulated?{traces:simulateTrends(roundView(chart)),next:null,simulated}:{...page,simulated}};
    }
    let dailyAnswers=await store.answers(scope,date,player,0);
    // Una pestaña que ya dibujaba cuando cambió el banco puede enviar su primer trazo ese mismo día.
    const openChart=date===AUDITED_FROM&&data.action==='revelar'&&(data.game??0)===0?data.chart:null;
    const first=dailyAnswers.find(row=>row.round===0)?.chart??openChart;
    const previous=[stories,popular,legacy].find(charts=>first&&trendEdition(date,0,charts)[0].id===first);
    const dailyBank=previous||bankFor(date);
    const daily=trendEdition(date,0,dailyBank);
    const replayBank=dailyBank===legacy?popular:dailyBank;
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
        if(answers.find(row=>row.round===round)?.chart!==chart.id)return failure(409,'La gráfica ya cambió. Carga la partida actual.');
        if(game===0)dailyAnswers=answers;
        if(!dailyDone&&dailyAnswers.length===ROUNDS){
          dailyDone=true;
          plus=Boolean(signedIn&&(await planOf(player)).plus);
        }
      }
    }
    const visible=game?[...dailyAnswers,...answers]:dailyAnswers;
    visible.sort((a,b)=>a.round-b.round);
    const results=visible.map(({round,guess})=>{
      const chart=(round<ROUNDS?daily:charts)[round%ROUNDS];
      return {...roundView(chart),...trendScore(chart,guess),actual:chart.values.slice(chart.cut+1),guess,
        source:chart.source,context:chart.context};
    });
    const dailyScore=results.slice(0,ROUNDS).reduce((sum,result)=>sum+result.score,0);
    return {status:200,body:{date,game,rounds:ROUNDS,results,reward:dailyDone?{...trendPrize(dailyScore),score:dailyScore}:null,current:charts[answers.length]?roundView(charts[answers.length]):null,
      extra:game?(answers.length===ROUNDS?'completed':'started'):dailyDone?'available':null,plus}};
  };
}
