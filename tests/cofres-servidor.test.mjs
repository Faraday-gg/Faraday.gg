// Prueba los cofres que lleva el servidor (lib/cofres.mjs y lib/comunidad.mjs, decisión 0063) a través de la API:
// lo que se acepta la primera vez, cuándo se gana un cofre, la compra, el sorteo y el reparto. Cuenta falsa; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {memoryDuels} from '../lib/duelos.mjs';
import {Chests,chestProblem,CHARGE,FIRST_CHESTS,GIFT_CAP} from '../lib/cofres.mjs';
import {PIECES} from '../lib/catalogo.mjs';
import {REASONS} from '../lib/comunidad.mjs';
import {dailyIds} from '../lib/misiones.mjs';
import {getDay} from '../content-engine.mjs';

// Las reglas son las del navegador.
assert.equal(chestProblem,null);assert.deepEqual(Array.from(Chests.TYPES),['chispa','iman','rayo','dinamo','tormenta','faraday']);
const flat=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8').replace(/\s/g,'');
assert.ok(flat.includes(`charge:{today:${CHARGE.today},archive:${CHARGE.archive},full:${CHARGE.full}}`),'REWARD.charge de progress.js ha cambiado');
assert.ok(fs.readFileSync(new URL('../dist/duel.js',import.meta.url),'utf8').includes(`capped?${CHARGE.duelCapped}:${CHARGE.duel}`),'La batería de los duelos ha cambiado');
assert.ok(JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).functions['api/index.mjs'].includeFiles.includes('dist/chests.js'));
assert.ok(!REASONS.includes('cofres')&&!REASONS.includes('cofres-compra'));assert.deepEqual(REASONS,['bienvenida','referidos','otros']);

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-cofres-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-16'),seed=7;
const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const duels=memoryDuels(),hashOf=player=>createHash('sha256').update(player).digest('hex');
const api=createApi({store:{...fileStore(path.join(directory,'answers.json')),duels},persistDays:false,now:()=>clock,random,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const state=async player=>(await progress('estado',player)).data,coinsOf=async player=>(await progress('leer',player)).data.coins;
const inventory=async player=>(await progress('inventario',player)).data.items;
async function play(player,date,factor=1){for(const question of getDay(date,{persist:false}).questions)assert.equal((await post('answers',{question:question.id,player,guess:question.answer*factor})).status,200)}
async function wonDuel(player,rival){
  const id=randomUUID();
  await duels.create({id,code:id.slice(0,6).toUpperCase(),public:false,status:'finished',createdAt:clock,seenAt:clock,players:[{hash:hashOf(player)},{hash:hashOf(rival)}],questions:['q'],rounds:[{}],winner:0,reason:'ko',next:null});
  return id;
}
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID(),leo=randomUUID();
  const [cheap]=[...PIECES].filter(([,piece])=>!piece.body).map(([key])=>key);

  // La primera vez se parte de lo que declara el navegador, con tope; sus piezas pasan al inventario.
  await progress('guardar',luis,{state:{v:1,xp:43500,look:{body:'hombre'},chests:{chispa:2,rayo:999,inventado:5},charge:30,pity:2,owned:[cheap,'top:no-existe',42]},delta:2000});
  let s=await state(luis);
  assert.deepEqual(s.chests,{chispa:2,iman:0,rayo:FIRST_CHESTS,dinamo:0,tormenta:0,faraday:0});assert.equal(s.charge,30);
  assert.deepEqual(await inventory(luis),[{item:cheap,source:'inicial'}]);

  // Abrir: lo sortea el servidor. Piezas que no tenía y de su cuerpo; los faradios, al saldo; todo apuntado.
  for(const bad of ['no-existe',null,7])assert.equal((await progress('abrir-cofre',luis,{type:bad})).status,400);
  assert.equal((await progress('abrir-cofre',null,{type:'chispa'})).status,401);
  assert.equal((await progress('abrir-cofre',luis,{type:'tormenta'})).data.code,'sin-cofre');
  let before=await coinsOf(luis);
  let r=await progress('abrir-cofre',luis,{type:'chispa'});
  assert.equal(r.status,200);assert.equal(r.data.rewards.length,Chests.count('chispa'));assert.equal(r.data.chests.chispa,1);
  const lots=r.data.rewards.filter(reward=>reward.kind==='coins').reduce((sum,reward)=>sum+reward.amount,0);
  assert.equal(r.data.coins,before+lots);assert.equal(await coinsOf(luis),before+lots);
  for(const reward of r.data.rewards.filter(reward=>reward.kind==='item')){
    const piece=PIECES.get(reward.key);assert.ok(piece&&reward.key!==cheap&&(!piece.body||piece.body==='hombre'));assert.equal(piece.rarity,reward.rarity);
    assert.ok((await inventory(luis)).some(item=>item.item===reward.key&&item.source==='cofre'));
  }
  // Muchos cofres seguidos: nunca sale una pieza repetida ni una que ya tenía.
  const seen=new Set([cheap]);
  for(let n=0;n<FIRST_CHESTS;n++){
    r=await progress('abrir-cofre',luis,{type:'rayo'});assert.equal(r.status,200);assert.equal(r.data.rewards.length,Chests.count('rayo'));
    for(const reward of r.data.rewards.filter(reward=>reward.kind==='item')){assert.ok(!seen.has(reward.key),'Pieza repetida: '+reward.key);seen.add(reward.key)}
  }
  assert.equal((await progress('abrir-cofre',luis,{type:'rayo'})).data.code,'sin-cofre');
  let moves=(await progress('movimientos',luis)).data.moves;
  assert.ok(moves.filter(move=>move.reason==='cofres').every(move=>move.source==='servidor'&&/^cofre-\d+-\d+$/.test(move.ref)&&move.amount>0));

  // Comprar: cobra el precio, da el cofre y tiene tope diario.
  before=await coinsOf(luis);
  r=await progress('comprar-cofre',luis,{type:'chispa'});
  assert.equal(r.data.coins,before-Chests.CHESTS.chispa.price);assert.equal(r.data.chests.chispa,2);
  await progress('comprar-cofre',luis,{type:'chispa'});await progress('comprar-cofre',luis,{type:'chispa'});
  assert.equal((await progress('comprar-cofre',luis,{type:'chispa'})).data.code,'tope');assert.equal(Chests.BUY_CAP,3);
  assert.equal((await state(luis)).chests.chispa,4);
  await progress('guardar',eva,{state:{v:1,xp:43500},delta:10});
  assert.equal((await progress('comprar-cofre',eva,{type:'chispa'})).data.code,'saldo');assert.equal((await state(eva)).chests.chispa,0);

  // Cofres de regalo del Circuito: solo Rayo o Tormenta y con tope diario.
  assert.equal((await progress('regalo-cofre',eva,{type:'faraday'})).status,400);
  for(let n=0;n<GIFT_CAP;n++)assert.equal((await progress('regalo-cofre',eva,{type:'rayo'})).status,200);
  assert.equal((await progress('regalo-cofre',eva,{type:'tormenta'})).data.code,'tope');
  assert.equal((await state(eva)).chests.rayo,GIFT_CAP);

  // Batería: el reto de hoy carga 40; un reto del archivo, 10; un duelo, 20. Al llegar a 100, un cofre Chispa.
  await progress('guardar',ana,{state:{v:1,xp:43500,charge:30},delta:0});
  await play(ana,'2026-11-16');await progress('premio',ana,{day:'2026-11-16'});
  s=await state(ana);assert.equal(s.charge,70);assert.equal(s.streak,1);
  await play(ana,'2026-11-13');await progress('premio',ana,{day:'2026-11-13'});
  assert.equal((await state(ana)).charge,80);
  await progress('premio',ana,{duel:await wonDuel(ana,eva)});
  s=await state(ana);assert.equal(s.charge,0);assert.equal(s.chests.chispa,1,'Batería llena: cofre Chispa');
  await progress('premio',ana,{day:'2026-11-16'});assert.equal((await state(ana)).charge,0,'Cobrar otra vez no carga más');

  // Las tres misiones del día dan un cofre Chispa. Con lo jugado están todas las posibles completas.
  const ids=dailyIds('2026-11-16');
  assert.equal((await progress('mision',ana,{id:ids[0]})).data.chest,undefined);
  assert.equal((await progress('mision',ana,{id:ids[1]})).data.chest,undefined);
  r=await progress('mision',ana,{id:ids[2]});assert.equal(r.data.chest,'chispa');
  assert.equal((await state(ana)).chests.chispa,2);

  // Racha: al tercer día seguido, un cofre Imán.
  clock=at('2026-11-17');await play(ana,'2026-11-17');await progress('premio',ana,{day:'2026-11-17'});
  s=await state(ana);assert.equal(s.streak,2);assert.equal(s.chests.iman,0);
  clock=at('2026-11-18');await play(ana,'2026-11-18');await progress('premio',ana,{day:'2026-11-18'});
  s=await state(ana);assert.equal(s.streak,3);assert.equal(s.chests.iman,1);
  // Un día sin jugar la corta.
  clock=at('2026-11-20');await play(ana,'2026-11-20');await progress('premio',ana,{day:'2026-11-20'});
  assert.equal((await state(ana)).streak,1);

  // Subir de nivel da su cofre: del 1 al 2, un Chispa.
  await progress('guardar',leo,{state:{v:1,xp:95},delta:0});
  assert.equal((await state(leo)).chests.chispa,0);
  await post('answers',{question:getDay('2026-11-20',{persist:false}).questions[0].id,player:leo,guess:5});
  s=await state(leo);assert.equal(s.level,2);assert.equal(s.chests.chispa,1);

  // El libro sigue sumando el saldo.
  for(const player of [luis,ana,eva,leo]){moves=(await progress('movimientos',player)).data.moves;if(moves.length<50)assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),await coinsOf(player))}

  console.log('cofres-servidor: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
