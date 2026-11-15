// Prueba los dos gastos nuevos de la economía (decisión 0069): proteger la racha y cambiar una misión por otra, y que
// la racha de los cofres sale de los mismos días que la del premio del reto. A través de la API, con una cuenta falsa.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {getDay} from '../content-engine.mjs';
import {SHIELD,PRIZES,todayPrize,streakAt} from '../lib/premios.mjs';
import {SWAP_PRICE,MISSIONS,dailyIds,weeklyIds,roll,dayIds,swapOptions,swapMission} from '../lib/misiones.mjs';
import {Chests,chestBox,streakDay} from '../lib/cofres.mjs';

// Las cifras del navegador son las mismas.
const source=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8');
assert.ok(source.includes(`swap:${SWAP_PRICE},shield:{price:${SHIELD.price},from:${SHIELD.from}}`),'dist/progress.js y el servidor cobran lo mismo');

// La racha: un día protegido hace de puente, pero no suma.
const days={'2026-11-10':1,'2026-11-11':1,'2026-11-12':1,'2026-11-14':1};
assert.equal(streakAt(days,'2026-11-14'),1);assert.equal(streakAt(days,'2026-11-14',['2026-11-13']),4);
assert.equal(streakAt(days,'2026-11-13',['2026-11-13']),3);assert.equal(streakAt({},'2026-11-14',['2026-11-13','2026-11-14']),0);
const many=Object.fromEntries(Array.from({length:20},(_,i)=>['2026-11-'+String(i+1).padStart(2,'0'),1]));
assert.equal(streakAt(many,'2026-11-20'),PRIZES.streakCap);

// La racha de los cofres no va por detrás de los días apuntados; si da un salto, da los cofres de los hitos que cruza.
{
  const stats=chestBox(roll(null,'2026-11-16'),{});
  assert.equal(streakDay(stats,'2026-11-16',5),'iman');assert.deepEqual([stats.streak.count,stats.chests.iman,stats.chests.tormenta],[5,1,0]);
  assert.equal(streakDay(stats,'2026-11-16',9),null,'El mismo día no cuenta dos veces');
  assert.equal(streakDay(stats,'2026-11-17',6),null);assert.equal(stats.streak.count,6);
  assert.equal(streakDay(stats,'2026-11-18',2),'tormenta','La racha larga manda sobre los días apuntados');assert.equal(stats.streak.count,7);
  assert.equal(streakDay(stats,'2026-11-20',0),null);assert.equal(stats.streak.count,1);
}

// Cambiar una misión, en las reglas: no la del reto, ni una completada, ni dos veces la misma casilla.
{
  const day='2026-11-16',stats=roll(null,day),[,second,third]=dailyIds(day);
  assert.equal(swapOptions(stats,'reto-hoy',day),null);assert.equal(swapOptions(stats,'no-existe',day),null);
  const options=swapOptions(stats,second,day);
  assert.equal(options.ref,day+':'+second);assert.ok(options.pool.length>=3&&!options.pool.includes(second)&&!options.pool.includes(third));
  assert.equal(swapMission(stats,second,third,day),false,'No por una que ya tiene');
  const to=options.pool[0];assert.equal(swapMission(stats,second,to,day),true);
  assert.deepEqual(dayIds(stats,day),['reto-hoy',to,third]);
  assert.equal(swapOptions(stats,to,day),null,'La nueva no se cambia otra vez');
  assert.ok(!swapOptions(stats,third,day).pool.includes(second),'La que se cambió no vuelve');
  // Una que saldría completada no entra en el sorteo.
  const other=roll(null,day);other.day.c={answers:6,near2:1,near125:1,archive:1,duels:1,wins:1};
  assert.equal(swapOptions(other,second,day),null,'Ya está completada');
  assert.deepEqual(dayIds(roll(stats,'2026-11-17'),'2026-11-17'),dailyIds('2026-11-17'),'Al día siguiente, las de todos');
}

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-sumideros-'));
let clock=Date.parse('2026-11-10T09:00:00Z'),dice=0;
const at=date=>{clock=Date.parse(date+'T09:00:00Z')};
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const api=createApi({playedDays:async()=>200,store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,random:()=>dice,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const state=async player=>(await progress('estado',player)).data,coinsOf=async player=>(await progress('leer',player)).data.coins;
const moves=async player=>(await progress('movimientos',player)).data.moves;
// Juega el reto de `date` ese mismo día, clavando las cifras, y lo cobra.
async function play(player,date){
  at(date);
  for(const question of getDay(date,{persist:false}).questions)assert.equal((await post('answers',{question:question.id,player,guess:question.answer})).status,200);
  const paid=await progress('premio',player,{day:date});assert.equal(paid.status,200);return paid.data;
}
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID();
  at('2026-11-10');
  await progress('guardar',luis,{state:{v:1,xp:0},delta:1000});await progress('guardar',ana,{state:{v:1,xp:0},delta:0});
  await progress('guardar',eva,{state:{v:1,xp:0},delta:1000});

  // Tres días seguidos: la racha de los cofres y la del premio van a la par, y al tercero cae el cofre Imán.
  for(const player of [luis,ana])for(const date of ['2026-11-10','2026-11-11','2026-11-12']){
    const paid=await play(player,date),n=Number(date.slice(-2))-9;
    assert.equal(paid.amount,todayPrize(1,n));assert.equal((await state(player)).streak,n);
  }
  assert.equal((await state(luis)).chests.iman,1);
  assert.equal((await state(luis)).shield,undefined,'Con la racha viva no hay nada que proteger');
  await play(eva,'2026-11-11');await play(eva,'2026-11-12');

  // El 13 no juega nadie. El 14, quien llevaba 3 días o más puede proteger la racha; quien llevaba 2, no.
  at('2026-11-14');
  assert.deepEqual((await state(luis)).shield,{day:'2026-11-13',days:3,price:SHIELD.price});
  assert.equal((await state(eva)).shield,undefined);
  assert.equal((await progress('proteger-racha',null)).status,401);
  assert.equal((await progress('proteger-racha',eva)).data.code,'sin-racha');assert.equal(await coinsOf(eva),await coinsOf(eva));
  // Sin saldo no se protege ni se cobra.
  await progress('pista',ana,{question:'una-pista'});
  let before=await coinsOf(ana);assert.ok(before<SHIELD.price);
  let r=await progress('proteger-racha',ana);assert.equal(r.status,402);assert.equal(r.data.code,'saldo');assert.equal(await coinsOf(ana),before);
  // Con saldo: cobra, apunta el día y la racha sigue donde estaba.
  before=await coinsOf(luis);r=await progress('proteger-racha',luis);
  assert.deepEqual(r.data,{coins:before-SHIELD.price,day:'2026-11-13',streak:3});
  const [last]=await moves(luis);assert.deepEqual([last.reason,last.amount,last.source,last.ref],['protector',-SHIELD.price,'servidor','2026-11-13']);
  assert.equal((await progress('proteger-racha',luis)).data.code,'sin-racha','Una vez por día');assert.equal(await coinsOf(luis),before-SHIELD.price);
  assert.equal((await state(luis)).shield,undefined);assert.equal((await state(luis)).streak,3);

  // Al jugar hoy, el día protegido hace de puente: Luis va por el cuarto día; Ana empieza de uno.
  assert.equal((await play(luis,'2026-11-14')).amount,todayPrize(1,4));assert.equal((await state(luis)).streak,4);
  assert.equal((await play(ana,'2026-11-14')).amount,todayPrize(1,1));assert.equal((await state(ana)).streak,1);
  // Con el reto de hoy jugado ya no se puede proteger nada.
  at('2026-11-16');await play(eva,'2026-11-16');
  assert.equal((await progress('proteger-racha',eva)).data.code,'sin-racha');
  // Dos días sin jugar: la racha se pierde y no se puede proteger.
  at('2026-11-17');assert.equal((await state(luis)).shield,undefined);
  assert.equal((await progress('proteger-racha',luis)).data.code,'sin-racha');

  // Cambiar una misión del día: cobra, sale otra que no tenía y la casilla no se puede cambiar otra vez.
  const day='2026-11-17',[,second,third]=dailyIds(day),ids=async player=>(await state(player)).missions.map(mission=>mission.id);
  assert.deepEqual(await ids(luis),[...dailyIds(day),...weeklyIds(day)]);
  assert.equal((await progress('cambiar-mision',null,{id:second})).status,401);
  for(const bad of ['no-existe',null,7])assert.equal((await progress('cambiar-mision',luis,{id:bad})).status,400);
  assert.equal((await progress('cambiar-mision',luis,{id:'reto-hoy'})).data.code,'sin-cambio');
  const absent=Object.keys(MISSIONS).find(id=>!id.startsWith('sem-')&&!dailyIds(day).includes(id));
  assert.equal((await progress('cambiar-mision',luis,{id:absent})).data.code,'sin-cambio','No es una de sus misiones');
  before=await coinsOf(luis);r=await progress('cambiar-mision',luis,{id:second});
  assert.equal(r.status,200);assert.equal(r.data.coins,before-SWAP_PRICE);assert.equal(r.data.from,second);
  const to=r.data.to;assert.ok(MISSIONS[to]&&!to.startsWith('sem-')&&!dailyIds(day).includes(to));
  assert.equal(r.data.goal,MISSIONS[to].goal);assert.equal(r.data.progress,0);
  assert.deepEqual(await ids(luis),['reto-hoy',to,third,...weeklyIds(day)]);
  const [swap]=await moves(luis);assert.deepEqual([swap.reason,swap.amount,swap.ref],['cambio-mision',-SWAP_PRICE,day+':'+second]);
  for(const again of [second,to])assert.equal((await progress('cambiar-mision',luis,{id:again})).data.code,'sin-cambio');
  assert.equal(await coinsOf(luis),before-SWAP_PRICE);
  assert.equal((await progress('mision',luis,{id:second})).status,409,'La que se cambió ya no se recoge');
  // La otra casilla y una semanal también se pueden cambiar; la semanal solo tiene una alternativa.
  r=await progress('cambiar-mision',luis,{id:third});assert.equal(r.status,200);assert.ok(![second,third,to].includes(r.data.to));
  const [weekly]=weeklyIds(day),spare=Object.keys(MISSIONS).find(id=>id.startsWith('sem-')&&!weeklyIds(day).includes(id));
  r=await progress('cambiar-mision',luis,{id:weekly});assert.equal(r.data.to,spare);
  assert.equal((await progress('cambiar-mision',luis,{id:weeklyIds(day)[1]})).data.code,'sin-cambio','No queda ninguna semanal libre');
  assert.equal(await coinsOf(luis),before-3*SWAP_PRICE);
  // Sin saldo no cambia nada.
  await progress('abrir-cofre',ana,{type:'chispa'});
  const poor=randomUUID();await progress('guardar',poor,{state:{v:1,xp:0},delta:SWAP_PRICE-1});
  r=await progress('cambiar-mision',poor,{id:second});assert.equal(r.status,402);assert.deepEqual(await ids(poor),[...dailyIds(day),...weeklyIds(day)]);
  assert.equal(await coinsOf(poor),SWAP_PRICE-1);
  // Al día siguiente vuelven a ser las de todos; las semanales cambiadas siguen hasta el lunes.
  at('2026-11-18');assert.deepEqual((await ids(luis)).slice(0,3),dailyIds('2026-11-18'));
  assert.ok((await ids(luis)).includes(spare));
  // El libro cuadra con el saldo.
  assert.equal((await moves(luis)).reduce((sum,move)=>sum+move.amount,0),await coinsOf(luis));
  assert.ok(Chests);

  console.log('sumideros: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
