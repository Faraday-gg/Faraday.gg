// Prueba las ediciones de colección (decisión 0067): piezas de tirada cerrada y numerada que se compran con faradios,
// una por cuenta y desde un nivel. A través de la API, con una cuenta falsa; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {PIECES,EDITIONS} from '../lib/catalogo.mjs';

// El catálogo: cada edición tiene una pieza por cuerpo, con el precio en la edición y no en la pieza, así que ni se
// vende en la tienda normal ni sale en los cofres.
const page={};page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/avatar.js',import.meta.url),'utf8'),page);
// (Array.from: las listas que salen de dist/ son de otro contexto y deepEqual las vería distintas.)
const {Avatar}=page,entries=Array.from(Avatar.CATALOG).filter(item=>item.edition);
assert.ok(EDITIONS.size>=2);assert.equal(entries.length,2*EDITIONS.size);
for(const edition of EDITIONS.values()){
  const own=entries.filter(item=>item.edition.id===edition.id);
  assert.deepEqual(own.map(item=>item.for).sort(),['hombre','mujer'],`La edición ${edition.id} tiene una pieza por cuerpo`);
  assert.deepEqual(edition.keys.sort(),own.map(item=>item.slot+':'+item.id).sort());
  assert.ok(edition.total>0&&edition.price>0&&edition.level>=1&&/^\d{4}-\d{2}-\d{2}$/.test(edition.from)&&Number.isInteger(edition.n));
  for(const item of own){assert.equal(item.price,0);assert.equal(PIECES.has(item.slot+':'+item.id),false);assert.equal(Avatar.rarity(item),'nivel')}
}
assert.equal(new Set([...EDITIONS.values()].map(edition=>edition.n)).size,EDITIONS.size,'Cada edición tiene su número');
assert.ok(!Avatar.CATALOG.filter(item=>item.price>0&&!item.level).some(item=>item.edition),'Las ediciones no salen en cofres');

const [first,second]=[...EDITIONS.values()].sort((a,b)=>a.from<b.from?-1:1);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-ediciones-'));
let clock=Date.parse(first.from+'T09:00:00Z');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const store=fileStore(path.join(directory,'answers.json')),hashOf=player=>createHash('sha256').update(player).digest('hex');
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const buy=(player,edition)=>post({action:'comprar-edicion',edition},player),coinsOf=async player=>(await post({action:'leer'},player)).data.coins;
const list=async player=>(await post({action:'ediciones'},player)).data.editions;
try{
  const luis=randomUUID(),ana=randomUUID(),novato=randomUUID(),pobre=randomUUID();
  await post({action:'guardar',state:{v:1,xp:4500},delta:5000},luis);
  await post({action:'guardar',state:{v:1,xp:9000},delta:first.price},ana);
  await post({action:'guardar',state:{v:1,xp:4499},delta:5000},novato);
  await post({action:'guardar',state:{v:1,xp:4500},delta:first.price-1},pobre);

  // La lista: solo las que ya han salido, con lo que queda.
  assert.equal((await post({action:'ediciones'},null)).status,401);
  let editions=await list(luis);
  assert.deepEqual(editions.map(one=>one.id),[first.id]);
  assert.deepEqual({...editions[0],name:undefined},{id:first.id,n:first.n,name:undefined,price:first.price,level:first.level,total:first.total,from:first.from,minted:0,left:first.total,serials:[]});

  // Comprar: con cuenta, desde el nivel de la edición y con saldo.
  assert.equal((await buy(null,first.id)).status,401);
  assert.equal((await buy(luis,'no-existe')).status,400);
  assert.equal((await buy(luis,second.id)).data.code,'cerrada','La segunda aún no ha salido');
  assert.equal((await buy(novato,first.id)).data.code,'nivel');
  assert.equal((await buy(pobre,first.id)).data.code,'saldo');
  let r=await buy(luis,first.id);
  assert.deepEqual(r.data,{coins:5000-first.price,edition:first.id,serial:1,total:first.total});
  // Una por cuenta; la siguiente cuenta recibe el número siguiente.
  assert.equal((await buy(luis,first.id)).data.code,'comprada');assert.equal(await coinsOf(luis),5000-first.price);
  r=await buy(ana,first.id);assert.equal(r.data.serial,2);assert.equal(r.data.coins,0);
  // Quien no pudo comprar no ha gastado nada ni ha consumido número.
  assert.equal(await coinsOf(pobre),first.price-1);assert.equal(await coinsOf(novato),5000);

  editions=await list(luis);assert.deepEqual([editions[0].minted,editions[0].left,editions[0].serials],[2,first.total-2,[1]]);
  assert.deepEqual((await post({action:'inventario'},luis)).data.collectibles,[{edition:first.id,serial:1}]);
  assert.deepEqual((await post({action:'inventario'},ana)).data.collectibles,[{edition:first.id,serial:2}]);
  assert.deepEqual((await post({action:'inventario'},pobre)).data.collectibles,[]);
  const moves=(await post({action:'movimientos'},luis)).data.moves;
  assert.deepEqual([moves[0].reason,moves[0].amount,moves[0].source,moves[0].ref],['edicion',-first.price,'servidor',first.id]);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),await coinsOf(luis));

  // Agotada: cuando ya no quedan unidades no se vende ni se cobra.
  const rica=randomUUID();await post({action:'guardar',state:{v:1,xp:4500},delta:5000},rica);
  while(await store.community.editionNext(first.id,first.total));
  r=await buy(rica,first.id);assert.equal(r.data.code,'agotada');assert.equal(await coinsOf(rica),5000);
  assert.equal((await list(rica))[0].left,0);

  // El día que sale la segunda, ya se puede comprar, y empieza por el número 1.
  clock=Date.parse(second.from+'T09:00:00Z');
  assert.deepEqual((await list(rica)).map(one=>one.id).sort(),[first.id,second.id].sort());
  r=await buy(rica,second.id);assert.equal(r.data.serial,1);assert.equal(r.data.coins,5000-second.price);

  console.log('ediciones: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
