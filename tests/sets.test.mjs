// Prueba los sets (decisión 0079): disfraces por partes. Cada parte es una edición de colección que no se compra: sale
// en cofres en el sitio de un premio épico o legendario, numerada y de tirada cerrada, y se intercambia como las demás.
// Quien tiene las cinco partes de un set gana más faradios por partida. A través de la API, con cuentas falsas; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {memoryDuels} from '../lib/duelos.mjs';
import {Chests,FIRST_CHESTS} from '../lib/cofres.mjs';
import {PIECES,EDITIONS,SETS,SET_BONUS,setBonus} from '../lib/catalogo.mjs';
import {CAPPED,DAILY_CAP} from '../lib/misiones.mjs';
import {todayPrize,DUEL} from '../lib/premios.mjs';
import {getDay} from '../content-engine.mjs';

// El catálogo: seis sets de cinco partes (cabeza, ropa, pantalón, calzado y guantes), la cabeza legendaria y el resto
// épicas. Cada parte es una edición con tirada, sin precio: ni se vende en la tienda ni sale como pieza normal.
const page={};page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/avatar.js',import.meta.url),'utf8'),page);
const {Avatar}=page;
assert.equal(SETS.length,6);assert.deepEqual({...SET_BONUS},{each:.1,max:.3});
const all=SETS.flatMap(set=>set.parts);
assert.equal(new Set(all.map(part=>part.edition)).size,30,'Cada parte tiene su edición');
for(const set of SETS){
  assert.deepEqual(set.parts.map(part=>part.slot).sort(),['bottom','extra','hat','shoes','top'],`El set ${set.id} tiene una parte por hueco`);
  assert.deepEqual(set.parts.map(part=>part.rarity).sort(),['epica','epica','epica','epica','legendaria']);
  assert.equal(set.parts.find(part=>part.slot==='hat').rarity,'legendaria','La cabeza es la legendaria');
  for(const part of set.parts){
    const edition=EDITIONS.get(part.edition),[slot,id]=part.key.split(':'),item=Avatar.find(slot,id);
    assert.ok(edition&&item,'Falta '+part.key);assert.equal(edition.set,set.id);assert.equal(edition.rarity,part.rarity);
    assert.equal(edition.total,part.rarity==='legendaria'?40:120);assert.equal(edition.price,0);
    assert.equal(item.price,0);assert.equal(item.for,undefined,'Vale para los dos cuerpos');assert.equal(PIECES.has(part.key),false);
    assert.equal(Avatar.rarity(item),part.rarity);assert.equal(Avatar.finishable(item),false);
    assert.match(id,/^[a-z0-9-]{1,28}$/,'El identificador cabe en un avatar que viaja');assert.match(edition.id,/^[a-z0-9-]{1,32}$/);
    // Se puede llevar con los dos cuerpos.
    for(const body of ['hombre','mujer'])assert.equal(Avatar.normalize({body,[slot]:id})[slot],id);
  }
}
assert.equal(new Set([...EDITIONS.values()].map(edition=>edition.n)).size,EDITIONS.size,'Cada edición tiene su número');
// Los guantes tiñen las manos.
assert.equal(Avatar.resolve({extra:'set-pirata-guantes'}).gloves,'negro');assert.equal(Avatar.resolve({}).gloves,undefined);

// El extra: 10 % por set completo, hasta 30 %.
const unitsOf=sets=>sets.flatMap(set=>set.parts.map(part=>({edition:part.edition,serial:1})));
assert.deepEqual(setBonus([]),{sets:[],rate:0});
assert.deepEqual(setBonus(unitsOf(SETS.slice(0,1)).slice(1)),{sets:[],rate:0},'Con cuatro partes no hay extra');
assert.deepEqual(setBonus(unitsOf(SETS.slice(0,1))),{sets:[SETS[0].id],rate:.1});
assert.equal(setBonus(unitsOf(SETS.slice(0,3))).rate,.3);assert.equal(setBonus(unitsOf(SETS)).rate,.3,'El extra tiene techo');
assert.ok(CAPPED.includes('sets'),'El extra cuenta para el tope diario');

// El sorteo. Sin partes es el de siempre; con partes, sustituyen a una parte de los premios épicos y legendarios.
const seeded=seed=>()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const items=[...PIECES].map(([key,piece])=>({key,rarity:piece.rarity})),parts=all.map(({key,edition,rarity})=>({key,edition,rarity}));
assert.deepEqual({...Chests.SET_ODDS},{epica:.2,legendaria:.25});
for(const type of Chests.TYPES)for(let seed=1;seed<=20;seed++){
  const plain=Chests.roll(type,{items:items.map(item=>({...item})),random:seeded(seed)}),none=Chests.roll(type,{items:items.map(item=>({...item})),parts:[],random:seeded(seed)});
  assert.deepEqual(JSON.parse(JSON.stringify(none)),JSON.parse(JSON.stringify(plain)));assert.ok(!plain.rewards.some(reward=>reward.part));
}
const tally={epica:[0,0],legendaria:[0,0]},random=seeded(11);
for(let n=0;n<4000;n++)for(const reward of Chests.roll('faraday',{items:items.map(item=>({...item})),parts,random}).rewards){
  const rarity=reward.rarity||reward.instead;
  if(reward.part){
    const part=parts.find(one=>one.edition===reward.part);
    assert.equal(reward.kind,'item');assert.equal(reward.key,part.key);assert.equal(part.rarity,rarity);assert.equal(reward.finish,undefined);
  }else assert.ok(reward.kind==='coins'||PIECES.has(reward.key));
  if(Chests.high(rarity)){tally[rarity][0]++;if(reward.part)tally[rarity][1]++}
}
for(const rarity of ['epica','legendaria']){const [total,got]=tally[rarity],share=got/total;assert.ok(Math.abs(share-Chests.SET_ODDS[rarity])<.03,`Partes ${rarity}: ${share}`)}
// Solo quedan partes épicas: una legendaria nunca se convierte en parte.
for(let n=0;n<300;n++)for(const reward of Chests.roll('faraday',{items:[],parts:parts.filter(part=>part.rarity==='epica'),random}).rewards)if(reward.part)assert.equal(reward.rarity,'epica');

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-sets-'));
const at=date=>Date.parse(date+'T09:00:00Z'),hashOf=player=>createHash('sha256').update(player).digest('hex');
let clock=at('2026-11-16');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const duels=memoryDuels(),store={...fileStore(path.join(directory,'answers.json')),duels};
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,random:seeded(3),auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const coinsOf=async player=>(await progress('leer',player)).data.coins,unitsFrom=async player=>(await progress('inventario',player)).data.collectibles;
const setsOf=async player=>(await progress('sets',player)).data;
async function play(player,date){for(const question of getDay(date,{persist:false}).questions)assert.equal((await post('answers',{question:question.id,player,guess:question.answer})).status,200)}
async function wonDuel(player,rival){
  const id=randomUUID();
  await duels.create({id,code:id.slice(0,6).toUpperCase(),public:false,status:'finished',createdAt:clock,seenAt:clock,players:[{hash:hashOf(player)},{hash:hashOf(rival)}],questions:['q'],rounds:[{}],winner:0,reason:'ko',next:null});
  return id;
}
// Da a un jugador una unidad de cada parte de un set, como si le hubieran tocado.
async function give(player,set){for(const part of set.parts){const serial=await store.community.editionNext(part.edition,EDITIONS.get(part.edition).total);await store.community.addCollectible(part.edition,serial,hashOf(player))}}
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID();
  await progress('guardar',luis,{state:{v:1,xp:43500,look:{body:'hombre'},chests:{faraday:FIRST_CHESTS,tormenta:FIRST_CHESTS}},delta:100});
  await progress('guardar',ana,{state:{v:1,xp:4500},delta:100});await progress('guardar',eva,{state:{v:1,xp:4500},delta:100});

  // La lista de sets: todas las unidades por repartir y nada de extra.
  assert.equal((await progress('sets',null)).status,401);
  let mine=await setsOf(luis);
  assert.deepEqual(mine.bonus,{each:.1,max:.3,rate:0});assert.deepEqual(mine.odds,{epica:.2,legendaria:.25});assert.equal(mine.sets.length,6);
  assert.ok(mine.sets.every(set=>!set.complete&&set.parts.length===5&&set.parts.every(part=>part.left===part.total&&part.serials.length===0)));
  // Las partes no se compran ni salen en la lista de ediciones que se venden.
  assert.equal((await progress('comprar-edicion',luis,{edition:all[0].edition})).data.code,'cofres');
  assert.ok(!(await progress('ediciones',luis)).data.editions.some(edition=>EDITIONS.get(edition.id).set));

  // Abrir cofres en el servidor: las partes que tocan llevan su set, su número de serie y su tirada, y quedan apuntadas.
  const got=[];
  for(const type of ['faraday','tormenta'])for(let n=0;n<FIRST_CHESTS;n++){
    const r=await progress('abrir-cofre',luis,{type});assert.equal(r.status,200);assert.equal(r.data.rewards.length,Chests.count(type));
    for(const reward of r.data.rewards.filter(reward=>reward.part)){
      const edition=EDITIONS.get(reward.part);
      assert.deepEqual([reward.kind,reward.rarity,reward.set,reward.total],['item',edition.rarity,edition.set,edition.total]);
      assert.ok(edition.keys.includes(reward.key)&&reward.serial>=1&&reward.serial<=edition.total);got.push({edition:reward.part,serial:reward.serial});
    }
  }
  assert.ok(got.length>=5,'Con 60 cofres buenos tocan varias partes: '+got.length);
  assert.equal(new Set(got.map(unit=>unit.edition+':'+unit.serial)).size,got.length,'Ningún número de serie repetido');
  const byKey=(a,b)=>a.edition.localeCompare(b.edition)||a.serial-b.serial;
  assert.deepEqual((await unitsFrom(luis)).sort(byKey),got.sort(byKey));
  // Las partes no van al inventario de piezas normales.
  assert.ok(!(await progress('inventario',luis)).data.items.some(one=>one.item.includes('set-')));
  mine=await setsOf(luis);
  for(const part of mine.sets.flatMap(set=>set.parts)){
    const serials=got.filter(unit=>unit.edition===part.edition).map(unit=>unit.serial).sort((a,b)=>a-b);
    assert.deepEqual(part.serials,serials);assert.equal(part.left,part.total-serials.length);
  }

  // Agotada: una parte sin unidades ya no sale; con todas agotadas, los cofres vuelven a ser los de siempre.
  for(const part of all)while(await store.community.editionNext(part.edition,EDITIONS.get(part.edition).total));
  await progress('comprar-cofre',luis,{type:'chispa'});
  assert.ok(!(await progress('abrir-cofre',luis,{type:'chispa'})).data.rewards.some(reward=>reward.part));
  assert.ok((await setsOf(ana)).sets.every(set=>set.parts.every(part=>part.left===0)));

  // El extra por set completo. Ana tiene un set; Eva, ninguno. Mismo reto, misma precisión.
  await give(ana,SETS[0]);
  mine=await setsOf(ana);assert.equal(mine.bonus.rate,.1);assert.deepEqual(mine.sets.map(set=>set.complete),[true,false,false,false,false,false]);
  await play(ana,'2026-11-16');await play(eva,'2026-11-16');
  const base=todayPrize(1,1);
  let before=await coinsOf(eva),r=await progress('premio',eva,{day:'2026-11-16'});
  assert.equal(r.data.amount,base);assert.equal(r.data.bonus,undefined);assert.equal(r.data.coins,before+base);
  before=await coinsOf(ana);r=await progress('premio',ana,{day:'2026-11-16'});
  assert.equal(r.data.amount,base);assert.equal(r.data.bonus,Math.ceil(base*.1));assert.equal(r.data.coins,before+base+Math.ceil(base*.1));
  assert.equal(await coinsOf(ana),r.data.coins);
  // Cobrar otra vez no paga el premio ni el extra.
  r=await progress('premio',ana,{day:'2026-11-16'});assert.equal(r.data.amount,0);assert.equal(r.data.bonus,undefined);assert.equal(r.data.coins,await coinsOf(ana));
  // En el libro es un apunte aparte, con su motivo.
  let moves=(await progress('movimientos',ana)).data.moves;
  assert.deepEqual(moves.filter(move=>move.reason==='sets').map(move=>[move.amount,move.source,move.ref]),[[Math.ceil(base*.1),'servidor','reto:2026-11-16']]);
  // También en los duelos, redondeado hacia arriba.
  before=await coinsOf(ana);r=await progress('premio',ana,{duel:await wonDuel(ana,eva)});
  assert.equal(r.data.amount,DUEL.win);assert.equal(r.data.bonus,Math.ceil(DUEL.win*.1));assert.equal(r.data.coins,before+DUEL.win+Math.ceil(DUEL.win*.1));
  // Tres sets: 30 %. Con cuatro, sigue en 30 %.
  for(const set of SETS.slice(1,4)){
    // Las unidades están agotadas: se le pasan las de un jugador de pega, como en un intercambio.
    for(const part of set.parts)await store.community.addCollectible(part.edition,999,hashOf(ana));
  }
  assert.equal((await setsOf(ana)).bonus.rate,.3);
  before=await coinsOf(ana);r=await progress('premio',ana,{duel:await wonDuel(ana,eva)});
  assert.equal(r.data.bonus,Math.ceil(r.data.amount*.3));assert.equal(r.data.coins,before+r.data.amount+r.data.bonus);
  // El extra no salta el tope diario de ganancias.
  moves=(await progress('movimientos',ana)).data.moves;
  assert.ok(moves.filter(move=>move.day==='2026-11-16'&&CAPPED.includes(move.reason)).reduce((sum,move)=>sum+move.amount,0)<=DAILY_CAP);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),await coinsOf(ana),'El libro sigue sumando el saldo');

  // Las partes se intercambian como cualquier artículo de colección: Luis le pasa una a Eva.
  const [unit]=await unitsFrom(luis);
  const code=(await progress('intercambio-crear',luis,{name:'Luis',avatar:{}})).data.trade.code;
  const trade=(await progress('intercambio-unirse',eva,{code,name:'Eva',avatar:{}})).data.trade;
  r=await progress('intercambio-ofrecer',luis,{id:trade.id,units:[unit]});assert.equal(r.status,200);
  await progress('intercambio-confirmar',luis,{id:trade.id,ok:true,version:r.data.trade.version});
  r=await progress('intercambio-confirmar',eva,{id:trade.id,ok:true,version:r.data.trade.version});
  assert.equal(r.data.trade.status,'hecho');
  assert.deepEqual(await unitsFrom(eva),[unit]);assert.ok(!(await unitsFrom(luis)).some(one=>one.edition===unit.edition&&one.serial===unit.serial));

  console.log('sets: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
