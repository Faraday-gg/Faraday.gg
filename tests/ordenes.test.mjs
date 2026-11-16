// Prueba las órdenes de compra, «vender ya» y la lista de deseos del mercado (decisión 0078). A través de la API, con
// cuentas falsas; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {EDITIONS} from '../lib/catalogo.mjs';
import {MARKET,marketStats} from '../lib/mercado.mjs';

assert.deepEqual([MARKET.orders,MARKET.book],[5,6]);
// Los indicadores de las órdenes: la más alta, cuántas hay y los niveles de precio, de más a menos.
{
  const stats=marketStats({editions:[{id:'a',n:1,name:'A',total:500},{id:'b',n:2,name:'B',total:100}],open:[],sales:[],now:0,wishes:{a:3},
    orders:[{edition:'a',price:900},{edition:'a',price:1000},{edition:'a',price:900},{edition:'a',price:700},{edition:'b',price:50}]});
  assert.deepEqual([stats.editions[0].topOrder,stats.editions[0].orders,stats.editions[0].book,stats.editions[0].wishes],[1000,4,[{price:1000,count:1},{price:900,count:2},{price:700,count:1}],3]);
  assert.deepEqual([stats.editions[1].topOrder,stats.editions[1].orders,stats.editions[1].wishes,stats.global.orders],[50,1,0,5]);
  const none=marketStats({editions:[{id:'a',n:1,name:'A',total:500}],open:[],sales:[],now:0}).editions[0];
  assert.deepEqual([none.topOrder,none.orders,none.book,none.wishes],[null,0,[],0]);
}

// La migración: tablas y funciones sin permisos públicos, y la venta por orden cabe en el historial.
const file=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(name=>name.endsWith('_ordenes_y_deseos.sql'));
const sql=fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'),FUNCTIONS=['market_order','market_order_cancel','market_sell_now','wishlist_counts'];
for(const name of FUNCTIONS){assert.ok(sql.includes(`create function public.${name}(`),name);assert.ok(sql.includes(`revoke execute on function public.${name}(`),name)}
assert.equal(sql.match(/set search_path = ''/g).length,FUNCTIONS.length);
for(const table of ['buy_orders','wishlist'])assert.ok(sql.includes(`alter table public.${table} enable row level security`));
assert.ok(sql.includes("check (sold_by in ('compra', 'puja', 'orden'))"));

const [first,second]=[...EDITIONS.values()].sort((a,b)=>a.from<b.from?-1:1);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-ordenes-'));
let clock=Date.parse(first.from+'T09:00:00Z');
const auth={async current(request,read){const value=read(request,'faraday_sesion');if(!value)return null;const [flag,id]=value.includes(':')?value.split(':'):['',value];return {account:{id:'u-'+id,email:flag?'':'x@y.z',player:id},cookies:[]}}};
const store=fileStore(path.join(directory,'answers.json')),hashOf=player=>createHash('sha256').update(player).digest('hex');
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(body,session){
  const headers={'Content-Type':'application/json'};if(session)headers.cookie='faraday_sesion='+session;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const coinsOf=async player=>(await post({action:'leer'},player)).data.coins,board=async player=>(await post({action:'mercado'},player)).data;
const units=async player=>(await post({action:'inventario'},player)).data.collectibles,moves=async player=>(await post({action:'movimientos'},player)).data.moves;
const lastMove=async player=>{const [one]=await moves(player);return [one.reason,one.amount,one.ref]};
const order=(player,price,edition=first.id)=>post({action:'ordenar',edition,price},player),cancel=(player,id)=>post({action:'cancelar-orden',order:id},player);
const sellNow=(player,serial,edition=first.id)=>post({action:'vender-ya',edition,serial},player),wish=(player,edition,on)=>post({action:'desear',edition,on},player);
const stat=async player=>(await board(player)).stats.editions[0];
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID(),novato=randomUUID(),everyone=[luis,ana,eva,novato];
  // Luis y Ana tienen nivel 10 y la edición (números 1 y 2). Eva tiene nivel 10 y saldo. El novato tiene saldo y una unidad (la 3), pero nivel 9.
  for(const [player,xp,coins] of [[luis,4500,first.price],[ana,4500,first.price],[eva,4500,5000],[novato,3600,3000]])await post({action:'guardar',state:{v:1,xp},delta:coins},player);
  for(const player of [luis,ana])assert.equal((await post({action:'comprar-edicion',edition:first.id},player)).status,200);
  await store.community.addCollectible(first.id,3,hashOf(novato));
  const total=async()=>(await Promise.all(everyone.map(coinsOf))).reduce((sum,coins)=>sum+coins,0);

  // El tablón sin órdenes.
  let b=await board(eva);assert.deepEqual([b.orders,b.wishes,b.sellNow,b.rules.orders,b.stats.global.orders],[[],[],{[first.id]:null},5,0]);

  // Poner una orden: con cuenta, de un artículo que existe y a un precio válido. Los faradios quedan retenidos.
  assert.equal((await order(null,1000)).status,401);
  for(const [price,edition] of [[1000,'no-existe'],[1000,second.id]])assert.equal((await order(eva,price,edition)).status,400,'Ese artículo no existe o no ha salido');
  for(const price of [0,-1,1.5,'1000',null,MARKET.maxPrice+1])assert.equal((await order(eva,price)).data.code,'precio');
  assert.equal((await order(eva,5001)).status,402);assert.equal(await coinsOf(eva),5000);
  let r=await order(eva,1000);assert.deepEqual(r.data,{coins:4000,order:1,edition:first.id,price:1000});
  assert.deepEqual(await lastMove(eva),['mercado-orden',-1000,'1']);
  await order(eva,800);await order(novato,1000);await order(novato,1200);
  // Lo que ve cada uno: sus órdenes, los niveles de precio y la orden más alta que no es suya.
  b=await board(eva);assert.deepEqual(b.orders.map(one=>[one.id,one.price]),[[1,1000],[2,800]]);
  assert.deepEqual([b.stats.editions[0].topOrder,b.stats.editions[0].orders,b.stats.editions[0].book,b.stats.global.orders],[1200,4,[{price:1200,count:1},{price:1000,count:2},{price:800,count:1}],4]);
  assert.equal(b.sellNow[first.id],1200);assert.equal((await board(novato)).sellNow[first.id],1000,'La suya no cuenta');assert.equal((await board(luis)).sellNow[first.id],1200);

  // Vender ya: con correo comprobado, nivel 10 y una unidad propia sin anunciar. Va a la orden más alta.
  assert.equal((await sellNow(null,1)).status,401);for(const [serial,edition] of [[0,first.id],[1,'no-existe'],['1',first.id]])assert.equal((await sellNow(luis,serial,edition)).status,400);
  assert.equal((await sellNow('sin-correo:'+luis,1)).data.code,'cuenta');assert.equal((await sellNow(novato,3)).data.code,'nivel');
  assert.equal((await sellNow(luis,2)).data.code,'no-tuya');
  let before=await total();r=await sellNow(luis,1);
  assert.deepEqual(r.data,{coins:1080,edition:first.id,serial:1,price:1200,fee:120});
  assert.equal(await total(),before+1080,'Lo retenido pasa al vendedor, menos la comisión');assert.deepEqual(await lastMove(luis),['mercado-venta',1080,'orden-4']);
  assert.deepEqual(await units(luis),[]);assert.deepEqual(await units(novato),[{edition:first.id,serial:1},{edition:first.id,serial:3}]);
  // Queda como una venta más, y quien puso la orden recibe el aviso una vez.
  b=await board(novato);assert.deepEqual(b.notices.won,[{id:1,edition:first.id,serial:1,price:1200,fee:120,by:'orden'}]);assert.deepEqual((await board(novato)).notices.won,[]);
  assert.deepEqual(b.sales[0],{edition:first.id,serial:1,price:1200,by:'orden',at:clock});assert.deepEqual([b.stats.editions[0].last,b.stats.editions[0].orders,b.stats.editions[0].topOrder],[1200,3,1000]);
  assert.deepEqual(b.orders.map(one=>one.price),[1000]);
  // A igual precio, se cumple la orden más antigua (la de Eva, no la del novato).
  r=await sellNow(ana,2);assert.equal(r.data.price,1000);assert.deepEqual(await units(eva),[{edition:first.id,serial:2}]);
  assert.deepEqual((await board(eva)).orders.map(one=>one.id),[2]);
  // Lo anunciado no se vende ya; y sin órdenes de otros, tampoco.
  assert.equal((await order(ana,850)).data.order,5);
  assert.equal((await post({action:'vender',edition:first.id,serial:2,buyNow:3000},eva)).status,200);assert.equal((await sellNow(eva,2)).data.code,'anunciada');
  await post({action:'retirar',listing:(await board(eva)).mine[0].id},eva);
  assert.equal((await sellNow(eva,2)).data.price,1000,'Vende a la del novato (1.000), no a la suya (800) ni a la de Ana (850)');
  await cancel(ana,5);assert.equal((await board(eva)).sellNow[first.id],null,'Solo queda su propia orden');

  // Cancelar: solo la propia y abierta; devuelve los faradios.
  assert.equal((await cancel(ana,2)).data.code,'cerrado');for(const bad of [0,'2',null])assert.equal((await cancel(eva,bad)).status,400);
  before=await coinsOf(eva);r=await cancel(eva,2);assert.deepEqual(r.data,{coins:before+800,order:2});assert.deepEqual(await lastMove(eva),['mercado-orden-devuelta',800,'2']);
  assert.equal((await cancel(eva,2)).data.code,'cerrado');assert.equal((await cancel(novato,4)).data.code,'cerrado','Una orden cumplida no se cancela');

  // Una orden por encima de un anuncio compra al momento, al precio del anuncio más barato, y no deja orden.
  assert.equal((await post({action:'vender',edition:first.id,serial:1,buyNow:700},novato)).data.code,'nivel');
  await store.community.marketList(hashOf(novato),first.id,1,{buyNow:700},null,clock);await store.community.marketList(hashOf(novato),first.id,3,{buyNow:650},null,clock);
  before=await coinsOf(eva);r=await order(eva,900);
  assert.deepEqual(r.data,{coins:before-650,bought:true,edition:first.id,serial:3,price:650,total:first.total});assert.deepEqual((await board(eva)).orders,[]);
  // El dueño del anuncio no se compra a sí mismo: su orden queda abierta.
  r=await order(novato,900);assert.equal(r.data.order,6);await cancel(novato,6);

  // Como mucho cinco órdenes abiertas.
  for(let n=0;n<MARKET.orders;n++)assert.equal((await order(eva,10+n)).status,200);
  assert.equal((await order(eva,10)).data.code,'tope');assert.equal((await board(eva)).orders.length,5);

  // Lista de deseos: marcar y desmarcar, y en cuántas listas está cada artículo.
  assert.equal((await wish(null,first.id,true)).status,401);for(const [edition,on] of [['no-existe',true],[first.id,'si'],[first.id,null]])assert.equal((await wish(eva,edition,on)).status,400);
  assert.deepEqual((await wish(eva,first.id,true)).data,{wishes:[first.id]});await wish(eva,first.id,true);await wish(ana,first.id,true);
  b=await board(eva);assert.deepEqual([b.wishes,b.stats.editions[0].wishes],[[first.id],2]);assert.deepEqual((await board(luis)).wishes,[]);
  assert.deepEqual((await wish(eva,first.id,false)).data,{wishes:[]});assert.equal((await stat(luis)).wishes,1);

  // El libro cuadra con el saldo de todos.
  for(const player of everyone)assert.equal((await moves(player)).reduce((sum,one)=>sum+one.amount,0),await coinsOf(player));

  // Contra Supabase: las órdenes son funciones de la base de datos; los deseos, filas.
  const calls=[],fake=async(url,init={})=>{const target=new URL(url);calls.push({path:target.pathname,query:Object.fromEntries(target.searchParams),method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    return Response.json(target.pathname.endsWith('/rpc/wishlist_counts')?[{edition:'voltio',wishes:'4'}]:target.pathname.includes('/rpc/')?{id:7,coins:10}:target.pathname.endsWith('/buy_orders')?[{id:3,edition:'voltio',buyer:'x',price:900,created_at:'2026-11-20T09:00:00Z'}]:target.pathname.endsWith('/wishlist')&&(init.method||'GET')==='GET'?[{edition:'voltio'}]:[])};
  const remote=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:fake}).community,hash='c'.repeat(64),sent=()=>calls.at(-1);
  assert.deepEqual(await remote.marketOrder(hash,'voltio',900,5,10),{id:7,coins:10});assert.deepEqual([sent().path,sent().body],['/rest/v1/rpc/market_order',{p_buyer:hash,p_edition:'voltio',p_price:900,p_max:5,p_fee_percent:10}]);
  await remote.marketOrderCancel(7,hash);assert.deepEqual([sent().path,sent().body],['/rest/v1/rpc/market_order_cancel',{p_order:7,p_buyer:hash}]);
  await remote.marketSellNow(hash,'voltio',3,10);assert.deepEqual([sent().path,sent().body],['/rest/v1/rpc/market_sell_now',{p_seller:hash,p_edition:'voltio',p_serial:3,p_fee_percent:10}]);
  assert.deepEqual(await remote.marketOrders(),[{id:3,edition:'voltio',buyer:'x',price:900,at:Date.parse('2026-11-20T09:00:00Z')}]);assert.equal(sent().query.status,'eq.abierta');
  await remote.wishSet(hash,'voltio',true);assert.deepEqual([sent().method,sent().query.on_conflict,sent().body],['POST','player_hash,edition',{player_hash:hash,edition:'voltio'}]);
  await remote.wishSet(hash,'voltio',false);assert.deepEqual([sent().method,sent().query.player_hash,sent().query.edition],['DELETE','eq.'+hash,'eq.voltio']);
  assert.deepEqual(await remote.wishesOf(hash),['voltio']);assert.deepEqual(await remote.wishCounts(),{voltio:4});

  console.log('ordenes: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
