// Prueba las cifras de la economía nueva que lleva el servidor (decisión 0066): el tope diario de faradios ganados
// jugando y los faradios por recoger las tres misiones del día. Cuenta falsa; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {memoryDuels} from '../lib/duelos.mjs';
import {DAY_SET,DAILY_CAP,CAPPED,dailyIds} from '../lib/misiones.mjs';
import {getDay} from '../content-engine.mjs';

// Las cifras son las del navegador y las del simulador.
const flat=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8').replace(/\s/g,'');
assert.ok(flat.includes(`daySet:${DAY_SET},dayCap:${DAILY_CAP}}`),'daySet y dayCap de progress.js ya no coinciden con el servidor');
assert.deepEqual([DAY_SET,DAILY_CAP],[40,400]);assert.deepEqual(CAPPED,['reto','archivo','duelos','duelos-bot','misiones']);
{
  const page={};page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/chests.js',import.meta.url),'utf8'),page);
  assert.deepEqual({...page.Chests.FALLBACK},{comun:10,especial:25,rara:45,epica:95,legendaria:200},'El lote por pieza repetida es la cuarta parte del de antes');
}

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-tope-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-16');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const duels=memoryDuels(),hashOf=player=>createHash('sha256').update(player).digest('hex');
const store={...fileStore(path.join(directory,'answers.json')),duels};
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const state=async player=>(await progress('estado',player)).data,coinsOf=async player=>(await progress('leer',player)).data.coins;
async function play(player,date){for(const question of getDay(date,{persist:false}).questions)assert.equal((await post('answers',{question:question.id,player,guess:question.answer})).status,200)}
async function wonDuel(player,rival){
  const id=randomUUID();
  await duels.create({id,code:id.slice(0,6).toUpperCase(),public:false,status:'finished',createdAt:clock,seenAt:clock,players:[{hash:hashOf(player)},{hash:hashOf(rival)}],questions:['q'],rounds:[{}],winner:0,reason:'ko',next:null});
  return id;
}
try{
  const ana=randomUUID(),eva=randomUUID(),luis=randomUUID();
  for(const player of [ana,eva,luis])await progress('guardar',player,{state:{v:1,xp:43500},delta:0});

  // Las tres misiones del día: la tercera añade 40 ≈ y ya no da cofre.
  await play(ana,'2026-11-16');await progress('premio',ana,{day:'2026-11-16'});
  await play(ana,'2026-11-13');await progress('premio',ana,{day:'2026-11-13'});
  await progress('premio',ana,{duel:await wonDuel(ana,eva)});
  const ids=dailyIds('2026-11-16'),chests=(await state(ana)).chests.chispa;
  let r=await progress('mision',ana,{id:ids[0]});assert.equal(r.data.bonus,undefined);
  await progress('mision',ana,{id:ids[1]});
  const before=await coinsOf(ana);
  r=await progress('mision',ana,{id:ids[2]});
  assert.equal(r.data.bonus,DAY_SET);assert.equal(r.data.chest,undefined);assert.equal(r.data.coins,before+r.data.amount+DAY_SET);
  assert.equal((await state(ana)).chests.chispa,chests,'Las tres del día ya no dan cofre');
  let moves=(await progress('movimientos',ana)).data.moves;
  assert.deepEqual([moves[0].reason,moves[0].ref,moves[0].amount],['misiones','2026-11-16:conjunto',DAY_SET]);

  // Tope diario: con 390 ≈ ya ganados hoy, el reto (37) solo paga los 10 que caben, y lo siguiente, nada.
  await store.community.move(hashOf(luis),390,'misiones','prueba','2026-11-16');
  await play(luis,'2026-11-16');
  r=await progress('premio',luis,{day:'2026-11-16'});
  assert.deepEqual(r.data,{coins:400,amount:10,reason:'reto',capped:true});
  r=await progress('premio',luis,{duel:await wonDuel(luis,eva)});
  assert.deepEqual(r.data,{coins:400,amount:0,reason:'duelos',capped:true});
  // El reto y el duelo cuentan igual para la experiencia, las misiones y la batería, aunque no paguen.
  let s=await state(luis);
  assert.equal(s.xp,43500+15+30+160);assert.equal(s.charge,60);assert.equal(s.streak,1);
  assert.ok(s.missions.find(mission=>mission.id==='reto-hoy').done);
  // Pedirlo otra vez no da más experiencia, aunque no haya apunte de pago.
  await progress('premio',luis,{day:'2026-11-16'});assert.equal((await state(luis)).xp,s.xp);
  // Los cofres, las compras y lo que no es jugar no entran en el tope.
  const buy=await progress('comprar-cofre',luis,{type:'chispa'});assert.equal(buy.status,200);
  r=await progress('abrir-cofre',luis,{type:'chispa'});assert.equal(r.status,200);
  const lots=r.data.rewards.filter(reward=>reward.kind==='coins').reduce((sum,reward)=>sum+reward.amount,0);
  assert.equal(r.data.coins,buy.data.coins+lots,'Los lotes de los cofres se pagan enteros');
  // Al día siguiente vuelve a haber sitio.
  clock=at('2026-11-17');await play(luis,'2026-11-17');
  r=await progress('premio',luis,{day:'2026-11-17'});assert.equal(r.data.amount,20+15+4);assert.equal(r.data.capped,undefined);
  moves=(await progress('movimientos',luis)).data.moves;
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),await coinsOf(luis));

  console.log('tope-diario: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
