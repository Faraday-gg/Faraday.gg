import fs from 'node:fs';
import path from 'node:path';
import {madridDate} from '../content-engine.mjs';

const bank=JSON.parse(fs.readFileSync(new URL('../content/tendencias.json',import.meta.url),'utf8'));
const START=Date.parse('2026-11-17');
const ROUNDS=3;
const MIN_COMMUNITY=3;

export function trendEdition(date){
  const offset=Math.floor((Date.parse(date)-START)/86400000);
  const editions=bank.length/ROUNDS;
  const first=((offset%editions)+editions)%editions*ROUNDS;
  return bank.slice(first,first+ROUNDS);
}

function roundView(chart){
  const {id,title,detail,unit,start,cut,min,max,tick,precision}=chart;
  return {id,title,detail,unit,start,cut,min,max,tick,precision,history:chart.values.slice(0,cut+1),end:start+chart.values.length-1};
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
  const key=(scope,date,player,round)=>[scope,date,player,round].join('/');
  return {
    async answers(scope,date,player){
      return Object.values(rows).filter(row=>row.scope===scope&&row.day===date&&row.player_hash===player);
    },
    async add(row){
      const id=key(row.scope,row.day,row.player_hash,row.round);
      if(rows[id])return;
      const updated={...rows,[id]:row};
      if(target){
        fs.mkdirSync(path.dirname(target),{recursive:true});
        fs.writeFileSync(target+'.tmp',JSON.stringify(updated),{mode:0o600});
        fs.renameSync(target+'.tmp',target);
      }
      rows=updated;
    },
    async community(scope,date,player,chart){
      const others=Object.values(rows).filter(row=>row.scope===scope&&row.day===date&&row.player_hash!==player&&row.chart===chart);
      return {count:others.length,values:others.length<MIN_COMMUNITY?null:others[0].guess.map((_,index)=>
        others.reduce((sum,row)=>sum+row.guess[index],0)/others.length)};
    }
  };
}

export function createTrends({store,now=Date.now,scope='publico'}){
  return async function handle(player,data){
    const date=madridDate(new Date(now()));
    const charts=trendEdition(date);
    if(data.action==='revelar'&&data.date!==date)return {status:409,body:{error:'Ya empezó una edición nueva. Carga la partida de hoy.'}};
    if(data.action!=='estado'&&data.action!=='revelar')return {status:400,body:{error:'Acción no válida'}};
    let answers=await store.answers(scope,date,player);
    if(data.action==='revelar'){
      const index=charts.findIndex(chart=>chart.id===data.chart);
      const chart=charts[index];
      if(!chart)return {status:400,body:{error:'Gráfica no válida'}};
      if(!answers.some(row=>row.round===index)){
        if(index!==answers.length)return {status:409,body:{error:'Completa primero la gráfica anterior'}};
        if(!Array.isArray(data.guess)||data.guess.length!==chart.values.length-chart.cut-1||
          !data.guess.every(value=>Number.isFinite(value)&&value>=chart.min&&value<=chart.max)){
          return {status:400,body:{error:'Dibuja todos los años dentro de la gráfica'}};
        }
        const guess=data.guess.map(value=>Number(value.toFixed(chart.precision)));
        await store.add({scope,day:date,player_hash:player,round:index,chart:chart.id,guess});
        answers=await store.answers(scope,date,player);
      }
    }
    answers.sort((a,b)=>a.round-b.round);
    const results=await Promise.all(answers.map(async ({round,guess})=>{
      const chart=charts[round];
      const sample=await store.community(scope,date,player,chart.id);
      return {...roundView(chart),...trendScore(chart,guess),actual:chart.values.slice(chart.cut+1),guess,
        community:{count:sample.count,values:sample.count>=MIN_COMMUNITY?sample.values:null},
        source:chart.source};
    }));
    return {status:200,body:{date,rounds:ROUNDS,results,current:charts[answers.length]?roundView(charts[answers.length]):null}};
  };
}
