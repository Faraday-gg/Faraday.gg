import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApi,PLAYER_COOKIE} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {createTrends,fileTrends,simulateTrends,trendEdition,trendReplay,trendScore} from '../lib/tendencias.mjs';

const start=Date.parse('2026-11-17T00:00:00Z');
const ids=new Set();
const categories=new Map();
let tournaments=0;
for(let i=0;i<34;i++){
  const day=new Date(start+i*86400000).toISOString().slice(0,10);
  const charts=trendEdition(day);
  assert.equal(charts.length,3);
  assert(trendReplay(day).every(extra=>charts.every(chart=>chart.id!==extra.id)));
  for(const chart of charts){
    assert(!ids.has(chart.id),chart.id);
    ids.add(chart.id);
    assert(chart.cut>=5);
    assert(chart.values.length-chart.cut-1>=6&&chart.values.length-chart.cut-1<=30);
    assert(chart.max>chart.min&&chart.values.every(value=>Number.isFinite(value)&&value>=chart.min&&value<=chart.max),chart.id);
    assert(chart.detail.length>15&&chart.source.provider,chart.id);
    assert(chart.context.story.length>40&&chart.source.url.startsWith('https://'),chart.id);
    categories.set(chart.category,(categories.get(chart.category)||0)+1);
    if(chart.period==='edition'){
      tournaments++;
      assert.equal(chart.labels.length,chart.values.length);
      assert.deepEqual([...chart.labels].sort((a,b)=>a-b),chart.labels);
      assert.equal(new Set(chart.labels).size,chart.labels.length);
      assert.equal(chart.labels[0],1950);
    }
    assert.deepEqual(trendScore(chart,chart.values.slice(chart.cut+1)),{score:1000,error:0});
    const forecast={...chart,end:chart.start+chart.values.length-1,history:chart.values.slice(0,chart.cut+1)};
    const simulation=simulateTrends(forecast);
    assert.equal(simulation.count,32);
    assert.equal(simulation.values.length,chart.values.length-chart.cut-1);
    assert(simulation.values.every(value=>Number.isFinite(value)&&value>=chart.min&&value<=chart.max),chart.id);
    assert.deepEqual(simulateTrends({...forecast,values:[]}),simulation);
  }
}
assert.equal(ids.size,102);
assert.equal(categories.size,6);
assert([...categories.values()].every(count=>count===17));
assert.equal(tournaments,17);
const rotation=Array.from({length:34},(_,i)=>trendReplay('2026-11-17',undefined,undefined,i+1).map(chart=>chart.id));
assert.equal(new Set(rotation.slice(0,33).flat()).size,99);
assert.deepEqual(rotation[33],rotation[0]);

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
  const replay=(action,game=1)=>({action,date:state.date,game});
  const actual=chart=>chart.values.slice(chart.cut+1);
  const constant=(chart,value)=>actual(chart).map(()=>value);
  assert.equal((await call(reveal(second,actual(second)))).status,409);
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
  assert.deepEqual(saved.body.results[0].community,{count:0,values:null});
  assert.equal(saved.body.results[0].simulation.count,32);
  assert.deepEqual(saved.body.results[0].simulation,retried.body.results[0].simulation);
  for(const value of [first.min,first.min,first.max]){
    const other=await call(reveal(first,constant(first,value)),{as:randomUUID()});
    assert.equal(other.status,200);
    if(value===first.min)assert.equal(other.body.results[0].community.values,null);
  }
  api=createApi({store:fileStore(file),now:()=>clock,log:()=>{}});
  const resumed=(await call({action:'estado'})).body;
  assert.equal(resumed.current.id,second.id);
  assert.equal(resumed.results[0].community.count,3);
  assert(resumed.results[0].community.values.every(value=>value===(2*first.min+first.max)/3));
  assert.equal(resumed.results[0].simulation,null);
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
for(const [player_hash,round,value] of [['one',3,10],['one',102,99],['two',3,20],['three',3,30]]){
  await oldStore.add({scope:'publico',day:oldDate,player_hash,round,chart:'repeat',guess:[value]});
}
assert.deepEqual(await oldStore.community('publico',oldDate,'another','repeat'),{count:3,values:[20]});

const requests=[];
const store=supabaseStore({url:'https://proyecto.supabase.co',key:'clave-falsa',fetch:async(url,options)=>{
  requests.push({url:new URL(url),options});
  return Response.json(url.includes('/rpc/')?{count:3,values:[10]}:[]);
}});
const playerHash='a'.repeat(64);
await store.trends.answers('preview','2026-11-17',playerHash,2);
await store.trends.add({scope:'preview',day:'2026-11-17',player_hash:playerHash,chart:'a',round:0,guess:[10]});
assert.deepEqual(await store.trends.community('preview','2026-11-17',playerHash,'a'),{count:3,values:[10]});
assert.equal(requests[0].url.searchParams.get('scope'),'eq.preview');
assert.equal(requests[0].url.searchParams.get('and'),'(round.gte.6,round.lt.9)');
assert.equal(requests[1].url.searchParams.get('on_conflict'),'scope,day,player_hash,round');
assert.match(requests[1].options.headers.Prefer,/ignore-duplicates/);
assert.equal(JSON.parse(requests[2].options.body).p_player,playerHash);
await store.trends.lastRound('preview',oldDate,playerHash);
await store.trends.startReplay('preview',oldDate,playerHash,2,start);
await store.trends.unlockReplay('preview',oldDate,playerHash,2,start);
assert.equal(requests[3].url.searchParams.get('order'),'round.desc');
assert.equal(requests[4].url.searchParams.get('on_conflict'),'scope,day,player_hash,game');
assert.equal(JSON.parse(requests[4].options.body).game,2);
assert.equal(requests[5].url.searchParams.get('game'),'eq.2');
assert.equal(requests[6].url.searchParams.get('requested_at'),`eq.${start}`);
console.log('Traza la tendencia: banco, simulación, agregados, rondas ilimitadas, persistencia y Supabase simulado correctos');
