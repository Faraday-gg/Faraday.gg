// Prueba el mercado de artículos de colección (decisión 0073): anunciar, retirar y comprar unidades numeradas, con la
// comisión destruida. A través de la API, con cuentas falsas; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {EDITIONS} from '../lib/catalogo.mjs';
import {MARKET,feeOf} from '../lib/mercado.mjs';

// La comisión: el 10 %, hacia arriba, y nunca más que el precio.
assert.equal(MARKET.fee,10);assert.equal(MARKET.max,3);assert.equal(MARKET.level,10);
assert.deepEqual([1,5,10,11,1500,999999].map(price=>feeOf(price)),[1,1,1,2,150,100000]);

// La migración define las tres funciones sin permisos públicos y con search_path fijo.
const sql=fs.readFileSync(new URL('../supabase/migrations/20261116130000_mercado.sql',import.meta.url),'utf8');
for(const name of ['market_list','market_cancel','market_buy']){assert.ok(sql.includes(`create function public.${name}(`));assert.ok(sql.includes(`revoke execute on function public.${name}(`))}
assert.equal(sql.match(/set search_path = ''/g).length,3);assert.ok(sql.includes('alter table public.listings enable row level security'));

const [first]=[...EDITIONS.values()].sort((a,b)=>a.from<b.from?-1:1);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-mercado-'));
let clock=Date.parse(first.from+'T09:00:00Z');
// Una cuenta con la cookie «sin-correo:<jugador>» no tiene el correo comprobado.
const auth={async current(request,read){const value=read(request,'faraday_sesion');if(!value)return null;const [flag,id]=value.includes(':')?value.split(':'):['',value];return {account:{id:'u-'+id,email:flag?'':'x@y.z',player:id},cookies:[]}}};
const api=createApi({playedDays:async()=>200,store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(body,session){
  const headers={'Content-Type':'application/json'};if(session)headers.cookie='faraday_sesion='+session;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const coinsOf=async player=>(await post({action:'leer'},player)).data.coins,board=async player=>(await post({action:'mercado'},player)).data;
const units=async player=>(await post({action:'inventario'},player)).data.collectibles;
const sell=(player,serial,price,edition=first.id)=>post({action:'vender',edition,serial,price},player);
const buy=(player,listing)=>post({action:'comprar-anuncio',listing},player),moves=async player=>(await post({action:'movimientos'},player)).data.moves;
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID(),novato=randomUUID();
  // Luis y Ana tienen nivel 10 y compran la edición al salir (números 1 y 2). Eva tiene nivel 10 y saldo; el novato, nivel 9.
  for(const [player,xp,coins] of [[luis,4500,first.price],[ana,4500,first.price+2000],[eva,4500,5000],[novato,3600,first.price]])await post({action:'guardar',state:{v:1,xp},delta:coins},player);
  for(const player of [luis,ana])assert.equal((await post({action:'comprar-edicion',edition:first.id},player)).status,200);
  assert.deepEqual(await units(luis),[{edition:first.id,serial:1}]);

  // El tablón, vacío: las reglas, la edición con lo que hay emitido y las unidades de cada uno.
  assert.equal((await post({action:'mercado'},null)).status,401);
  let b=await board(luis);
  assert.deepEqual(b.rules,{fee:10,max:3,level:10,maxPrice:MARKET.maxPrice});assert.equal(b.level,10);assert.equal(b.verified,true);
  assert.deepEqual(b.editions.map(one=>[one.id,one.minted,one.onSale,one.floor,one.last]),[[first.id,2,0,null,null]]);
  assert.deepEqual(b.units,[{edition:first.id,serial:1,listing:null}]);assert.deepEqual([b.listings,b.sales,b.notices],[[],[],[]]);

  // Vender: con cuenta comprobada, nivel 10, una unidad propia y un precio válido.
  assert.equal((await sell(null,1,1500)).status,401);
  for(const [edition,serial,price] of [['no-existe',1,10],[first.id,0,10],[first.id,first.total+1,10],[first.id,'1',10]])assert.equal((await sell(luis,serial,price,edition)).status,400);
  for(const price of [0,-5,1.5,'100',MARKET.maxPrice+1,null])assert.equal((await sell(luis,1,price)).data.code,'precio');
  assert.equal((await sell('sin-correo:'+luis,1,1500)).data.code,'cuenta');
  assert.equal((await sell(luis,2,1500)).data.code,'no-tuya','La unidad n.º 2 es de Ana');
  let r=await sell(luis,1,1500);
  assert.deepEqual(r.data,{listing:1,edition:first.id,serial:1,price:1500,fee:150});
  assert.equal((await sell(luis,1,900)).data.code,'anunciada');
  // En depósito: sale de su armario, pero sigue en «tus unidades» con su anuncio, y no se ha movido ni un faradio.
  assert.deepEqual(await units(luis),[]);assert.deepEqual((await post({action:'inventario'},luis)).data.listed,[{edition:first.id,serial:1}]);
  assert.deepEqual((await post({action:'ediciones'},luis)).data.editions[0].serials,[]);
  b=await board(luis);assert.deepEqual(b.units,[{edition:first.id,serial:1,listing:{id:1,price:1500}}]);
  assert.deepEqual(b.listings,[{id:1,edition:first.id,serial:1,price:1500,mine:true}]);assert.equal(await coinsOf(luis),0);
  // Los demás lo ven sin saber de quién es.
  b=await board(eva);assert.deepEqual(b.listings,[{id:1,edition:first.id,serial:1,price:1500,mine:false}]);assert.deepEqual([b.editions[0].onSale,b.editions[0].floor],[1,1500]);

  // Retirar: solo el vendedor; vuelve al armario y se puede anunciar otra vez.
  assert.equal((await post({action:'retirar',listing:1},ana)).data.code,'cerrado');
  for(const bad of [0,'1',null])assert.equal((await post({action:'retirar',listing:bad},luis)).status,400);
  assert.equal((await post({action:'retirar',listing:1},luis)).status,200);assert.equal((await post({action:'retirar',listing:1},luis)).data.code,'cerrado');
  assert.deepEqual(await units(luis),[{edition:first.id,serial:1}]);assert.equal((await buy(eva,1)).data.code,'cerrado');
  r=await sell(luis,1,1500);assert.equal(r.data.listing,2);

  // Comprar: no el propio, no sin saldo; la compra cobra, paga el 90 %, destruye el 10 % y cambia el dueño.
  assert.equal((await buy(null,2)).status,401);for(const bad of [0,'2',null])assert.equal((await buy(eva,bad)).status,400);
  assert.equal((await buy(luis,2)).data.code,'propio');
  assert.equal((await buy(novato,2)).status,402);assert.equal(await coinsOf(novato),first.price);
  const total=async()=>(await Promise.all([luis,ana,eva,novato].map(coinsOf))).reduce((sum,coins)=>sum+coins,0),before=await total();
  r=await buy(eva,2);
  assert.deepEqual(r.data,{coins:3500,edition:first.id,serial:1,price:1500,total:first.total});
  assert.equal(await coinsOf(eva),3500);assert.equal(await coinsOf(luis),1350);
  assert.equal(await total(),before-150,'La comisión desaparece: no va a ningún saldo');
  assert.deepEqual(await units(eva),[{edition:first.id,serial:1}]);assert.deepEqual(await units(luis),[]);
  assert.deepEqual((await moves(eva)).slice(0,1).map(one=>[one.reason,one.amount,one.source,one.ref]),[['mercado-compra',-1500,'servidor','2']]);
  assert.deepEqual((await moves(luis)).slice(0,1).map(one=>[one.reason,one.amount,one.source,one.ref]),[['mercado-venta',1350,'servidor','2']]);
  assert.equal((await buy(ana,2)).data.code,'cerrado','No se vende dos veces');assert.equal(await coinsOf(ana),2000);
  // El vendedor se entera la próxima vez que mira el tablón, una sola vez. La venta queda en el historial.
  b=await board(luis);assert.deepEqual(b.notices,[{id:2,edition:first.id,serial:1,price:1500,fee:150}]);assert.deepEqual((await board(luis)).notices,[]);
  assert.deepEqual(b.sales.map(({edition,serial,price})=>[edition,serial,price]),[[first.id,1,1500]]);
  assert.deepEqual([b.editions[0].onSale,b.editions[0].floor,b.editions[0].last],[0,null,1500]);assert.deepEqual(b.units,[]);

  // Sin espera para revender: Eva la anuncia en el momento, más cara, y Ana anuncia la suya más barata.
  assert.equal((await sell(eva,1,2500)).status,200);assert.equal((await sell(ana,2,1800)).status,200);
  b=await board(novato);assert.deepEqual(b.listings.map(one=>[one.serial,one.price]),[[2,1800],[1,2500]],'Del más barato al más caro');
  assert.deepEqual([b.editions[0].onSale,b.editions[0].floor],[2,1800]);
  // El novato puede comprar (para vender hace falta nivel 10, para comprar no), pero no vender.
  await post({action:'retirar',listing:4},ana);assert.equal((await sell(ana,2,1000)).status,200);
  r=await buy(novato,5);assert.equal(r.status,200);assert.equal(await coinsOf(novato),first.price-1000);assert.equal(await coinsOf(ana),2000+900);
  assert.equal((await sell(novato,2,1100)).data.code,'nivel');

  // Tope de anuncios activos: tres por cuenta. Al retirar uno, cabe otro.
  const store=fileStore(path.join(directory,'otro','answers.json')).community,rico='a'.repeat(64);
  for(let serial=1;serial<=4;serial++)await store.addCollectible(first.id,serial,rico);
  for(let serial=1;serial<=3;serial++)assert.ok((await store.marketList(rico,first.id,serial,100,MARKET.max)).id);
  assert.deepEqual(await store.marketList(rico,first.id,4,100,MARKET.max),{error:'tope'});
  assert.ok((await store.marketList(rico,first.id,4,100,null)).id,'Sin tope (los suscriptores, más adelante)');
  assert.equal(await store.marketCancel(1,rico),true);assert.equal(await store.marketCancel(1,rico),false);
  // Si la unidad cambia de dueño con el anuncio puesto, el anuncio deja de valer y no se cobra.
  const pobre='b'.repeat(64);await store.move(pobre,500,'prueba');
  assert.deepEqual(await store.marketBuy(2,pobre,10),{coins:400,edition:first.id,serial:2,price:100,fee:10});
  assert.deepEqual(await store.marketBuy(99,pobre,10),{error:'cerrado'});

  // El libro cuadra con el saldo de todos.
  for(const player of [luis,ana,eva,novato])assert.equal((await moves(player)).reduce((sum,one)=>sum+one.amount,0),await coinsOf(player));

  // Contra Supabase: publicar, retirar y comprar son funciones de la base de datos; los avisos se marcan al leerlos.
  const calls=[],fake=async(url,init={})=>{const target=new URL(url);calls.push({path:target.pathname,query:Object.fromEntries(target.searchParams),method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    return Response.json(target.pathname.endsWith('/rpc/market_cancel')?true:target.pathname.includes('/rpc/')?{id:7}:[])};
  const remote=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:fake}).community,hash='c'.repeat(64);
  assert.deepEqual(await remote.marketList(hash,'voltio',3,900,3),{id:7});
  assert.deepEqual(calls.at(-1),{path:'/rest/v1/rpc/market_list',query:{},method:'POST',body:{p_seller:hash,p_edition:'voltio',p_serial:3,p_price:900,p_max:3}});
  assert.equal(await remote.marketCancel(7,hash),true);assert.deepEqual(calls.at(-1).body,{p_listing:7,p_seller:hash});
  await remote.marketBuy(7,hash,10);assert.deepEqual([calls.at(-1).path,calls.at(-1).body],['/rest/v1/rpc/market_buy',{p_listing:7,p_buyer:hash,p_fee_percent:10}]);
  await remote.marketOpen();assert.deepEqual([calls.at(-1).query.status,calls.at(-1).query.order],['eq.activo','price.asc,id.asc']);
  await remote.marketNotices(hash);assert.deepEqual([calls.at(-1).method,calls.at(-1).query.seller,calls.at(-1).query.seller_seen,calls.at(-1).body],['PATCH','eq.'+hash,'is.false',{seller_seen:true}]);

  console.log('mercado: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
