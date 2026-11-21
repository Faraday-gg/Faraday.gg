import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApi} from '../lib/api.mjs';
import {fileCasino} from '../lib/casino-store.mjs';
import {fileSocial} from '../lib/social-store.mjs';

const dir=mkdtempSync(join(tmpdir(),'faraday-casino-'));
const accounts=Object.fromEntries(['Ana','Beto','Clara','Dani'].map(name=>[name,{player:randomUUID()}]));
const auth={async current(request,readCookie){
  const account=accounts[readCookie(request,'test-user')];
  return account?{account}:null;
}};
let clock=Date.parse('2026-11-21T12:00:00Z');
const makeApi=(scope='preview')=>createApi({
  store:{social:fileSocial(join(dir,'social.json')),casino:fileCasino(join(dir,'casino.json'))},
  auth,trendScope:scope,now:()=>clock,log:()=>{}
});
let api=makeApi();
async function call(player,action,extra={},mode='casino',origin='https://faraday.test'){
  const headers={cookie:'test-user='+player,origin};
  const res=await api.handle(new Request('https://faraday.test/api/'+mode,{method:'POST',headers,body:JSON.stringify({action,...extra})}));
  return {status:res.status,data:await res.json()};
}
async function expect(status,...args){
  const result=await call(...args);
  assert.equal(result.status,status,JSON.stringify(result.data));
  return result.data;
}
const pulse=(player,extra)=>expect(200,player,'pulse',extra);
const ready=(player,previous)=>expect(200,player,'ready',{ready:true,previous});
const social=(player,action,data)=>expect(200,player,action,data,'social');

try{
  await expect(401,'Invitado','pulse');
  await expect(403,'Ana','pulse',{},'casino','https://otro.test');
  await expect(409,'Ana','pulse');
  for(const player of Object.keys(accounts))await social(player,'activar',{name:player});
  const anaCode=(await social('Ana','amigos')).invite;
  const betoCode=(await social('Beto','amigos')).invite;
  await social('Beto','agregar',{code:anaCode});
  await social('Clara','agregar',{code:anaCode});
  await social('Clara','agregar',{code:betoCode});

  await pulse('Ana');
  await pulse('Beto',{x:700,z:-2.55,heading:0.5,look:{top:'camiseta-amarilla',_raw:{hair:'bad'}}});
  await pulse('Clara');
  assert.deepEqual((await pulse('Dani')).players,[]);
  const peers=(await pulse('Ana')).players;
  assert.deepEqual(peers.map(peer=>peer.name).sort(),['Beto','Clara']);
  assert.deepEqual(peers.find(peer=>peer.name==='Beto').look,{top:'camiseta-amarilla'});
  assert.equal(peers.find(peer=>peer.name==='Beto').x,12.3);
  assert.ok(peers.every(peer=>!JSON.stringify(peer).includes(accounts.Beto.player)));

  const {table}=await expect(200,'Ana','create');
  await expect(404,'Dani','join',{id:table.id});
  await Promise.all(['Beto','Clara'].map(player=>expect(200,player,'join',{id:table.id})));
  await expect(409,'Ana','deal',{id:table.id});
  for(const player of ['Ana','Clara','Beto'])await ready(player);
  await expect(409,'Beto','deal',{id:table.id});
  const deals=await Promise.all([call('Ana','deal',{id:table.id}),call('Ana','deal',{id:table.id})]);
  assert.deepEqual(deals.map(result=>result.status).sort(),[200,409]);
  const hands=await Promise.all(['Ana','Clara','Beto'].map(player=>pulse(player)));
  const seen=hands.map(h=>h.table.round.seats.find(seat=>seat.mine).cards);
  assert.equal(new Set(seen.flat().map(card=>JSON.stringify(card))).size,6);
  assert.ok(hands.every(h=>h.coins===1000&&h.table.round.stage==='preflop'&&h.table.round.board.length===0));
  // Nadie ve las cartas de los demás ni la baraja.
  assert.ok(hands.every(h=>h.table.round.seats.filter(seat=>!seat.mine).every(seat=>seat.cards===null)&&!JSON.stringify(h).includes('"deck"')));
  assert.deepEqual((await pulse('Dani')).tables,[]);
  const id=hands[0].table.round.id;
  // Primera mano: Ana tiene el botón, los otros dos ponen las ciegas (5 y 10) y habla ella.
  const names=hands[0].table.round.seats.map(seat=>seat.name);
  assert.equal(names[0],'Ana');assert.equal(hands[0].table.round.turn,0);assert.equal(hands[0].table.round.pot,15);
  assert.deepEqual(hands[0].table.round.legal,{seat:0,toCall:10,canCheck:false,canRaise:true,minTo:20,maxTo:200});
  assert.ok(hands.slice(1).every(h=>h.table.round.legal===null));
  await expect(409,names[1],'act',{id,move:'call'});                // no es su turno
  await expect(400,'Ana','act',{id,move:'draw'});
  await expect(400,'Ana','act',{id,move:'raise',to:'40'});
  await expect(409,'Ana','act',{id,move:'raise',to:5000});          // más de lo que tiene en la mesa
  await expect(409,'Ana','act',{id:randomUUID(),move:'call'});
  await expect(200,'Ana','act',{id,move:'raise',to:40});
  // Dos envíos de la misma jugada: solo vale uno.
  const calls=await Promise.all([call(names[1],'act',{id,move:'call'}),call(names[1],'act',{id,move:'call'})]);
  assert.deepEqual(calls.map(result=>result.status).sort(),[200,409]);
  await expect(200,names[2],'act',{id,move:'fold'});
  let state=await pulse('Ana');
  assert.equal(state.table.round.stage,'flop');assert.equal(state.table.round.board.length,3);assert.equal(state.table.round.pot,90);
  // Hasta el final pasando: se enseñan las cartas de quien sigue en la mano.
  for(let step=0;state.table.round.stage!=='done';step++){
    assert.ok(step<6);
    state=await expect(200,names[state.table.round.turn],'act',{id,move:'check'});
  }
  await expect(409,'Ana','act',{id,move:'check'});
  const completed=await Promise.all(names.map(player=>pulse(player)));
  assert.equal(completed.reduce((sum,h)=>sum+h.coins,0),3000);
  const results=completed[0].table.round.seats;
  assert.equal(results.reduce((sum,seat)=>sum+seat.won,0),90);
  assert.equal(results[2].cards,null);                              // quien se retiró no enseña
  assert.ok(results[0].cards.length===2&&results[1].cards.length===2&&results[1].hand);
  assert.equal(completed[0].table.round.board.length,5);
  assert.equal(completed[2].coins,990);
  assert.equal(await ready('Ana',id).then(result=>result.table.seats[0].ready),true);
  await expect(409,'Ana','deal',{id:table.id,previous:id});
  await ready('Clara',id);await ready('Beto',id);
  const second=(await expect(200,'Ana','deal',{id:table.id,previous:id})).table.round;
  assert.equal(second.button,1);assert.equal(second.turn,1);     // el botón pasa al siguiente
  // Levantarse en mitad de la mano es retirarse: pierde la ciega que ya había puesto.
  assert.equal((await expect(200,names[2],'stand')).table,null);
  assert.equal((await pulse(names[2])).coins,990);
  // Si nadie vuelve, a cada uno se le pasa el turno y la mano se liquida sola.
  api=makeApi();
  clock+=46000;
  const balances=[];
  for(const player of ['Ana','Clara','Beto'])balances.push((await pulse(player)).coins);
  assert.equal(balances.reduce((sum,value)=>sum+value,0),3000);
  assert.equal((await pulse(names[2])).coins,985);
  assert.equal((await pulse('Ana')).table,null); // Las plazas inactivas caducaron, pero el bote se pagó.
  const beta=(await social('Ana','amigos')).friends.find(friend=>friend.name==='Beto');
  await social('Ana','bloquear',{id:beta.id});
  assert.ok(!(await pulse('Ana')).players.some(peer=>peer.name==='Beto'));
  api=makeApi('publico');
  await expect(409,'Ana','pulse');
  await social('Ana','activar',{name:'Ana'});
  assert.equal((await pulse('Ana')).coins,1000);
  assert.deepEqual((await pulse('Ana')).players,[]);

  console.log('Salón compartido: amistad, sesión, presencia, cartas privadas, turnos, apuestas, bote, concurrencia y caducidad correctos.');
}finally{rmSync(dir,{recursive:true,force:true})}
