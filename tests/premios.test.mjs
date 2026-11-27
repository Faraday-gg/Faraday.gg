// Prueba los premios que calcula el servidor (lib/premios.mjs, decisión 0058): el reto del día y el archivo, a través
// de la API, con un reloj controlado y una cuenta falsa. No usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {PRIZES,todayPrize,streakAt,DUEL,duelCoins,createDuelPrizes} from '../lib/premios.mjs';
import {memoryDuels} from '../lib/duelos.mjs';
import {createHash} from 'node:crypto';
import {REASONS} from '../lib/comunidad.mjs';
import {getDay} from '../content-engine.mjs';

// Las cifras del servidor son las del navegador (dist/progress.js).
const progressJs=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8').replace(/\s/g,'');
assert.ok(progressJs.includes(`todayCoins:${PRIZES.todayCoins},`)&&progressJs.includes(`archiveCoins:${PRIZES.archiveCoins},streakCoins:${PRIZES.streakCoins},streakCap:${PRIZES.streakCap},`),'REWARD de progress.js ya no coincide con PRIZES');
assert.ok(progressJs.includes('constaccuracy=detail.average<1.5?15:detail.average<2?10:detail.average<3?5:0'),'El extra por precisión de progress.js ha cambiado');
assert.deepEqual(PRIZES.accuracy,[[1.5,15],[2,10],[3,5]]);
// El navegador ya no puede declarar estos motivos.
assert.ok(!REASONS.includes('reto')&&!REASONS.includes('archivo')&&!REASONS.includes('duelos'));
// Duelos (decisión 0059): mismas cifras que el navegador.
assert.ok(progressJs.includes(`duel:{win:${DUEL.win},draw:${DUEL.draw},loss:${DUEL.loss}}`),'REWARD.duel de progress.js ya no coincide con DUEL');
assert.ok(fs.readFileSync(new URL('../dist/duel.js',import.meta.url),'utf8').includes(`DAILY_FULL=${DUEL.full},CAPPED_FACTOR=.25`)&&DUEL.capped===.25);
assert.deepEqual([duelCoins('win',0),duelCoins('draw',2),duelCoins('loss',2),duelCoins('win',3),duelCoins('draw',3),duelCoins('loss',9)],[15,8,5,4,2,1]);

// Un duelo de Archivo Vivo no paga faradios (los años de sus fotos son públicos): gane, empate o pierda, 0. El
// resultado sigue saliendo, porque de él dependen la experiencia y las misiones. En los demás juegos, lo de siempre.
{
  const duel=(game,winner,extra={})=>({id:'d',status:'finished',createdAt:1,...(game?{game}:{}),players:[{hash:'a'},{hash:'b',...extra}],questions:['q'],rounds:[{},{}],winner,reason:'ko'});
  const prize=(state,player='a',already=0)=>createDuelPrizes({duel:async()=>state,paid:async()=>already})(player,'00000000-0000-4000-8000-000000000000');
  assert.deepEqual(await prize(duel('archivo',0)),{reason:'duelos',result:'win',abandoned:false,bot:false,rounds:2,at:1,amount:0});
  assert.deepEqual([(await prize(duel('archivo','draw'))).amount,(await prize(duel('archivo',0),'b')).amount,(await prize(duel('archivo',0),'b')).result],[0,0,'loss']);
  assert.deepEqual([(await prize(duel('archivo',0,{bot:true}))).amount,(await prize(duel('archivo',0,{bot:true}))).reason],[0,'duelos-bot']);
  assert.equal((await prize({...duel('archivo',0),size:3,players:[{hash:'a'},{hash:'b'},{hash:'c'}],winners:[0]})).amount,0);
  for(const game of ['traza','ascension','estimacion',null])assert.deepEqual([(await prize(duel(game,0))).amount,(await prize(duel(game,'draw'))).amount,(await prize(duel(game,0),'b')).amount],[15,8,5],'Los demás juegos pagan lo de siempre');
}

// Reglas: 20 por completar, extra por precisión y 2 por día de racha hasta 7.
assert.equal(todayPrize(1,1),20+15+2);assert.equal(todayPrize(1.49,1),37);assert.equal(todayPrize(1.5,1),32);assert.equal(todayPrize(2.5,3),20+5+6);
assert.equal(todayPrize(50,1),22);assert.equal(todayPrize(1.2,7),49);assert.equal(todayPrize(1.2,40),49,'La racha deja de sumar al séptimo día');
assert.equal(streakAt({'2026-11-10':1,'2026-11-11':1,'2026-11-12':1},'2026-11-12'),3);
assert.equal(streakAt({'2026-11-10':1,'2026-11-12':1},'2026-11-12'),1);assert.equal(streakAt({},'2026-11-12'),0);

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-premios-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-16');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const duels=memoryDuels(),hashOf=player=>createHash('sha256').update(player).digest('hex');
// Guarda un duelo ya terminado entre dos jugadores (o contra el bot) y devuelve su id.
async function finished(first,second,winner,reason='rondas'){
  const id=randomUUID(),one=player=>player==='bot'?{hash:'bot',name:'Faraday-bot',bot:true,hp:0}:{hash:hashOf(player),name:'x',hp:1};
  await duels.create({id,code:id.slice(0,6).toUpperCase(),public:false,status:'finished',createdAt:clock,seenAt:clock,players:second?[one(first),one(second)]:[one(first)],questions:['q'],rounds:[{}],winner,reason,next:null});
  return id;
}
const api=createApi({playedDays:async()=>200,store:{...fileStore(path.join(directory,'answers.json')),duels},persistDays:false,now:()=>clock,auth,log:()=>{}});
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
  await progress('guardar',luis,{state:{v:1,xp:43500},delta:100});

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
  await progress('guardar',ana,{state:{v:1,xp:43500},delta:0});
  assert.equal((await progress('premio',ana,{day:'2026-11-20'})).status,409);
  moves=await ledger(luis);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),(await progress('leer',luis)).data.coins);
  assert.deepEqual(moves.filter(move=>move.source==='servidor'&&move.reason!=='nivel').map(move=>[move.reason,move.ref,move.amount]).reverse(),
    [['reto','2026-11-16',37],['reto','2026-11-17',34],['reto','2026-11-19',22],['archivo','2026-11-18',5],['reto','2026-11-20',39]]);

  // Duelos (decisión 0059). El servidor mira el duelo guardado: quién ganó, si fue contra el bot y si alguien abandonó.
  clock=at('2026-11-21');
  const eva=randomUUID(),duel=(player,id)=>progress('premio',player,{duel:id});
  await progress('guardar',eva,{state:{v:1,xp:43500},delta:0});
  const start=(await progress('leer',luis)).data.coins;
  let id=await finished(luis,eva,0);
  assert.equal((await duel(null,id)).status,401);
  r=await duel(luis,id);assert.deepEqual(r.data,{coins:start+15,amount:15,reason:'duelos'});
  assert.equal((await duel(luis,id)).data.coins,start+15,'Un duelo se cobra una vez');
  assert.deepEqual((await duel(eva,id)).data,{coins:5,amount:5,reason:'duelos'},'Quien pierde cobra 5');
  assert.equal((await duel(ana,id)).status,409,'No es su duelo');
  for(const bad of [randomUUID(),'x',null,42])assert.equal((await duel(luis,bad)).status,409);
  // Sin terminar, cancelado o sin rival: nada que cobrar.
  const waiting=randomUUID();await duels.create({id:waiting,code:'ESPERA',status:'playing',createdAt:clock,seenAt:clock,players:[{hash:hashOf(luis)},{hash:hashOf(eva)}],questions:[],rounds:[],winner:null,reason:null});
  assert.equal((await duel(luis,waiting)).status,409);
  assert.equal((await duel(luis,await finished(luis,null,null,'cancelado'))).status,409);
  // Empate (8) y tercero del día; el cuarto ya va al 25 %.
  assert.equal((await duel(luis,await finished(eva,luis,'draw'))).data.amount,8);
  assert.equal((await duel(luis,await finished(eva,luis,1))).data.amount,15);
  assert.equal((await duel(luis,await finished(luis,eva,0))).data.amount,4,'Pasado el tope diario, el 25 %');
  assert.equal((await duel(luis,await finished(luis,eva,1))).data.amount,1);
  // Abandonar no da nada; que abandone el rival cuenta como victoria.
  id=await finished(eva,ana,1,'abandono');
  assert.deepEqual((await duel(eva,id)).data,{coins:5,amount:0,reason:'duelos'});
  assert.equal((await duel(ana,id)).data.amount,15);
  // Contra Faraday-bot solo se cobra el primero del día.
  r=await duel(ana,await finished(ana,'bot',0));assert.deepEqual([r.data.amount,r.data.reason],[15,'duelos-bot']);
  assert.equal((await duel(ana,await finished(ana,'bot',0))).data.amount,0);
  // Al día siguiente vuelve a haber tope entero y bot.
  clock=at('2026-11-22');
  assert.equal((await duel(luis,await finished(luis,eva,0))).data.amount,15);
  assert.equal((await duel(ana,await finished(ana,'bot',1))).data.amount,5);
  moves=await ledger(luis);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),(await progress('leer',luis)).data.coins);
  assert.ok(moves.filter(move=>move.reason==='duelos').every(move=>move.source==='servidor'&&/^[0-9a-f-]{36}$/.test(move.ref)));

  // Apuestas en bote (decisión 0060): la cobra el servidor al empezar y la paga al terminar.
  clock=at('2026-11-23');
  const leo=randomUUID(),mar=randomUUID(),bet=(player,id)=>progress('apostar',player,{duel:id}),cash=(player,id)=>progress('cobrar-apuesta',player,{duel:id});
  await progress('guardar',leo,{state:{v:1,xp:43500},delta:1000});await progress('guardar',mar,{state:{v:1,xp:43500},delta:100});
  // Un duelo en juego, en su primera pregunta, con la apuesta de cada uno.
  async function live(first,second,betA,betB){
    const id=randomUUID(),one=(player,tier)=>player==='bot'?{hash:'bot',bot:true,bet:null}:{hash:hashOf(player),bet:tier};
    await duels.create({id,code:id.slice(0,6).toUpperCase(),public:false,status:'playing',createdAt:clock,seenAt:clock,players:[one(first,betA),one(second,betB)],questions:['q'],rounds:[{resolvedAt:null}],winner:null,reason:null,next:null});
    return id;
  }
  async function end(id,winner,reason='ko'){const row=await duels.get(id);await duels.save({...row.state,status:'finished',winner,reason,rounds:[{resolvedAt:clock}]},row.version)}
  const coinsOf=async player=>(await progress('leer',player)).data.coins;

  // Se juega la más baja de las dos (60): cada uno pone 60 y quien gana se lleva 120 menos el 10 %.
  id=await live(leo,mar,'alto-voltaje','calambre');
  assert.equal((await bet(null,id)).status,401);assert.equal((await bet(ana,id)).status,409,'No es su duelo');
  assert.equal((await cash(leo,id)).status,409,'Sin terminar no se cobra');
  r=await bet(leo,id);assert.deepEqual(r.data,{coins:940,stake:60});
  assert.deepEqual((await bet(leo,id)).data,{coins:940,stake:60},'No se cobra dos veces');
  assert.deepEqual((await bet(mar,id)).data,{coins:40,stake:60});
  await end(id,0);
  assert.equal((await bet(mar,id)).data.coins,40);
  assert.deepEqual((await cash(leo,id)).data,{coins:940+108,amount:108,stake:60,result:'won'});
  assert.equal((await cash(leo,id)).data.coins,1048,'El premio se paga una vez');
  assert.deepEqual((await cash(mar,id)).data,{coins:40,amount:0,stake:60,result:'lost'});
  assert.equal(await coinsOf(leo)+await coinsOf(mar),1100-12,'Del bote solo se destruye la comisión');

  // Sin saldo no se entra; si el rival no llegó a poner su parte, se devuelve.
  id=await live(leo,mar,'calambre','calambre');
  assert.equal((await bet(mar,id)).data.code,'saldo');
  await bet(leo,id);await end(id,1);
  assert.deepEqual((await cash(leo,id)).data,{coins:1048,amount:60,stake:60,result:'void'});
  assert.deepEqual((await cash(mar,id)).data,{coins:40,amount:0,stake:0,result:'none'});
  // Empate: cada uno recupera lo suyo. Abandonar es perder.
  id=await live(leo,mar,'chispazo','chispazo');await bet(leo,id);await bet(mar,id);await end(id,'draw','rondas');
  assert.equal((await cash(leo,id)).data.result,'draw');assert.equal((await cash(mar,id)).data.amount,25);
  assert.equal(await coinsOf(leo),1048);assert.equal(await coinsOf(mar),40);
  id=await live(leo,mar,'chispazo','chispazo');await bet(leo,id);await bet(mar,id);await end(id,1,'abandono');
  assert.equal((await cash(leo,id)).data.result,'lost');assert.deepEqual((await cash(mar,id)).data,{coins:40-25+45,amount:45,stake:25,result:'won'});
  // Pasada la primera pregunta ya no se entra; sin apuesta de los dos o contra el bot no hay bote.
  id=await live(leo,mar,'chispazo','chispazo');{const row=await duels.get(id);await duels.save({...row.state,rounds:[{resolvedAt:clock},{resolvedAt:null}]},row.version)}
  assert.equal((await bet(leo,id)).data.code,'tarde');
  assert.equal((await bet(leo,await live(leo,mar,'chispazo',null))).data.code,'sin-bote');
  assert.equal((await bet(leo,await live(leo,'bot','chispazo',null))).data.code,'sin-bote');
  // Tope: cinco duelos con apuesta al día (leo lleva cuatro).
  assert.equal((await bet(leo,await live(leo,mar,'chispazo','chispazo'))).status,200);
  assert.equal((await bet(leo,await live(leo,mar,'chispazo','chispazo'))).data.code,'tope');
  clock=at('2026-11-24');
  assert.equal((await bet(leo,await live(leo,mar,'chispazo','chispazo'))).status,200);
  moves=await ledger(leo);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),await coinsOf(leo));
  assert.ok(moves.filter(move=>move.reason.startsWith('apuesta')).every(move=>move.source==='servidor'));
  assert.ok(!REASONS.includes('apuestas'));

  console.log('premios: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
