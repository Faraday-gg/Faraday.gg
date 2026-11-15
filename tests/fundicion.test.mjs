// Prueba la fundición (decisión 0071): reciclar piezas por una parte de su precio y fundir cinco de una rareza para
// conseguir una de la siguiente. A través de la API, con una cuenta falsa; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {PIECES,FOUNDRY,RARITY_ORDER,recycleValue} from '../lib/catalogo.mjs';
import {Chests} from '../lib/cofres.mjs';

// Las cifras y el orden de las rarezas son los del navegador.
assert.deepEqual(RARITY_ORDER,Array.from(Chests.RARITIES));
assert.ok(fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8').includes(`foundry:{need:${FOUNDRY.need},back:${String(FOUNDRY.back).replace(/^0/,'')},max:${FOUNDRY.max}}`),'dist/progress.js y el servidor usan las mismas cifras');
assert.equal(recycleValue(100),20);assert.equal(recycleValue(1400),280);

// Piezas del cuerpo «hombre» (y las que valen para los dos), por rareza y de más barata a más cara.
const of=rarity=>[...PIECES].filter(([,piece])=>piece.rarity===rarity&&piece.body!=='mujer').sort((a,b)=>a[1].price-b[1].price).map(([key])=>key);
const commons=of('comun'),specials=of('especial'),rares=of('rara'),legendary=of('legendaria');
assert.ok(commons.length>=8&&specials.length>=2&&rares.length>=1);

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-fundicion-'));
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const api=createApi({playedDays:async()=>200,store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>Date.parse('2026-11-16T09:00:00Z'),random:()=>0,auth,log:()=>{}});
async function post(body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const coinsOf=async player=>(await post({action:'leer'},player)).data.coins;
const items=async player=>(await post({action:'inventario'},player)).data.items;
const keysOf=async player=>(await items(player)).map(one=>one.item);
const recycle=(player,list)=>post({action:'reciclar',items:list},player),smelt=(player,list)=>post({action:'fundir',items:list},player);
try{
  const luis=randomUUID(),eva=randomUUID();
  // Luis llega con ocho comunes y una rara; Eva, con cinco comunes y todas las especiales.
  await post({action:'guardar',state:{v:1,look:{body:'hombre'},owned:[...commons.slice(0,8),rares[0]]},delta:50},luis);
  await post({action:'guardar',state:{v:1,look:{body:'hombre'},owned:[...commons.slice(0,5),...specials]},delta:0},eva);
  // Las piezas que traía pasan al inventario la primera vez que el servidor mira su progreso.
  for(const player of [luis,eva])await post({action:'estado'},player);
  assert.equal((await keysOf(luis)).length,9);

  // Reciclar: con cuenta, solo piezas del catálogo de pago que se tengan, sin repetir.
  assert.equal((await recycle(null,[commons[0]])).status,401);
  for(const bad of [[],null,'top',[commons[0],commons[0]],['top:no-existe'],[42],['hat:corona'],Array.from({length:FOUNDRY.max+1},(_,i)=>'top:'+i)])assert.equal((await recycle(luis,bad)).status,400);
  assert.equal((await recycle(luis,[commons[0],specials[0]])).data.code,'sin-pieza','Una de las dos no es suya');
  assert.equal((await keysOf(luis)).length,9,'Si falla, no se pierde nada');
  // Devuelve el 20 % del precio de cada una, apuntado por el servidor, y las piezas salen del inventario.
  const gone=[commons[6],commons[7],rares[0]],back=gone.reduce((sum,key)=>sum+recycleValue(PIECES.get(key).price),0);
  let r=await recycle(luis,gone);
  assert.deepEqual(r.data,{coins:50+back,amount:back,items:gone});assert.equal(await coinsOf(luis),50+back);
  assert.ok(back>0&&back<gone.reduce((sum,key)=>sum+PIECES.get(key).price,0)/4);
  assert.deepEqual(await keysOf(luis),commons.slice(0,6));
  const [move]=(await post({action:'movimientos'},luis)).data.moves;
  assert.deepEqual([move.reason,move.amount,move.source],['reciclaje',back,'servidor']);
  assert.equal((await recycle(luis,gone)).data.code,'sin-pieza','No se recicla dos veces');assert.equal(await coinsOf(luis),50+back);

  // Fundir: cinco justas, de la misma rareza, y no de la más alta.
  assert.equal((await smelt(null,commons.slice(0,5))).status,401);
  assert.equal((await smelt(luis,commons.slice(0,4))).data.code,'rareza');
  assert.equal((await smelt(luis,commons.slice(0,6))).data.code,'rareza');
  if(legendary.length>=5)assert.equal((await smelt(luis,legendary.slice(0,5))).data.code,'rareza','La legendaria no se funde');
  assert.equal((await smelt(luis,[...commons.slice(0,4),commons[7]])).data.code,'sin-pieza');
  assert.equal((await keysOf(luis)).length,6);
  // Da una pieza de la rareza siguiente que no tenía; las cinco se pierden y el saldo no cambia.
  const before=await coinsOf(luis),had=await keysOf(luis);
  r=await smelt(luis,commons.slice(0,5));
  assert.equal(r.status,200);assert.equal(r.data.rarity,'especial');assert.deepEqual(r.data.items,commons.slice(0,5));
  const got=PIECES.get(r.data.item);assert.ok(got&&got.rarity==='especial'&&got.body!=='mujer'&&!had.includes(r.data.item));
  assert.deepEqual(await items(luis),[{item:commons[5],source:'inicial'},{item:r.data.item,source:'fundicion'}]);
  assert.equal(await coinsOf(luis),before);
  assert.equal((await smelt(luis,commons.slice(0,5))).data.code,'sin-pieza');

  // Si ya se tienen todas las de la rareza siguiente, no se funde ni se pierde nada.
  assert.equal((await smelt(eva,commons.slice(0,5))).data.code,'completa');
  assert.equal((await keysOf(eva)).length,5+specials.length);
  // Reciclando una especial vuelve a haber hueco, y la fundición la devuelve.
  await recycle(eva,[specials[1]]);r=await smelt(eva,commons.slice(0,5));
  assert.equal(r.data.item,specials[1]);

  // El libro cuadra con el saldo.
  for(const player of [luis,eva])assert.equal((await post({action:'movimientos'},player)).data.moves.reduce((sum,one)=>sum+one.amount,0),await coinsOf(player));

  // Contra Supabase, quitar piezas es un DELETE que devuelve las filas quitadas.
  const calls=[],fake=async(url,init={})=>{calls.push({url:new URL(url),method:init.method||'GET',prefer:init.headers?.Prefer});return Response.json([{item:'top:a'}])};
  const remote=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:fake});
  assert.deepEqual(await remote.community.removeItems('a'.repeat(64),['top:a','hat:b']),['top:a']);
  const sent=calls.at(-1);
  assert.deepEqual([sent.method,sent.url.pathname,sent.prefer],['DELETE','/rest/v1/items','return=representation']);
  assert.equal(sent.url.searchParams.get('player_hash'),'eq.'+'a'.repeat(64));assert.equal(sent.url.searchParams.get('item'),'in.("top:a","hat:b")');

  console.log('fundicion: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
