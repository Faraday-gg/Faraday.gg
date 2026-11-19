// Escenarios reproducibles, no una predicción de usuarios reales. Sin red ni datos personales.
import fs from 'node:fs';
import {simulateTrends,trendScore} from '../lib/tendencias.mjs';
import {trendPrize} from '../lib/premios.mjs';
import {PROPUESTA,PERFILES,average} from './simular-economia.mjs';

const bank=JSON.parse(fs.readFileSync(new URL('../content/tendencias-estables.json',import.meta.url)));
const scores=[];
for(let index=0;index<bank.length;index+=3){
  const rounds=bank.slice(index,index+3).map(chart=>simulateTrends({...chart,history:chart.values.slice(0,chart.cut+1),end:chart.start+chart.values.length-1})
    .map(guess=>trendScore(chart,guess).score));
  for(let player=0;player<200;player++)scores.push(rounds.reduce((sum,round)=>sum+round[player],0));
}
const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
console.log(JSON.stringify({samples:scores.length,meanScore:mean(scores),meanCoins:mean(scores.map(score=>trendPrize(score).amount)),
  chestPercent:100*scores.filter(score=>trendPrize(score).chest).length/scores.length}));
// No todos tienen el mismo acierto: incluye también un escenario extremo de 3.000 puntos todos los días.
for(const [name,profile] of Object.entries(PERFILES)){
  for(const [scenario,trendScores] of [['modelos',scores],['perfecto',[3000]]]){
    const base=average({rules:PROPUESTA,profile,days:365,players:40});
    const next=average({rules:{...PROPUESTA,trends:true},profile:{...profile,trendScores},days:365,players:40});
    console.log(JSON.stringify({profile:name,scenario,base,withTrends:next}));
  }
}
