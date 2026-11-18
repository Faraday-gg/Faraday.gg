import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApi,PLAYER_COOKIE} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {createTrends,fileTrends,simulateTrends,trendEdition,trendReplay,trendScore} from '../lib/tendencias.mjs';

const start=Date.parse('2026-11-17T00:00:00Z');
const auditedStart=start+86400000;
const ids=new Set();
const categories=new Set(),periods=new Set();
let varied=0;
for(let i=0;i<36;i++){
  const day=new Date(auditedStart+i*86400000).toISOString().slice(0,10);
  const charts=trendEdition(day);
  assert.equal(charts.length,3);
  assert.equal(new Set(charts.map(chart=>chart.category)).size,3);
  assert(trendReplay(day).every(extra=>charts.every(chart=>chart.id!==extra.id)));
  for(const chart of charts){
    assert(!ids.has(chart.id),chart.id);
    ids.add(chart.id);
    assert(chart.cut>=4);
    assert(chart.values.length-chart.cut-1>=6&&chart.values.length-chart.cut-1<=30);
    assert(chart.max>chart.min&&chart.values.every(value=>Number.isFinite(value)&&value>=chart.min&&value<=chart.max),chart.id);
    assert(chart.detail.length>15&&chart.source.provider,chart.id);
    assert(chart.context.story.length>40&&chart.source.url.startsWith('https://'),chart.id);
    categories.add(chart.category);
    periods.add(chart.period||'year');
    if(chart.labels){
      assert.equal(chart.labels.length,chart.values.length);
      assert.equal(new Set(chart.labels).size,chart.labels.length);
      if(chart.period==='season'){
        assert.equal(chart.labels.length,12);
        assert.equal(chart.labels[0],'enero');
        assert.equal(chart.labels[11],'diciembre');
      }else{
        assert.deepEqual([...chart.labels].sort((a,b)=>a-b),chart.labels);
        if(chart.period==='biennium')assert(chart.labels.slice(1).every((year,index)=>year-chart.labels[index]===2));
      }
    }
    const samples=chart.values.slice(chart.cut-1);
    const slopes=samples.slice(1).map((value,i)=>(value-samples[i])/(chart.max-chart.min));
    const hidden=slopes.slice(1);
    const turns=hidden.map((value,i)=>({from:slopes[i],to:value}));
    assert(Math.max(...hidden.map(Math.abs))<=.25,chart.id);
    assert(turns.every(({from,to})=>from*to>=0||Math.min(Math.abs(from),Math.abs(to))<=.115),chart.id);
    assert(turns.reduce((sum,{from,to})=>sum+Math.abs(from-to),0)/turns.length<=.085,chart.id);
    if(Math.max(...hidden)>.02&&Math.min(...hidden)<-.02)varied++;
    assert.deepEqual(trendScore(chart,chart.values.slice(chart.cut+1)),{score:1000,error:0});
    const forecast={...chart,end:chart.start+chart.values.length-1,history:chart.values.slice(0,chart.cut+1)};
    const simulation=simulateTrends(forecast);
    assert.equal(simulation.length,200);
    assert(simulation.every(trace=>trace.length===chart.values.length-chart.cut-1&&
      trace.every(value=>Number.isFinite(value)&&value>=chart.min&&value<=chart.max)),chart.id);
    assert(new Set(simulation.map(trace=>trace.join(','))).size>=100,chart.id);
    assert.deepEqual(simulateTrends({...forecast,values:[]}),simulation);
  }
}
assert.equal(ids.size,108);
assert.equal(categories.size,12);
assert.deepEqual(periods,new Set(['year','season','edition','biennium']));
assert(varied>=20);
const rotation=Array.from({length:36},(_,i)=>trendReplay('2026-11-18',undefined,undefined,i+1).map(chart=>chart.id));
assert.equal(new Set(rotation.slice(0,35).flat()).size,105);
assert.deepEqual(rotation[35],rotation[0]);

const temp=mkdtempSync(path.join(tmpdir(),'faraday-tendencias-'));
let clock=start;
const file=path.join(temp,'answers.json');
let api=createApi({store:fileStore(file),now:()=>clock,log:()=>{}});
const player=randomUUID();
const call=async(data,{as=player,origin='https://faraday.test',on=api}={})=>{
  const headers={'Content-Type':'application/json',origin};
  if(as)headers.Cookie=`${PLAYER_COOKIE}=${as}`;
  const response=await on.handle(new Request('https://faraday.test/api/tendencias',{method:'POST',headers,body:JSON.stringify(data)}));
  return {status:response.status,body:await response.json(),cookie:response.headers.get('Set-Cookie')};
};
try{
  const {body:state}=await call({action:'estado'});
  const [first,second,third]=trendEdition(state.date);
  assert.equal(state.current.id,first.id);
  assert.equal(state.current.history.length,first.cut+1);
  assert(!('actual' in state.current)&&!('values' in state.current)&&!('source' in state.current)&&!('context' in state.current)&&!('simulation' in state.current));
  assert.match((await call({action:'estado'},{as:null})).cookie,/faraday_jugador=/);
  assert.equal((await call({action:'estado'},{origin:'https://otra.test'})).status,403);
  const reveal=(chart,guess,game=0)=>({action:'revelar',date:state.date,game,chart:chart.id,guess});
  const traces=(chart,after=0)=>({action:'trazos',date:state.date,chart:chart.id,after});
  const replay=(action,game=1)=>({action,date:state.date,game});
  const actual=chart=>chart.values.slice(chart.cut+1);
  const constant=(chart,value)=>actual(chart).map(()=>value);
  assert.equal((await call(reveal(second,actual(second)))).status,409);
  assert.equal((await call(traces(first))).status,409);
  assert.equal((await call(traces(first,-1))).status,400);
  assert.equal((await call(replay('preparar-extra'))).status,409);
  assert.equal((await call(reveal(first,[]))).status,400);
  assert.equal((await call(reveal(first,constant(first,first.max+1)))).status,400);
  const firstGuess=actual(first).map(value=>Number(value.toFixed(first.precision)));
  const [saved,retried]=await Promise.all([
    call(reveal(first,firstGuess)),
    call(reveal(first,constant(first,first.max))),
  ]);
  assert.equal(saved.status,200);
  assert.deepEqual(retried.body.results[0].guess,saved.body.results[0].guess);
  assert.deepEqual(saved.body.results[0].actual,actual(first));
  assert(!('community' in saved.body.results[0]));
  const examples=(await call(traces(first))).body;
  assert.equal(examples.simulated,true);
  assert.equal(examples.traces.length,200);
  assert.equal(examples.next,null);
  assert.equal((await call(traces(first),{as:randomUUID()})).status,409);
  for(const value of [first.min,first.min,first.max]){
    const other=await call(reveal(first,constant(first,value)),{as:randomUUID()});
    assert.equal(other.status,200);
    assert(!('community' in other.body.results[0]));
  }
  api=createApi({store:fileStore(file),now:()=>clock,log:()=>{}});
  const resumed=(await call({action:'estado'})).body;
  assert.equal(resumed.current.id,second.id);
  assert.deepEqual((await call(traces(first))).body,{
    traces:[constant(first,first.min),constant(first,first.min),constant(first,first.max)],next:null,simulated:false
  });
  const preview=createApi({store:fileStore(file),now:()=>clock,trendScope:'preview'});
  assert.deepEqual((await call({action:'estado'},{on:preview})).body.results,[]);
  await call(reveal(second,actual(second)));
  const completed=(await call(reveal(third,actual(third)))).body;
  assert.equal(completed.current,null);
  assert.equal(completed.results.length,3);
  assert.equal((await call(reveal(first,constant(first,first.min)))).body.current,null);
  assert.equal((await call({action:'estado',player:randomUUID()})).body.current,null);
  const [extraFirst,extraSecond,extraThird]=trendReplay(state.date);
  assert.equal(completed.extra,'available');
  assert.equal((await call(reveal(extraFirst,actual(extraFirst),1))).status,409);
  assert.deepEqual((await call(replay('preparar-extra'))).body,{watch:true});
  assert.equal((await call(replay('activar-extra'))).status,400);
  clock+=15000;
  const extra=(await call(replay('activar-extra'))).body;
  assert.equal(extra.extra,'started');
  assert.equal(extra.game,1);
  assert.equal(extra.current.id,extraFirst.id);
  for(const chart of [extraFirst,extraSecond,extraThird]){
    assert.equal((await call(reveal(chart,actual(chart),1))).status,200);
  }
  api=createApi({store:fileStore(file),now:()=>clock,log:()=>{}});
  const finished=(await call({action:'estado'})).body;
  assert.equal(finished.results.length,6);
  assert.equal(finished.current,null);
  for(let game=2;game<=4;game++){
    const selected=trendReplay(state.date,undefined,undefined,game);
    assert.equal((await call(replay('activar-extra',game-1))).status,409);
    assert.equal((await call(replay('activar-extra',game))).status,400);
    assert.deepEqual((await call(replay('preparar-extra',game))).body,{watch:true});
    assert.equal((await call(replay('activar-extra',game))).status,400);
    clock+=15000;
    const opened=(await call(replay('activar-extra',game))).body;
    assert.equal(opened.game,game);
    assert.equal(opened.current.id,selected[0].id);
    assert.equal(opened.results.length,3);
    assert.equal((await call(reveal(selected[0],actual(selected[0]),game-1))).status,409);
    for(const chart of selected)assert.equal((await call(reveal(chart,actual(chart),game))).status,200);
    const result=(await call({action:'estado'})).body;
    assert.equal(result.extra,'completed');
    assert.equal(result.results.length,6);
    assert.equal(result.results[5].id,selected[2].id);
  }
  const subscriberStore=fileTrends();
  const subscriber=createTrends({store:subscriberStore,now:()=>clock,planOf:async()=>({plus:true})});
  for(const chart of [first,second,third])await subscriber('subscriber',reveal(chart,actual(chart)),true);
  const paid=await subscriber('subscriber',replay('preparar-extra'),true);
  assert.equal(paid.body.extra,'started');
  assert.equal(paid.body.current.id,extraFirst.id);
  for(const chart of [extraFirst,extraSecond,extraThird])await subscriber('subscriber',reveal(chart,actual(chart),1),true);
  const continued=await subscriber('subscriber',replay('preparar-extra',2),true);
  assert.equal(continued.body.extra,'started');
  assert.equal(continued.body.game,2);
  assert.equal(continued.body.plus,true);
  clock=Date.parse('2026-11-17T23:00:00Z');
  assert.equal((await call(reveal(first,actual(first)))).status,409);
  const next=(await call({action:'estado'})).body;
  assert.equal(next.date,'2026-11-18');
  assert.notEqual(next.current.id,first.id);
  assert.equal(next.results.length,0);
}finally{rmSync(temp,{recursive:true,force:true})}

const readBank=name=>JSON.parse(readFileSync(new URL(`../content/${name}.json`,import.meta.url),'utf8'));
const stableDate='2026-11-18',storyBank=readBank('tendencias-historias');
const storyDaily=trendEdition(stableDate,0,storyBank);
const storyExtra=trendReplay(stableDate,storyDaily,storyBank);
const cutoverStore=fileTrends();
const cutoverGame=createTrends({store:cutoverStore,now:()=>auditedStart});
const submit=(player,chart,game=0)=>cutoverGame(player,{
  date:stableDate,game,action:'revelar',chart:chart.id,guess:chart.values.slice(chart.cut+1)
});
const firstCutover=(await cutoverGame('new',{action:'estado'})).body.current;
assert.equal(firstCutover.id,'estable-clima-madrid');
assert.equal(firstCutover.period,'season');
assert.equal(firstCutover.labels[11],'diciembre');
assert(!('actual' in firstCutover)&&!('values' in firstCutover));
const newResult=await submit('new',trendEdition(stableDate)[0]);
assert.equal(newResult.body.results[0].score,1000);
assert.equal(newResult.body.current.period,'biennium');
const oldFirst=await submit('old',storyDaily[0]);
assert.equal(oldFirst.body.current.id,storyDaily[1].id);
for(const chart of storyDaily.slice(1))assert.equal((await submit('old',chart)).status,200);
await cutoverStore.startReplay('publico',stableDate,'old',1,auditedStart);
await cutoverStore.unlockReplay('publico',stableDate,'old',1);
assert.equal((await submit('old',storyExtra[0],1)).body.current.id,storyExtra[1].id);
assert.equal((await cutoverGame('old',{action:'estado'})).body.results.at(-1).score,1000);
const race=await Promise.all([submit('race',storyDaily[0]),submit('race',trendEdition(stableDate)[0])]);
assert.deepEqual(race.map(response=>response.status).sort(),[200,409]);
const winner=race.find(response=>response.status===200).body.results[0].id;
assert.equal((await cutoverGame('race',{action:'estado'})).body.results[0].id,winner);

const oldCharts=readBank('tendencias');
const oldDate='2026-11-17',old=trendEdition(oldDate,0,oldCharts)[0],oldStore=fileTrends();
await oldStore.add({scope:'publico',day:oldDate,player_hash:'legacy',round:0,chart:old.id,guess:old.values.slice(old.cut+1)});
const legacyGame=createTrends({store:oldStore,now:()=>start});
const preserved=await legacyGame('legacy',{action:'estado'});
assert.equal(preserved.body.results[0].id,old.id);
assert.notEqual(preserved.body.current.id,trendEdition(oldDate)[1].id);

const popCharts=readBank('tendencias-pop');
const oldDaily=trendEdition(oldDate,0,popCharts);
const oldReplay=trendReplay(oldDate,oldDaily,popCharts);
for(const [round,chart] of [...oldDaily,oldReplay[0]].entries()){
  await oldStore.add({scope:'publico',day:oldDate,player_hash:'pop',round,chart:chart.id,guess:chart.values.slice(chart.cut+1)});
}
await oldStore.startReplay('publico',oldDate,'pop',1,start);
await oldStore.unlockReplay('publico',oldDate,'pop',1);
const oldExtra=(await legacyGame('pop',{action:'estado'})).body;
assert.equal(oldExtra.results.at(-1).id,oldReplay[0].id);
assert.equal(oldExtra.current.id,oldReplay[1].id);
const addTrace=(player_hash,round,value,scope='publico')=>oldStore.add({
  scope,day:oldDate,player_hash,round,chart:'repeat',guess:[value]
});
await addTrace('another',0,9);
await addTrace('player-1',102,999);
for(let i=1;i<=205;i++)await addTrace(`player-${i}`,3,i);
await addTrace('preview-player',0,999,'preview');
const firstPage=await oldStore.traces('publico',oldDate,'another','repeat',0);
const lastPage=await oldStore.traces('publico',oldDate,'another','repeat',firstPage.next);
assert.equal(firstPage.traces.length,200);
assert.deepEqual(lastPage,{traces:[[201],[202],[203],[204],[205]],next:null});
assert.deepEqual([...firstPage.traces,...lastPage.traces],Array.from({length:205},(_,i)=>[i+1]));
assert.equal(await oldStore.traces('preview',oldDate,'another','repeat',0),null);

const requests=[];
const store=supabaseStore({url:'https://proyecto.supabase.co',key:'clave-falsa',fetch:async(url,options)=>{
  requests.push({url:new URL(url),options});
  return Response.json(url.includes('/rpc/')?{traces:[[10]],next:null}:[]);
}});
const playerHash='a'.repeat(64);
await store.trends.answers('preview','2026-11-17',playerHash,2);
await store.trends.add({scope:'preview',day:'2026-11-17',player_hash:playerHash,chart:'a',round:0,guess:[10]});
assert.deepEqual(await store.trends.traces('preview','2026-11-17',playerHash,'a',0),{traces:[[10]],next:null});
assert.equal(requests[0].url.searchParams.get('scope'),'eq.preview');
assert.equal(requests[0].url.searchParams.get('and'),'(round.gte.6,round.lt.9)');
assert.equal(requests[1].url.searchParams.get('on_conflict'),'scope,day,player_hash,round');
assert.match(requests[1].options.headers.Prefer,/ignore-duplicates/);
assert.equal(requests[2].url.pathname,'/rest/v1/rpc/trend_traces');
assert.deepEqual(JSON.parse(requests[2].options.body),{p_scope:'preview',p_day:oldDate,p_player:playerHash,p_chart:'a',p_after:0});
await store.trends.lastRound('preview',oldDate,playerHash);
await store.trends.startReplay('preview',oldDate,playerHash,2,start);
await store.trends.unlockReplay('preview',oldDate,playerHash,2,start);
assert.equal(requests[3].url.searchParams.get('order'),'round.desc');
assert.equal(requests[4].url.searchParams.get('on_conflict'),'scope,day,player_hash,game');
assert.equal(JSON.parse(requests[4].options.body).game,2);
assert.equal(requests[5].url.searchParams.get('game'),'eq.2');
assert.equal(requests[6].url.searchParams.get('requested_at'),`eq.${start}`);
console.log('Traza la tendencia: banco, trazos individuales, rondas ilimitadas, persistencia y Supabase simulado correctos');
