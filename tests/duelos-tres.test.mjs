// Prueba los duelos de tres (decisión 0082, lib/duelos.mjs) con un reloj controlado: reparto de daño, eliminados,
// ganador, abandono, entrada, chat, premios y bote. No espera ni usa red.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {RULES,createDuels,memoryDuels,multiplier} from '../lib/duelos.mjs';
import {createDuelPrizes} from '../lib/premios.mjs';
import {betStake,betResult,betPayout} from '../lib/apuestas.mjs';
import {createRanked,memoryRanks} from '../lib/rangos.mjs';

let t=Date.parse('2026-11-16T10:00:00Z'),seed=3;
const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const bank=new Map(Array.from({length:30},(_,i)=>[`q${i}`,{id:`q${i}`,answer:100*(i+1),title:`Pregunta ${i}`,unit:'u',category:'x',sources:[]}]));
const store=memoryDuels();
const duels=createDuels({duels:store,questions:bank,pool:()=>[...bank.keys()],now:()=>t,random,ranked:createRanked({ranks:memoryRanks()})});
const call=async(action,player,extra={})=>{const r=await duels.handle({action,player,...extra});return {status:r.status,data:r.body}};
const [ana,luis,eva,otro]=[1,2,3,4].map(()=>randomUUID());
const answer=view=>bank.get(view.round.question.id).answer;

try{
  // Un duelo de tres espera a los dos que faltan; los de dos y los de tres no se mezclan.
  let a=await call('buscar',ana,{name:'Ana',size:3,bet:'chispazo',level:10});
  assert.equal(a.data.size,3);assert.equal(a.data.status,'waiting');const id=a.data.id;
  let two=await call('buscar',otro,{name:'Otro'});
  assert.notEqual(two.data.id,id,'Quien busca 1vs1 no entra en un duelo de tres');assert.equal(two.data.size,undefined);
  await call('salir',otro,{id:two.data.id});
  let b=await call('buscar',luis,{name:'Luis',size:3,bet:'calambre',level:12});
  assert.equal(b.data.id,id);assert.equal(b.data.status,'waiting','Con dos jugadores aún espera');assert.equal(b.data.players.length,2);assert.equal(b.data.you,1);
  assert.equal((await call('chat',ana,{id,kind:'phrase',value:'gg'})).status,409,'El chat se abre cuando empieza');
  assert.equal((await call('bot',ana,{id})).status,409,'Sin bot en los de tres');
  assert.equal((await call('buscar',eva,{name:'Eva',size:3,mode:'ranked'})).status,400,'Sin clasificatorias de tres');
  // Quien se va de la sala libera su sitio; el duelo sigue esperando.
  await call('salir',luis,{id});
  assert.equal((await call('estado',ana,{id})).data.players.length,1);
  assert.equal((await call('estado',luis,{id})).status,403);
  b=await call('buscar',luis,{name:'Luis',size:3,bet:'calambre',level:12});assert.equal(b.data.id,id);
  let c=await call('buscar',eva,{name:'Eva',size:3,bet:'alto-voltaje',level:15});
  assert.equal(c.data.id,id);assert.equal(c.data.you,2);assert.equal(c.data.phase,'intro');assert.equal(c.data.players.length,3);
  assert.equal((await call('estado',otro,{id})).status,403,'Un cuarto no entra');
  assert.equal((await call('unirse',otro,{code:c.data.code,name:'Otro'})).status,409,'Mesa llena');

  // Ronda 1: Ana clava, Luis falla por 2× y Eva no responde. Daño = (mejor − tus puntos) × multiplicador.
  t+=RULES.introMs;
  a=await call('estado',ana,{id});assert.equal(a.data.phase,'question');assert.deepEqual(a.data.round.answered,[false,false,false]);
  const real=answer(a.data);
  t+=1000;await call('responder',ana,{id,guess:real});
  b=await call('responder',luis,{id,guess:real*2});
  assert.deepEqual(b.data.round.answered,[true,true,false]);assert.equal(b.data.round.rushed,true,'Al responder el primero, a los demás les quedan 30 s');
  assert(!('guesses' in b.data.round),'No se ven las respuestas hasta el final');
  t+=RULES.rushMs+RULES.graceMs;
  c=await call('estado',eva,{id});
  assert.equal(c.data.phase,'reveal');assert.deepEqual(c.data.round.points,[5000,3997,0]);
  assert.deepEqual(c.data.round.damages,[0,Math.round(1003*multiplier(1)),Math.round(5000*multiplier(1))]);
  assert.deepEqual(c.data.players.map(p=>p.hp),[6000,6000-201,6000-1000]);assert.deepEqual(c.data.round.best,[0]);

  // El chat se abre y cada mensaje dice quién lo escribe.
  const chat=await call('chat',eva,{id,kind:'phrase',value:'uff'});
  assert.equal(chat.status,200);assert.deepEqual(chat.data.chat.map(m=>[m.seat,m.from]),[[2,'you']]);
  assert.deepEqual((await call('estado',ana,{id})).data.chat.map(m=>[m.seat,m.from]),[[2,'rival']]);

  // Rondas siguientes: Ana siempre clava, Luis falla por 100× y Eva por 10×. Cae primero Luis; después Eva sigue.
  let view,round=1;
  while(true){
    t+=RULES.revealMs;view=(await call('estado',ana,{id})).data;
    if(view.phase==='finished')break;
    round=view.round.number;const real2=answer(view);
    await call('responder',ana,{id,guess:real2});await call('responder',luis,{id,guess:real2*100});
    // Con Luis fuera, la ronda se cierra cuando responden los que quedan.
    const alive=view.round.alive;
    if(alive.includes(2))await call('responder',eva,{id,guess:real2*10});
    view=(await call('estado',ana,{id})).data;
    if(view.status==='finished')break;
    assert.equal(view.phase,'reveal');assert.equal(view.round.alive.length,alive.length);
  }
  assert.equal(view.reason,'ko');assert.equal(view.winner,'you');assert.deepEqual(view.places,[1,3,2],'Ana primera; Luis cayó antes que Eva');
  assert.equal((await call('estado',luis,{id})).data.winner,'rival');
  assert(view.rounds.every(r=>r.damages.length===3&&r.points.length===3));
  assert(view.players[1].hp===0&&view.players[2].hp>=0);

  // Premios: gana el primero; el resto cobra como derrota. Misma duración y tope que el 1vs1.
  const finished=(await store.get(id)).state;
  const prize=createDuelPrizes({duel:async()=>finished,paid:async()=>0});
  const [pa,pl,pe]=[await prize(finished.players[0].hash,id),await prize(finished.players[1].hash,id),await prize(finished.players[2].hash,id)];
  assert.deepEqual([pa.result,pl.result,pe.result],['win','loss','loss']);assert.deepEqual([pa.amount,pl.amount],[15,5]);assert(pa.rounds>0&&!pa.bot&&!pa.abandoned);
  // Bote: los tres apuestan; ponen la más baja (25), gana Ana el bote menos el 10 % y los demás pierden lo suyo.
  assert.equal(betStake(finished),25);
  assert.deepEqual([0,1,2].map(i=>betResult(finished,i)),['won','lost','lost']);
  assert.equal(betPayout('won',25,{size:3}),67,'Bote de 75 menos el 10 % (7,5 se redondea a 8)');
  assert.equal(betStake({...finished,players:finished.players.map((p,i)=>i?p:{...p,bet:null})}),0,'Si uno no apuesta, no hay bote');
  assert.equal(betStake({size:3,players:finished.players.slice(0,2)}),0,'Con dos jugadores aún no hay bote');
  // Empate arriba entre dos: se reparten el bote; el tercero pierde. Empate de los tres: cada uno recupera lo suyo.
  const tie={...finished,winner:'draw',winners:[0,1]};
  assert.deepEqual([0,1,2].map(i=>betResult(tie,i)),['won','won','lost']);assert.equal(betPayout('won',25,{size:3,winners:2}),33);
  assert.deepEqual([0,1,2].map(i=>betResult({...finished,winner:'draw',winners:[0,1,2]},i)),['draw','draw','draw']);
  assert.equal(betPayout('draw',25,{size:3}),25);assert.equal(betPayout('void',25,{size:3}),25);
  // El bote de dos sigue como siempre.
  assert.equal(betPayout('won',25),45);

  // Revancha: la pide el primero, los otros dos entran en su mesa; sigue siendo de tres.
  a=await call('revancha',ana,{id,name:'Ana'});assert.equal(a.data.size,3);assert.equal(a.data.status,'waiting');assert.equal(a.data.public,false);
  b=await call('estado',luis,{id});assert.equal(b.data.next,a.data.code);
  b=await call('revancha',luis,{id,name:'Luis'});assert.equal(b.data.id,a.data.id);assert.equal(b.data.status,'waiting');
  c=await call('revancha',eva,{id,name:'Eva'});assert.equal(c.data.id,a.data.id);assert.equal(c.data.phase,'intro');

  // Abandono: quien se va queda eliminado y la partida sigue entre los otros dos.
  const id2=a.data.id;t+=RULES.introMs;
  b=await call('salir',luis,{id:id2});
  assert.equal(b.data.status,'playing');assert.equal(b.data.players[1].hp,0);assert.equal(b.data.players[1].left,true);
  view=(await call('estado',ana,{id:id2})).data;assert.equal(view.status,'playing');
  const real3=answer(view);t+=1000;
  await call('responder',ana,{id:id2,guess:real3});
  assert.equal((await call('responder',luis,{id:id2,guess:1})).status,409,'Quien se ha ido ya no responde');
  view=(await call('responder',eva,{id:id2,guess:real3*10})).data;
  assert.equal(view.phase,'reveal','La ronda se cierra con las dos respuestas de quienes siguen');assert.deepEqual(view.round.alive,[0,2]);
  assert.equal(view.round.damages[1],0);assert(view.round.damages[2]>0);
  // Si se va otro, gana el que queda; el que se fue primero queda último y no cobra.
  view=(await call('salir',eva,{id:id2})).data;
  assert.equal(view.status,'finished');assert.equal(view.reason,'abandono');assert.equal((await call('estado',ana,{id:id2})).data.winner,'you');
  assert.deepEqual(view.places.map((place,i)=>[i,place]).filter(([i])=>i===0).map(([,p])=>p),[1]);assert.equal(view.places[1],3,'Quien se fue primero queda tercero');assert.equal(view.places[2],2);
  const left=(await store.get(id2)).state;
  const prize2=createDuelPrizes({duel:async()=>left,paid:async()=>0});
  assert.equal((await prize2(left.players[1].hash,id2)).abandoned,true);assert.equal((await prize2(left.players[1].hash,id2)).amount,0,'Quien abandona no cobra');
  assert.equal((await prize2(left.players[0].hash,id2)).result,'win');
  assert.equal((await call('activo',luis)).data.active?.id===id2,false,'Quien se ha ido de un duelo de tres no vuelve a él al reconectar');

  // Reconectar: el aviso dice con quién se juega; un duelo de tres a medias sigue vivo.
  a=await call('buscar',ana,{name:'Ana',size:3});assert.equal(a.data.status,'waiting');
  const active=(await call('activo',ana)).data.active;assert.equal(active.size,3);assert.equal(active.waitingFor,2);assert.equal(active.id,a.data.id);

  // Empate de rondas: tras diez rondas empatan los de más vida; si hay uno solo arriba, gana ese. Nadie responde: nadie pierde.
  const d1=await call('crear',ana,{name:'Ana',size:3});
  await call('unirse',luis,{code:d1.data.code,name:'Luis'});await call('unirse',eva,{code:d1.data.code,name:'Eva'});
  t+=RULES.introMs;
  for(let r=1;r<=RULES.maxRounds;r++){t+=RULES.roundMs+RULES.graceMs+RULES.revealMs;view=(await call('estado',ana,{id:d1.data.id})).data}
  assert.equal(view.status,'finished');assert.equal(view.reason,'rondas');assert.equal(view.winner,'draw','Los tres igualados empatan');assert.deepEqual(view.places,[1,1,1]);
  assert.deepEqual(view.players.map(p=>p.hp),[6000,6000,6000]);

  // El 1vs1 sigue igual: sin size, sin puestos y con dos jugadores.
  const duo=await call('crear',ana,{name:'Ana'});assert.equal(duo.data.size,undefined);
  const duo2=await call('unirse',luis,{code:duo.data.code,name:'Luis'});assert.equal(duo2.data.players.length,2);assert.equal(duo2.data.phase,'intro');
  console.log('OK: duelos de tres (entrada, daño, eliminados, puestos, abandono, chat, premios, bote, revancha y reconexión).');
}catch(error){console.error(error);process.exit(1)}
