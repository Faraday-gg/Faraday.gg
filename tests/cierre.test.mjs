// Prueba el cierre de la economía en el servidor (decisión 0065): el navegador ya no puede declarar ganancias y lo que un
// jugador trae la primera vez queda limitado por los días que el servidor sabe que jugó el reto del día.
// Aquí los días jugados salen de verdad de daily_results (las demás pruebas los fijan en 200 para no chocar con el tope).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {RULES,REASONS,FIRST,firstBudget} from '../lib/comunidad.mjs';
import {PIECES} from '../lib/catalogo.mjs';
import {getDay} from '../content-engine.mjs';

assert.equal(RULES.dailyGain,0,'El servidor no acepta ganancias declaradas');
assert.equal(RULES.firstGain,undefined);assert.deepEqual(REASONS,['bienvenida','otros']);
assert.deepEqual(firstBudget(0),{days:0,coins:100,xp:0,pieces:300,chests:2});
assert.deepEqual(firstBudget(10),{days:10,coins:100+10*FIRST.coinsPerDay,xp:10*FIRST.xpPerDay,pieces:300+10*FIRST.piecesPerDay,chests:12});

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-cierre-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-14');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const api=createApi({store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const state=async player=>(await progress('estado',player)).data,coinsOf=async player=>(await progress('leer',player)).data.coins;
const items=async player=>(await progress('inventario',player)).data.items.map(one=>one.item);
const worth=keys=>keys.reduce((sum,key)=>sum+PIECES.get(key).price,0);
async function play(player,date){clock=at(date);for(const question of getDay(date,{persist:false}).questions)assert.equal((await post('answers',{question:question.id,player,guess:question.answer})).status,200)}
// Un navegador que dice tenerlo todo: mucho saldo, mucha experiencia, cofres de los caros, racha larga y las piezas más caras.
const dear=[...PIECES].sort((a,b)=>b[1].price-a[1].price).map(([key])=>key),cheap=[...dear].reverse();
const greedy=()=>({v:1,xp:44000,look:{body:'hombre'},chests:{chispa:30,faraday:30},streak:{count:99,last:'2026-11-16'},owned:[...dear.slice(0,20),...cheap.slice(0,20)]});

try{
  // Cuenta nueva que no ha jugado nunca: la bienvenida y poco más, declare lo que declare.
  const nuevo=randomUUID();
  let r=await progress('guardar',nuevo,{state:greedy(),delta:999999});
  assert.equal(r.data.coins,FIRST.coins);
  let s=await state(nuevo);
  assert.equal(s.xp,0);assert.equal(s.level,1);assert.equal(s.streak,0);
  assert.deepEqual(s.chests,{chispa:2,iman:0,rayo:0,dinamo:0,tormenta:0,faraday:0},'Dos cofres como mucho, de los más baratos');
  let own=await items(nuevo);
  assert.ok(worth(own)<=FIRST.pieces&&own.length>0&&own.every(key=>cheap.slice(0,20).includes(key)),'Solo las piezas que caben en 300 ≈');
  // Y después, nada: el navegador ya no suma faradios, ni hoy ni mañana. Lo que intenta sumar queda apuntado.
  assert.equal((await progress('guardar',nuevo,{state:greedy(),delta:500,moves:{otros:500}})).data.coins,FIRST.coins);
  clock=at('2026-11-15');
  assert.equal((await progress('guardar',nuevo,{state:greedy(),delta:500,moves:{bienvenida:500}})).data.coins,FIRST.coins);
  let moves=(await progress('movimientos',nuevo)).data.moves;
  assert.equal(moves.filter(move=>move.reason==='tope'&&move.amount===-500).length,2);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),FIRST.coins);
  // Volver a declarar el progreso no cambia lo que el servidor ya tiene.
  s=await state(nuevo);assert.equal(s.xp,0);assert.equal(s.chests.faraday,0);assert.deepEqual(await items(nuevo),own);

  // Quien jugó tres días sin cuenta (el servidor los tiene apuntados) conserva lo que dan tres días.
  const veterano=randomUUID();
  for(const date of ['2026-11-14','2026-11-15','2026-11-16'])await play(veterano,date);
  r=await progress('guardar',veterano,{state:greedy(),delta:999999});
  const budget=firstBudget(3);
  assert.equal(r.data.coins,budget.coins);assert.equal(budget.coins,1000);
  s=await state(veterano);
  assert.equal(s.xp,budget.xp);assert.equal(s.streak,3,'La racha declarada no pasa de los días jugados');
  assert.equal(Object.values(s.chests).reduce((a,b)=>a+b,0),budget.chests);
  own=await items(veterano);assert.ok(worth(own)<=budget.pieces&&worth(own)>FIRST.pieces);
  // Lo que jugó antes de tener el progreso en el servidor ya va en lo que trajo: no se cobra otra vez.
  assert.equal((await progress('premio',veterano,{day:'2026-11-15'})).data.code,'anterior');
  assert.equal((await progress('premio',veterano,{day:'2026-11-14'})).data.code,'anterior');
  assert.equal(await coinsOf(veterano),budget.coins);
  // Un jugador honrado, que declara menos de lo que le toca, se queda con lo suyo.
  const honrado=randomUUID();
  for(const date of ['2026-11-14','2026-11-15','2026-11-16'])await play(honrado,date);
  r=await progress('guardar',honrado,{state:{v:1,xp:300,chests:{chispa:1},streak:{count:3,last:'2026-11-16'},owned:[cheap[0]]},delta:420});
  assert.equal(r.data.coins,420);s=await state(honrado);assert.equal(s.xp,300);assert.equal(s.chests.chispa,1);assert.deepEqual(await items(honrado),[cheap[0]]);

  // A partir de ahí, lo que se gana lo da el servidor.
  await play(honrado,'2026-11-17');
  r=await progress('premio',honrado,{day:'2026-11-17'});assert.equal(r.data.reason,'reto');
  assert.equal(await coinsOf(honrado),420+r.data.amount);
  s=await state(honrado);assert.equal(s.xp,300+15+30);assert.equal(s.streak,4);

  console.log('cierre: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
