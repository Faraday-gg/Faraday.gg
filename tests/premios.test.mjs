// Prueba los premios que calcula el servidor (lib/premios.mjs, decisión 0058): el reto del día y el archivo, a través
// de la API, con un reloj controlado y una cuenta falsa. No usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {PRIZES,todayPrize,streakAt} from '../lib/premios.mjs';
import {REASONS} from '../lib/comunidad.mjs';
import {getDay} from '../content-engine.mjs';

// Las cifras del servidor son las del navegador (dist/progress.js).
const progressJs=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8').replace(/\s/g,'');
assert.ok(progressJs.includes(`todayCoins:${PRIZES.todayCoins},`)&&progressJs.includes(`archiveCoins:${PRIZES.archiveCoins},streakCoins:${PRIZES.streakCoins},streakCap:${PRIZES.streakCap},`),'REWARD de progress.js ya no coincide con PRIZES');
assert.ok(progressJs.includes('constaccuracy=detail.average<1.5?15:detail.average<2?10:detail.average<3?5:0'),'El extra por precisión de progress.js ha cambiado');
assert.deepEqual(PRIZES.accuracy,[[1.5,15],[2,10],[3,5]]);
// El navegador ya no puede declarar estos motivos.
assert.ok(!REASONS.includes('reto')&&!REASONS.includes('archivo'));

// Reglas: 20 por completar, extra por precisión y 2 por día de racha hasta 7.
assert.equal(todayPrize(1,1),20+15+2);assert.equal(todayPrize(1.49,1),37);assert.equal(todayPrize(1.5,1),32);assert.equal(todayPrize(2.5,3),20+5+6);
assert.equal(todayPrize(50,1),22);assert.equal(todayPrize(1.2,7),49);assert.equal(todayPrize(1.2,40),49,'La racha deja de sumar al séptimo día');
assert.equal(streakAt({'2026-11-10':1,'2026-11-11':1,'2026-11-12':1},'2026-11-12'),3);
assert.equal(streakAt({'2026-11-10':1,'2026-11-12':1},'2026-11-12'),1);assert.equal(streakAt({},'2026-11-12'),0);

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-premios-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-16');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const api=createApi({store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const questions=date=>getDay(date,{persist:false}).questions;
// Responde las `count` primeras preguntas de una jornada quedándose a `factor` veces de la cifra.
async function play(player,date,factor=1,count=3){
  for(const question of questions(date).slice(0,count))assert.equal((await post('answers',{question:question.id,player,guess:question.answer*factor})).status,200);
}
const ledger=async player=>(await progress('movimientos',player)).data.moves;

try{
  const luis=randomUUID(),ana=randomUUID();
  await progress('guardar',luis,{state:{v:1},delta:100});

  // Sin cuenta no hay premio del servidor; con cuenta, solo si el reto está completo.
  assert.equal((await progress('premio',null,{day:'2026-11-16'})).status,401);
  let r=await progress('premio',luis,{day:'2026-11-16'});assert.equal(r.status,409);assert.equal(r.data.code,'incompleto');
  await play(luis,'2026-11-16',1,2);
  assert.equal((await progress('premio',luis,{day:'2026-11-16'})).status,409,'Con dos respuestas no está completo');
  for(const day of ['2026-11-17','mañana',null,'2026-13-40'])assert.equal((await progress('premio',luis,{day})).status,409,'Ni días futuros ni fechas raras');
  assert.equal((await progress('leer',luis)).data.coins,100);

  // Reto de hoy clavado, primer día de racha: 20 + 15 + 2.
  await play(luis,'2026-11-16');
  r=await progress('premio',luis,{day:'2026-11-16'});
  assert.equal(r.status,200);assert.deepEqual(r.data,{coins:137,amount:37,reason:'reto'});
  // Pedirlo otra vez no lo vuelve a pagar.
  r=await progress('premio',luis,{day:'2026-11-16'});assert.equal(r.data.coins,137);
  let moves=await ledger(luis);
  assert.deepEqual(moves[0],{amount:37,reason:'reto',source:'servidor',ref:'2026-11-16',balance:137,day:'2026-11-16'});
  assert.equal(moves.filter(move=>move.reason==='reto').length,1);

  // Al día siguiente, a 1,8× de media: 20 + 10 + 2 × 2 de racha.
  clock=at('2026-11-17');
  await play(luis,'2026-11-17',1.8);
  r=await progress('premio',luis,{day:'2026-11-17'});assert.deepEqual(r.data,{coins:137+34,amount:34,reason:'reto'});
  // Un día sin jugar corta la racha: el 19, muy lejos de la cifra, da 20 + 0 + 2.
  clock=at('2026-11-19');
  await play(luis,'2026-11-19',40);
  r=await progress('premio',luis,{day:'2026-11-19'});assert.equal(r.data.amount,22);

  // El día que se saltó, jugado después, es archivo: 5 faradios, una vez, y no arregla la racha.
  await play(luis,'2026-11-18');
  r=await progress('premio',luis,{day:'2026-11-18'});assert.equal(r.data.amount,5);assert.equal(r.data.reason,'archivo');
  const before=r.data.coins;
  assert.equal((await progress('premio',luis,{day:'2026-11-18'})).data.coins,before);
  clock=at('2026-11-20');
  await play(luis,'2026-11-20');
  assert.equal((await progress('premio',luis,{day:'2026-11-20'})).data.amount,20+15+4,'Racha de dos: el 19 y el 20');

  // Los premios de un jugador no los cobra otro, y los apuntes siguen sumando el saldo.
  await progress('guardar',ana,{state:{v:1},delta:0});
  assert.equal((await progress('premio',ana,{day:'2026-11-20'})).status,409);
  moves=await ledger(luis);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),(await progress('leer',luis)).data.coins);
  assert.deepEqual(moves.filter(move=>move.source==='servidor').map(move=>[move.reason,move.ref,move.amount]).reverse(),
    [['reto','2026-11-16',37],['reto','2026-11-17',34],['reto','2026-11-19',22],['archivo','2026-11-18',5],['reto','2026-11-20',39]]);

  console.log('premios: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
