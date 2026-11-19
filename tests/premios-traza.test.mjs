import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {trendEdition,createTrendPrizes} from '../lib/tendencias.mjs';
import {trendPrize} from '../lib/premios.mjs';
import {REASONS} from '../lib/comunidad.mjs';

assert.deepEqual([0,1799,1800,2399,2400,2699,2700,3000].map(score=>trendPrize(score).amount),[10,10,15,15,25,25,35,35]);
for(const score of [-1,3001,NaN,Infinity,'3000',2700.5])assert.equal(trendPrize(score),null);
assert.equal(trendPrize(2699).chest,null);assert.equal(trendPrize(2700).chest,'chispa');
assert(!REASONS.includes('traza'),'El navegador no declara ganancias de Traza');

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'faraday-premios-traza-'));
let clock=Date.parse('2026-11-19T10:00:00Z');
const date='2026-11-19',hash=player=>createHash('sha256').update(player).digest('hex');
const store=fileStore(path.join(directory,'answers.json'));
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'prueba@example.test',player},cookies:[]}:null}};
const api=createApi({store,persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,player,body){
  const response=await api.handle(new Request('http://faraday.test/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(player?{cookie:'faraday_sesion='+player}:{})},body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(player,action,extra={})=>post('progreso',player,{action,...extra});
async function user(){const player=randomUUID();await progress(player,'guardar',{state:{v:1,xp:0},delta:0});return player}
async function play(player,count=3,day=date){
  let response;
  for(const chart of trendEdition(day).slice(0,count))response=await post('tendencias',player,{action:'revelar',date:day,chart:chart.id,guess:chart.values.slice(chart.cut+1)});
  return response;
}
const claim=player=>progress(player,'premio-traza',{day:date,score:0,amount:999999,chest:'dinamo',game:999});
try{
  assert.equal((await claim(null)).status,401);
  const player=await user();
  assert.equal((await claim(player)).status,409);
  await play(player,2);assert.equal((await claim(player)).status,409);
  const completed=await play(player);assert.equal(completed.data.reward.amount,35);assert.equal(completed.data.reward.chest,'chispa');
  const before=(await progress(player,'estado')).data.chests.chispa;
  // Peticiones concurrentes: una sola emisión y un solo cofre, calculados de las respuestas guardadas.
  const claims=await Promise.all(Array.from({length:4},()=>claim(player)));
  assert(claims.every(result=>result.status===200));
  assert.equal(claims.reduce((sum,result)=>sum+result.data.amount,0),35);
  assert.equal((await progress(player,'estado')).data.chests.chispa,before+1);
  assert.equal((await claim(player)).data.repeated,true);
  assert.equal((await progress(player,'movimientos')).data.moves.filter(row=>row.reason==='traza').length,1);
  // La cuenta Plus recibe exactamente lo mismo.
  const plus=await user();await store.community.setSubscription(hash(plus),clock+86400000);await play(plus);
  assert.equal((await claim(plus)).data.amount,35);
  // Los extras no generan otro premio ni otro cofre, aunque se completen o se manden puntos inventados.
  const extra=await post('tendencias',plus,{action:'preparar-extra',date,game:1});assert.equal(extra.data.game,1);
  assert.equal((await claim(plus)).data.amount,0);
  assert.equal((await progress(plus,'estado')).data.chests.chispa,1);
  const capped=await user();await play(capped);
  await store.community.move(hash(capped),390,'misiones','prueba',date);
  const cut=await claim(capped);assert.equal(cut.data.amount,10);assert.equal(cut.data.capped,true);assert.equal(cut.data.coins,400);
  const cappedAgain=await claim(capped);assert.equal(cappedAgain.data.amount,0);assert.equal(cappedAgain.data.awarded,10);assert.equal(cappedAgain.data.capped,true);
  const full=await user();await play(full);await store.community.move(hash(full),400,'misiones','prueba',date);
  const noCoins=await claim(full);assert.equal(noCoins.data.amount,0);assert.equal(noCoins.data.chests.chispa,1);
  await claim(full);assert.equal((await progress(full,'estado')).data.chests.chispa,1);
  // Un fallo tras guardar el cofre se recupera sin duplicarlo.
  const retry=await user();await play(retry);const move=store.community.move;let fails=true;
  store.community.move=async(...args)=>{if(args[2]==='traza'&&fails){fails=false;throw Error('fallo de prueba')}return move(...args)};
  assert.equal((await claim(retry)).status,503);
  assert.equal((await claim(retry)).data.amount,35);
  assert.equal((await progress(retry,'estado')).data.chests.chispa,1);store.community.move=move;
  // Otra fecha y otro scope no convierten un extra o una partida inexistente en premio.
  const preview=createTrendPrizes({store:store.trends,scope:'preview',today:()=>date});
  assert.equal(await preview(hash(player),date),null);
  assert.equal((await progress(player,'premio-traza',{day:'2026-11-18'})).status,409);
  clock+=86400000;assert.equal((await claim(player)).status,409);
  await play(player,3,'2026-11-20');
  const sameWeek=await progress(player,'premio-traza',{day:'2026-11-20'});
  assert.equal(sameWeek.data.amount,35);assert.equal(sameWeek.data.chest,null);assert.equal(sameWeek.data.weeklyChestClaimed,true);
  assert.equal((await progress(player,'estado')).data.chests.chispa,before+1);
  clock=Date.parse('2026-11-23T10:00:00Z');await play(player,3,'2026-11-23');
  assert.equal((await progress(player,'premio-traza',{day:'2026-11-23'})).data.chest,'chispa');
  assert.equal((await progress(player,'estado')).data.chests.chispa,before+2);
  console.log('premios-traza: puntuación del servidor, concurrencia, reintentos, Plus, scopes y tope diario correctos');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
