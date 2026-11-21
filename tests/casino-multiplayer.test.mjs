import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApi} from '../lib/api.mjs';
import {fileCasino} from '../lib/casino-store.mjs';
import {fileSocial} from '../lib/social-store.mjs';
import {pokerRank} from '../lib/casino.mjs';

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
  assert.equal(new Set(hands.flatMap(h=>h.table.round.cards.map(card=>JSON.stringify(card)))).size,15);
  assert.ok(hands.every(h=>h.coins===975&&h.table.round.cards.length===5&&!h.table.round.results));
  assert.deepEqual((await pulse('Dani')).tables,[]);
  const id=hands[0].table.round.id;
  await expect(400,'Ana','draw',{id,held:[true]});
  const all=Array(5).fill(true),none=Array(5).fill(false);
  await expect(200,'Ana','draw',{id,held:all});
  const duplicate=await expect(200,'Ana','draw',{id,held:none});
  assert.deepEqual(duplicate.table.round.cards,hands[0].table.round.cards);
  await Promise.all(['Clara','Beto'].map(player=>expect(200,player,'draw',{id,held:none})));
  const completed=await Promise.all(['Ana','Clara','Beto'].map(player=>pulse(player)));
  assert.equal(completed.reduce((sum,h)=>sum+h.coins,0),3000);
  assert.equal(completed[0].table.round.results.reduce((sum,h)=>sum+h.prize,0),75);
  assert.equal(await ready('Ana',id).then(result=>result.table.seats[0].ready),true);
  await expect(409,'Ana','deal',{id:table.id,previous:id});
  await ready('Clara',id);await ready('Beto',id);
  await expect(200,'Ana','deal',{id:table.id,previous:id});
  api=makeApi();
  clock+=46000;
  const balances=[];
  for(const player of ['Ana','Clara','Beto'])balances.push((await pulse(player)).coins);
  assert.equal(balances.reduce((sum,value)=>sum+value,0),3000);
  assert.equal((await pulse('Ana')).table,null); // Las plazas inactivas caducaron, pero el bote se pagó.
  const beta=(await social('Ana','amigos')).friends.find(friend=>friend.name==='Beto');
  await social('Ana','bloquear',{id:beta.id});
  assert.ok(!(await pulse('Ana')).players.some(peer=>peer.name==='Beto'));
  api=makeApi('publico');
  await expect(409,'Ana','pulse');
  await social('Ana','activar',{name:'Ana'});
  assert.equal((await pulse('Ana')).coins,1000);
  assert.deepEqual((await pulse('Ana')).players,[]);

  const ranks=(values,suits)=>values.map((r,i)=>({r,s:suits[i]}));
  const aceLow=pokerRank(ranks([14,2,3,4,5],[0,1,2,3,0]));
  const sixHigh=pokerRank(ranks([2,3,4,5,6],[0,1,2,3,0]));
  const lowPair=pokerRank(ranks([2,2,4,10,14],[0,1,2,3,0]));
  assert.deepEqual(aceLow.score,[4,5]);
  assert.deepEqual(sixHigh.score,[4,6]);
  assert.deepEqual(lowPair.score,[1,2,14,10,4]);
  console.log('Salón compartido: amistad, sesión, presencia, cartas privadas, consentimiento, bote, concurrencia y caducidad correctos.');
}finally{rmSync(dir,{recursive:true,force:true})}
