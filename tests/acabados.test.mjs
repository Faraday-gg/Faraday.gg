// Prueba los acabados (decisión 0072): versiones cromada, holográfica y dorada de piezas que ya existen, que solo salen
// en cofres. El catálogo, el sorteo y la apertura de un cofre a través de la API, con una cuenta falsa; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {PIECES} from '../lib/catalogo.mjs';
import {Chests} from '../lib/cofres.mjs';

const page={};page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/avatar.js',import.meta.url),'utf8'),page);
const {Avatar}=page,finishes=Object.keys(Avatar.FINISHES);

// Los mismos acabados y los mismos huecos en el catálogo y en el sorteo.
assert.deepEqual(finishes,Object.keys(Chests.FINISH_ODDS));assert.deepEqual(Array.from(Avatar.FINISH_SLOTS),Array.from(Chests.FINISH_SLOTS));
const total=Object.values(Chests.FINISH_ODDS).reduce((sum,chance)=>sum+chance,0);
assert.ok(total>0&&total<.1,'Los acabados son raros');
assert.ok(Chests.FINISH_ODDS.cr>Chests.FINISH_ODDS.ho&&Chests.FINISH_ODDS.ho>Chests.FINISH_ODDS.or,'De más a menos frecuente: cromado, holográfico, dorado');

// Una pieza con acabado sale de la normal: mismo dibujo, con el acabado apuntado, y no está en el catálogo.
const gold=Avatar.find('top','sud-gris--or'),base=Avatar.find('top','sud-gris');
assert.ok(gold&&base&&gold!==base);assert.equal(gold.finish,'or');assert.equal(gold.base,'sud-gris');assert.equal(gold.name,'Sudadera gris · dorado');
assert.equal(Avatar.find('top','sud-gris--or'),gold,'Siempre es el mismo objeto');
assert.ok(!Array.from(Avatar.CATALOG).includes(gold));assert.equal(PIECES.has('top:sud-gris--or'),false,'No se compra ni se recicla');
assert.equal(Avatar.rarity(gold),Avatar.rarity(base));
assert.equal(Avatar.resolve({top:'sud-gris--or'}).topFinish,'or');assert.equal(Avatar.resolve({top:'sud-gris'}).topFinish,undefined);
assert.equal(Avatar.normalize({top:'sud-gris--or'}).top,'sud-gris--or');
assert.equal(Avatar.normalize({body:'mujer',top:'sud-gris--or'}).top,Avatar.defaults('mujer').top,'La del otro cuerpo no vale');
// Sin acabado: lo gratis, lo que se gana, las ediciones, los demás huecos y lo que no existe.
for(const [slot,id] of [['top','cam-blanca--or'],['top','ed-voltio--or'],['hairColor','azul--or'],['top','sud-gris--xx'],['top','no-existe--or'],['top','--or'],['top','sud-gris--or--cr']])assert.equal(Avatar.find(slot,id),undefined,`${slot}:${id}`);
assert.equal(Avatar.finishable(Avatar.CATALOG.find(item=>item.level)),false);
// Todas caben en lo que aceptan el inventario y los avatares que viajan a duelos y ligas.
const able=Array.from(Avatar.CATALOG).filter(Avatar.finishable);assert.ok(able.length>100);
for(const item of able)for(const finish of finishes){
  const id=item.id+'--'+finish;assert.ok(Avatar.find(item.slot,id));
  assert.match(item.slot+':'+id,/^[a-zA-Z]{1,16}:[a-z0-9-]{1,40}$/);assert.match(id,/^[a-z0-9-]{1,28}$/);
}
for(const file of ['comunidad','duelos','ligas','referidos'])assert.ok(fs.readFileSync(new URL(`../lib/${file}.mjs`,import.meta.url),'utf8').includes('/^[a-z0-9-]{1,28}$/.test(piece)'),`lib/${file}.mjs acepta piezas con acabado`);

// El sorteo: solo en los huecos con acabado y con las probabilidades de la tabla.
assert.equal(Chests.finishOf('top:sud-gris',()=>0),'cr');assert.equal(Chests.finishOf('top:sud-gris',()=>.035),'ho');
assert.equal(Chests.finishOf('top:sud-gris',()=>.0415),'or');assert.equal(Chests.finishOf('top:sud-gris',()=>.05),'');
assert.equal(Chests.finishOf('hairColor:azul',()=>0),'');assert.equal(Chests.finishOf('glasses:x',()=>0),'');
let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
let hits=0;const tries=200000;for(let i=0;i<tries;i++)if(Chests.finishOf('shoes:x',random))hits++;
assert.ok(Math.abs(hits/tries-total)<.003,`Sale ${hits/tries}, se esperaba ${total}`);
// Dentro de un cofre: el acabado va apuntado en el premio y no cambia qué piezas salen.
const items=()=>[{key:'top:a',rarity:'comun'},{key:'hairColor:b',rarity:'comun'},{key:'shoes:c',rarity:'comun'},{key:'top:d',rarity:'especial'}];
const lucky=Chests.roll('iman',{items:items(),random:()=>0}),unlucky=Chests.roll('iman',{items:items(),random:()=>.999});
assert.deepEqual(Array.from(lucky.rewards).map(reward=>[reward.key,reward.finish]),[['top:a','cr'],['hairColor:b',undefined],['shoes:c','cr']]);
assert.ok(Array.from(unlucky.rewards).every(reward=>!reward.finish));

// A través de la API: el cofre da la pieza y, además, su versión con acabado.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-acabados-'));
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const api=createApi({playedDays:async()=>200,store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>Date.parse('2026-11-16T09:00:00Z'),random:()=>0,auth,log:()=>{}});
async function post(body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
try{
  const luis=randomUUID(),hair=[...PIECES.keys()].filter(key=>key.startsWith('hairColor:'));
  // Llega con todos los colores de pelo (no llevan acabado) y un cofre Imán, que solo trae piezas.
  await post({action:'guardar',state:{v:1,look:{body:'hombre'},owned:hair,chests:{iman:1}},delta:0},luis);
  const r=await post({action:'abrir-cofre',type:'iman'},luis);
  assert.equal(r.status,200);assert.equal(r.data.rewards.length,3);
  const owned=(await post({action:'inventario'},luis)).data.items;
  for(const reward of r.data.rewards){
    assert.equal(reward.kind,'item');assert.ok(Chests.FINISH_SLOTS.includes(reward.key.split(':')[0]),'Sale ropa: '+reward.key);
    assert.equal(reward.finish,'cr');
    for(const key of [reward.key,reward.key+'--cr'])assert.ok(owned.some(one=>one.item===key&&one.source==='cofre'),'Falta '+key);
  }
  assert.equal(owned.length,hair.length+6);
  // La versión con acabado no se recicla ni se funde ni se compra: solo la normal.
  const [first]=r.data.rewards;
  assert.equal((await post({action:'reciclar',items:[first.key+'--cr']},luis)).status,400);
  assert.equal((await post({action:'comprar',item:first.key+'--cr'},luis)).status,400);
  assert.equal((await post({action:'reciclar',items:[first.key]},luis)).status,200);
  assert.ok((await post({action:'inventario'},luis)).data.items.some(one=>one.item===first.key+'--cr'),'Reciclar la normal no quita la del acabado');

  console.log('acabados: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
