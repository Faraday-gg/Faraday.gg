// Prueba los premios del Circuito de amigos repartidos por el servidor (lib/comunidad.mjs, decisión 0064): a quien tiene
// cuenta, los faradios van a su saldo y los cofres a sus cofres; sin cuenta, todo sigue en el navegador.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {RULES} from '../lib/referidos.mjs';
import {REASONS} from '../lib/comunidad.mjs';
import {CHARGE} from '../lib/cofres.mjs';
import {getDay} from '../content-engine.mjs';

assert.deepEqual(REASONS,['bienvenida','otros'],'El navegador ya solo puede declarar la bienvenida y «otros»');

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-circuito-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-16');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const api=createApi({store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,body,session){
  const headers={'Content-Type':'application/json'};if(session)headers.cookie='faraday_sesion='+session;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
// account = true: la petición lleva la sesión de ese mismo jugador.
const circuit=(action,player,extra={},account=true)=>post('referido',{action,player,name:'Jugador',avatar:{},...extra},account?player:null);
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const state=async player=>(await progress('estado',player)).data,coinsOf=async player=>(await progress('leer',player)).data.coins;
async function play(player,date){for(const question of getDay(date,{persist:false}).questions)assert.equal((await post('answers',{question:question.id,player,guess:question.answer})).status,200)}
async function day(date,...players){clock=at(date);for(const player of players){await play(player,date);await progress('premio',player,{day:date})}}

try{
  const luis=randomUUID(),ana=randomUUID(),sin=randomUUID(),tom=randomUUID();
  // Luis invita; Ana (con cuenta) y otro jugador sin cuenta abren su enlace siendo nuevos.
  const code=(await circuit('codigo',luis)).data.code;
  assert.equal((await circuit('abrir',ana,{code})).data.linked,true);
  assert.equal((await circuit('abrir',sin,{code},false)).data.linked,true);
  assert.equal((await circuit('abrir',tom,{code},false)).data.linked,true);
  await progress('guardar',luis,{state:{v:1,xp:43500},delta:0});
  await progress('guardar',ana,{state:{v:1,xp:43500},delta:0});

  // Ana juega su primer reto: bienvenida con cofre Rayo, que el servidor apunta en sus cofres.
  await day('2026-11-16',ana,sin,tom);
  let r=await circuit('estado',ana);assert.equal(r.data.pending,1);
  r=await circuit('reclamar',ana);
  assert.deepEqual(r.data.prizes,[{kind:'bienvenida',chest:'rayo'}]);
  assert.equal(r.data.server.chests.rayo,1);
  assert.equal((await state(ana)).chests.rayo,1);
  assert.deepEqual((await circuit('reclamar',ana)).data.prizes,[],'El premio no se cobra dos veces');
  assert.equal((await state(ana)).chests.rayo,1);
  // Sin sesión (o con la de otro), el servidor no reparte nada: los premios siguen yendo al navegador.
  r=await circuit('reclamar',sin,{},false);
  assert.deepEqual(r.data.prizes,[{kind:'bienvenida',chest:'rayo'}]);assert.equal(r.data.server,undefined);
  assert.equal((await post('referido',{action:'estado',player:luis},ana)).data.server,undefined,'La sesión tiene que ser la del jugador');

  // Corriente compartida: el día que juegan los dos, +15 de batería a cada uno, una sola vez.
  await day('2026-11-17',ana,luis,sin,tom);
  let before=(await state(luis)).charge;
  r=await circuit('estado',luis);
  // Luis jugó el mismo día que sus tres invitados: +15 por cada uno.
  assert.equal(r.data.server.charge,before+3*RULES.currentCharge);
  assert.equal((await circuit('estado',luis)).data.server.charge,before+3*RULES.currentCharge,'El mismo día no carga dos veces');
  before=(await state(ana)).charge;
  assert.equal((await circuit('estado',ana)).data.server.charge,(before+RULES.currentCharge)%CHARGE.full);

  // Al tercer reto del día, Ana pasa a ser conexión: 150 ≈ para ella y un cofre Rayo para Luis.
  await day('2026-11-18',ana,sin,tom);
  before=await coinsOf(ana);
  r=await circuit('reclamar',ana);
  assert.deepEqual(r.data.prizes,[{kind:'conexion-invitado',coins:RULES.inviteeCoins}]);
  assert.equal(r.data.server.coins,before+RULES.inviteeCoins);assert.equal(await coinsOf(ana),before+RULES.inviteeCoins);
  let moves=(await progress('movimientos',ana)).data.moves;
  assert.deepEqual([moves[0].reason,moves[0].amount,moves[0].source],['referidos',RULES.inviteeCoins,'servidor']);
  // Luis tiene ya tres conexiones (Ana y los dos sin cuenta): un cofre Rayo por cada una y, por llegar a 3, un cofre
  // Tormenta, una sola vez.
  const had=(await state(luis)).chests;
  r=await circuit('reclamar',luis);
  assert.deepEqual(r.data.prizes.map(prize=>[prize.kind,prize.chest,prize.n]),[['conexion','rayo',1],['conexion','rayo',2],['conexion','rayo',3]]);
  assert.equal(r.data.connections,3);
  assert.equal(r.data.server.chests.rayo,had.rayo+3);assert.equal(r.data.server.chests.tormenta,had.tormenta+1);
  r=await circuit('reclamar',luis);assert.deepEqual(r.data.prizes,[]);
  await circuit('estado',luis);
  const storm=had.tormenta+1;assert.equal((await state(luis)).chests.rayo,had.rayo+3);

  // El libro sigue sumando el saldo.
  for(const player of [luis,ana]){moves=(await progress('movimientos',player)).data.moves;assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),await coinsOf(player))}
  assert.equal(storm,(await state(luis)).chests.tormenta);

  console.log('circuito-servidor: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
