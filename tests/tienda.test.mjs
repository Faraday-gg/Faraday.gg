// Prueba la tienda y las pistas cobradas por el servidor (lib/catalogo.mjs y lib/comunidad.mjs, decisión 0062), a través
// de la API, con una cuenta falsa. No usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {PIECES,HINT_COST,catalogProblem} from '../lib/catalogo.mjs';
import {REASONS} from '../lib/comunidad.mjs';

// El catálogo del servidor es el del navegador: mismas piezas de pago y mismos precios.
assert.equal(catalogProblem,null);
{
  const page={};page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/avatar.js',import.meta.url),'utf8'),page);
  const paid=page.Avatar.CATALOG.filter(item=>item.price>0&&!item.level&&!item.casi&&!item.circuito);
  assert.equal(PIECES.size,paid.length);assert.ok(PIECES.size>300);
  for(const item of paid)assert.equal(PIECES.get(item.slot+':'+item.id).price,item.price);
  for(const item of page.Avatar.CATALOG.filter(item=>item.level||item.casi||item.circuito||!item.price))assert.equal(PIECES.has(item.slot+':'+item.id),false,'Lo que se gana o es gratis no se vende');
}
assert.ok(fs.readFileSync(new URL('../dist/pistas.js',import.meta.url),'utf8').includes(`COST=${HINT_COST}`));
assert.ok(JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).functions['api/index.mjs'].includeFiles.includes('dist/avatar.js'),'En Vercel la función necesita dist/avatar.js');
assert.ok(!REASONS.includes('tienda')&&!REASONS.includes('pistas'));

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-tienda-'));
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const api=createApi({playedDays:async()=>200,store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>Date.parse('2026-11-16T09:00:00Z'),auth,log:()=>{}});
async function post(body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
try{
  const luis=randomUUID(),ana=randomUUID();
  const [cheap,price]=[...PIECES].map(([key,piece])=>[key,piece.price]).sort((a,b)=>a[1]-b[1])[0];
  const [dear,dearPrice]=[...PIECES].map(([key,piece])=>[key,piece.price]).sort((a,b)=>b[1]-a[1])[0];
  await post({action:'guardar',state:{v:1},delta:price+HINT_COST+10},luis);
  const buy=(player,item)=>post({action:'comprar',item},player),coinsOf=async player=>(await post({action:'leer'},player)).data.coins;

  // Comprar: cobra el precio del catálogo, apunta la pieza y no deja comprarla dos veces.
  assert.equal((await buy(null,cheap)).status,401);
  for(const bad of ['top:no-existe','x',null,42,'hat:corona'])assert.equal((await buy(luis,bad)).status,400,'Solo piezas de pago del catálogo: '+bad);
  assert.equal((await buy(luis,dear)).data.code,'saldo');assert.ok(dearPrice>price+HINT_COST+10);
  let r=await buy(luis,cheap);
  assert.deepEqual(r.data,{coins:HINT_COST+10,item:cheap,price});
  assert.equal((await buy(luis,cheap)).data.code,'tienes');
  assert.deepEqual((await post({action:'inventario'},luis)).data.items,[{item:cheap,source:'tienda'}]);
  assert.deepEqual((await post({action:'inventario'},ana)).data.items,[],'El inventario es de cada jugador');
  assert.equal(await coinsOf(luis),HINT_COST+10,'El navegador no decide el precio: lo pone el servidor');

  // Pista: 100 ≈, una vez por pregunta.
  assert.equal((await post({action:'pista',question:'piloto-v2-1'},null)).status,401);
  assert.equal((await post({action:'pista',question:'no vale'},luis)).status,400);
  r=await post({action:'pista',question:'piloto-v2-1'},luis);assert.deepEqual(r.data,{coins:10});
  assert.deepEqual((await post({action:'pista',question:'piloto-v2-1'},luis)).data,{coins:10},'La misma pista no se cobra dos veces');
  assert.equal((await post({action:'pista',question:'piloto-v2-2'},luis)).data.code,'saldo');

  // El libro lo cuenta todo y suma el saldo.
  const moves=(await post({action:'movimientos'},luis)).data.moves;
  assert.deepEqual(moves.slice(0,2).map(move=>[move.reason,move.amount,move.source,move.ref]),[['pistas',-HINT_COST,'servidor','piloto-v2-1'],['tienda',-price,'servidor',cheap]]);
  assert.equal(moves.reduce((sum,move)=>sum+move.amount,0),10);

  console.log('tienda: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
