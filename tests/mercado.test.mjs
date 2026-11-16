// Prueba el mercado de artículos de colección (decisiones 0073 y 0074): anunciar con «compra ya» o en subasta, pujar,
// comprar, retirar, el cierre de las subastas, los avisos y los indicadores. A través de la API, con cuentas falsas; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {EDITIONS} from '../lib/catalogo.mjs';
import {MARKET,feeOf,nextBid,marketStats} from '../lib/mercado.mjs';

// La comisión: el 10 %, hacia arriba, y nunca más que el precio. La puja siguiente: un 5 % más, al menos 1.
assert.deepEqual([MARKET.fee,MARKET.max,MARKET.level,MARKET.step],[10,3,10,5]);
assert.deepEqual([1,5,10,11,1500,999999].map(price=>feeOf(price)),[1,1,1,2,150,100000]);
assert.equal(nextBid({startBid:null,topBid:null}),null);assert.equal(nextBid({startBid:100,topBid:null}),100);
assert.equal(nextBid({startBid:100,topBid:100}),105);assert.equal(nextBid({startBid:1,topBid:3}),4);assert.equal(nextBid({startBid:100,topBid:1001}),1052);

// Los indicadores, con datos a mano.
{
  const now=Date.parse('2026-11-20T12:00:00Z'),H=3600000,sale=(price,hours,by='compra')=>({edition:'a',serial:1,price,fee:feeOf(price),by,at:now-hours*H});
  const stats=marketStats({editions:[{id:'a',n:1,name:'A',total:500},{id:'b',n:2,name:'B',total:100}],counts:{a:40},owners:{a:{owners:31,units:40}},now,
    open:[{edition:'a',buyNow:900,startBid:null,topBid:null},{edition:'a',buyNow:1200,startBid:500,topBid:700},{edition:'a',buyNow:null,startBid:300,topBid:null}],
    sales:[sale(1000,2),sale(800,30,'puja'),sale(1200,24*6),sale(400,24*20)]});
  const [a,b]=stats.editions;
  assert.deepEqual([a.minted,a.owners,a.onSale,a.auctions,a.floor,a.topBid],[40,31,3,2,900,700]);
  assert.deepEqual([a.last,a.change,a.avg7,a.sales7,a.volume7,a.sales24,a.high,a.low,a.sales],[1000,25,1000,3,3000,1,1200,400,4]);
  assert.deepEqual(a.history.map(point=>point.price),[400,1200,800,1000],'De la más antigua a la más reciente');
  assert.deepEqual([b.minted,b.owners,b.onSale,b.floor,b.last,b.change,b.avg7,b.sales7],[0,0,0,null,null,null,null,0]);
  assert.deepEqual(stats.global,{listings:3,auctions:2,sales24:1,volume24:1000,sales7:3,volume7:3000,burned7:300,items:2,orders:0});
}

// La migración define las funciones sin permisos públicos y con search_path fijo.
const sql=fs.readFileSync(new URL('../supabase/migrations/20261116003548_mercado.sql',import.meta.url),'utf8'),FUNCTIONS=['market_pay','market_list','market_cancel','market_buy','market_bid','market_settle','market_owners'];
for(const name of FUNCTIONS){assert.ok(sql.includes(`create function public.${name}(`),name);assert.ok(sql.includes(`revoke execute on function public.${name}(`),name)}
assert.equal(sql.match(/set search_path = ''/g).length,FUNCTIONS.length);
for(const table of ['listings','bids'])assert.ok(sql.includes(`alter table public.${table} enable row level security`));

const [first]=[...EDITIONS.values()].sort((a,b)=>a.from<b.from?-1:1),HOUR=3600000;
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
const sell=(player,serial,offer,edition=first.id)=>post({action:'vender',edition,serial,...offer},player);
const buy=(player,listing)=>post({action:'comprar-anuncio',listing},player),bid=(player,listing,amount)=>post({action:'pujar',listing,amount},player);
const cancel=(player,listing)=>post({action:'retirar',listing},player),moves=async player=>(await post({action:'movimientos'},player)).data.moves;
const lastMove=async player=>{const [one]=await moves(player);return [one.reason,one.amount,one.source,one.ref]};
const none={sold:[],expired:[],won:[],outbid:[]};
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID(),novato=randomUUID(),everyone=[luis,ana,eva,novato];
  // Luis y Ana tienen nivel 10 y compran la edición al salir (números 1 y 2). Eva tiene nivel 10 y saldo; el novato, nivel 9.
  for(const [player,xp,coins] of [[luis,4500,first.price],[ana,4500,first.price+2000],[eva,4500,5000],[novato,3600,first.price]])await post({action:'guardar',state:{v:1,xp},delta:coins},player);
  for(const player of [luis,ana])assert.equal((await post({action:'comprar-edicion',edition:first.id},player)).status,200);
  const total=async()=>(await Promise.all(everyone.map(coinsOf))).reduce((sum,coins)=>sum+coins,0);

  // El tablón, vacío: las reglas, los indicadores y las unidades de cada uno.
  assert.equal((await post({action:'mercado'},null)).status,401);
  let b=await board(luis);
  assert.deepEqual(b.rules,{fee:10,max:3,level:10,maxPrice:MARKET.maxPrice,step:5,hours:MARKET.hours,orders:5});assert.deepEqual([b.level,b.verified,b.now,b.coins],[10,true,clock,0]);
  assert.deepEqual(b.stats.editions.map(one=>[one.id,one.minted,one.owners,one.onSale,one.floor,one.last]),[[first.id,2,2,0,null,null]]);
  assert.deepEqual(b.stats.global,{listings:0,auctions:0,sales24:0,volume24:0,sales7:0,volume7:0,burned7:0,items:1,orders:0});
  assert.deepEqual(b.units,[{edition:first.id,serial:1,listing:null}]);assert.deepEqual([b.listings,b.sales,b.mine,b.bids,b.notices],[[],[],[],[],none]);

  // Vender: con cuenta comprobada, nivel 10, una unidad propia y precios válidos.
  assert.equal((await sell(null,1,{buyNow:1500})).status,401);
  for(const [edition,serial] of [['no-existe',1],[first.id,0],[first.id,first.total+1],[first.id,'1']])assert.equal((await sell(luis,serial,{buyNow:10},edition)).status,400);
  for(const offer of [{},{buyNow:0},{buyNow:1.5},{buyNow:'100'},{buyNow:MARKET.maxPrice+1},{startBid:-1,hours:1},{buyNow:500,startBid:500,hours:1},{buyNow:400,startBid:500,hours:1}])assert.equal((await sell(luis,1,offer)).data.code,'precio',JSON.stringify(offer));
  for(const hours of [undefined,2,0,'1'])assert.equal((await sell(luis,1,{startBid:100,hours})).data.code,'duracion');
  assert.equal((await sell('sin-correo:'+luis,1,{buyNow:1500})).data.code,'cuenta');
  assert.equal((await sell(luis,2,{buyNow:1500})).data.code,'no-tuya','La unidad n.º 2 es de Ana');
  let r=await sell(luis,1,{buyNow:1500});
  assert.deepEqual(r.data,{listing:1,edition:first.id,serial:1,buyNow:1500,startBid:null,hours:null});
  assert.equal((await sell(luis,1,{buyNow:900})).data.code,'anunciada');
  // En depósito: sale de su armario, pero sigue en «tus unidades» con su anuncio, y no se ha movido ni un faradio.
  assert.deepEqual(await units(luis),[]);assert.deepEqual((await post({action:'inventario'},luis)).data.listed,[{edition:first.id,serial:1}]);
  assert.deepEqual((await post({action:'ediciones'},luis)).data.editions[0].serials,[]);
  b=await board(luis);assert.deepEqual(b.units,[{edition:first.id,serial:1,listing:1}]);assert.equal(await coinsOf(luis),0);
  const fixed={id:1,edition:first.id,serial:1,buyNow:1500,startBid:null,topBid:null,bids:0,endsAt:null,minBid:null,winning:false};
  assert.deepEqual(b.listings,[{...fixed,mine:true}]);assert.deepEqual(b.mine.map(one=>[one.id,one.status]),[[1,'activo']]);
  // Los demás lo ven sin saber de quién es. Un anuncio sin subasta no admite pujas.
  b=await board(eva);assert.deepEqual(b.listings,[{...fixed,mine:false}]);assert.deepEqual([b.stats.editions[0].onSale,b.stats.editions[0].floor,b.stats.global.listings],[1,1500,1]);
  assert.equal((await bid(eva,1,1500)).data.code,'sin-pujas');

  // Retirar: solo el vendedor; vuelve al armario y se puede anunciar otra vez.
  assert.equal((await cancel(ana,1)).data.code,'cerrado');for(const bad of [0,'1',null])assert.equal((await cancel(luis,bad)).status,400);
  assert.equal((await cancel(luis,1)).status,200);assert.equal((await cancel(luis,1)).data.code,'cerrado');
  assert.deepEqual(await units(luis),[{edition:first.id,serial:1}]);assert.equal((await buy(eva,1)).data.code,'cerrado');
  assert.equal((await sell(luis,1,{buyNow:1500})).data.listing,2);

  // Compra ya: no el propio, no sin saldo; cobra, paga el 90 %, destruye el 10 % y cambia el dueño.
  assert.equal((await buy(null,2)).status,401);for(const bad of [0,'2',null])assert.equal((await buy(eva,bad)).status,400);
  assert.equal((await buy(luis,2)).data.code,'propio');assert.equal((await buy(novato,2)).status,402);assert.equal(await coinsOf(novato),first.price);
  let before=await total();r=await buy(eva,2);
  assert.deepEqual(r.data,{coins:3500,edition:first.id,serial:1,price:1500,total:first.total});
  assert.equal(await coinsOf(luis),1350);assert.equal(await total(),before-150,'La comisión desaparece: no va a ningún saldo');
  assert.deepEqual(await units(eva),[{edition:first.id,serial:1}]);assert.deepEqual(await units(luis),[]);
  assert.deepEqual(await lastMove(eva),['mercado-compra',-1500,'servidor','2']);assert.deepEqual(await lastMove(luis),['mercado-venta',1350,'servidor','2']);
  assert.equal((await buy(ana,2)).data.code,'cerrado','No se vende dos veces');
  // El vendedor se entera la próxima vez que mira el tablón, una sola vez. La venta queda en el historial y en los indicadores.
  b=await board(luis);assert.deepEqual(b.notices,{...none,sold:[{id:2,edition:first.id,serial:1,price:1500,fee:150}]});assert.deepEqual((await board(luis)).notices,none);
  assert.deepEqual(b.sales,[{edition:first.id,serial:1,price:1500,by:'compra',at:clock}]);
  assert.deepEqual([b.stats.editions[0].last,b.stats.editions[0].sales7,b.stats.editions[0].volume7,b.stats.global.burned7,b.stats.global.sales24],[1500,1,1500,150,1]);
  assert.deepEqual(b.mine.map(one=>[one.id,one.status,one.soldPrice,one.soldBy,one.fee]),[[2,'vendido',1500,'compra',150],[1,'retirado',null,null,0]]);

  // Subasta: Ana saca la n.º 2 con puja de salida 1.000, compra ya 3.000 y una hora.
  r=await sell(ana,2,{startBid:1000,buyNow:3000,hours:1});assert.equal(r.data.listing,3);const ends=clock+HOUR;
  b=await board(novato);assert.deepEqual(b.listings,[{id:3,edition:first.id,serial:2,buyNow:3000,startBid:1000,topBid:null,bids:0,endsAt:ends,minBid:1000,mine:false,winning:false}]);
  assert.deepEqual([b.stats.editions[0].auctions,b.stats.editions[0].floor,b.stats.editions[0].topBid],[1,3000,null]);
  // Pujar: con cuenta, no en lo propio, al menos la puja mínima y con saldo. Los faradios quedan retenidos.
  assert.equal((await bid(null,3,1000)).status,401);for(const amount of [0,-5,1.5,'1000',null,MARKET.maxPrice+1])assert.equal((await bid(novato,3,amount)).status,400);
  assert.equal((await bid(ana,3,1000)).data.code,'propio');assert.equal((await bid(novato,99,1000)).data.code,'cerrado');
  r=await bid(novato,3,999);assert.deepEqual([r.data.code,r.data.min],['baja',1000]);
  assert.equal((await bid(novato,3,first.price+1)).status,402);
  r=await bid(novato,3,1000);assert.deepEqual(r.data,{coins:first.price-1000,topBid:1000,bids:1,endsAt:ends});
  assert.deepEqual(await lastMove(novato),['mercado-puja',-1000,'servidor','1']);
  assert.equal((await bid(novato,3,1100)).data.code,'ganando');assert.equal((await cancel(ana,3)).data.code,'pujas','Con pujas ya no se retira');
  b=await board(novato);assert.deepEqual(b.bids.map(one=>[one.id,one.amount,one.winning,one.topBid,one.minBid]),[[3,1000,true,1000,1050]]);
  // Superar la puja: hay que subirla un 5 %. A quien iba ganando se le devuelven sus faradios y se le avisa.
  r=await bid(eva,3,1049);assert.deepEqual([r.data.code,r.data.min],['baja',1050]);
  r=await bid(eva,3,1100);assert.deepEqual(r.data,{coins:2400,topBid:1100,bids:2,endsAt:ends});
  assert.equal(await coinsOf(novato),first.price);assert.deepEqual(await lastMove(novato),['mercado-puja-devuelta',1000,'servidor','1']);
  b=await board(novato);assert.deepEqual(b.notices,{...none,outbid:[{listing:3,edition:first.id,serial:2,amount:1000}]});
  assert.deepEqual(b.bids.map(one=>[one.id,one.amount,one.winning,one.topBid]),[[3,1000,false,1100]]);assert.deepEqual((await board(novato)).notices,none);
  // Pujar en el último minuto alarga la subasta hasta que quede un minuto.
  clock=ends-10000;r=await bid(luis,3,1155);assert.deepEqual(r.data,{coins:1350-1155,topBid:1155,bids:3,endsAt:clock+MARKET.snipe});
  const late=clock+MARKET.snipe;assert.equal(await coinsOf(eva),3500);
  // Mientras no acaba, nadie se la lleva. Al acabar, se cierra sola al mirar el tablón: es de quien más pujó.
  clock=late-1;assert.deepEqual(await units(luis),[]);assert.equal((await board(novato)).listings.length,1);
  before=await total();clock=late;
  b=await board(eva);assert.deepEqual(b.listings,[]);assert.deepEqual(b.notices,{...none,outbid:[{listing:3,edition:first.id,serial:2,amount:1100}]});
  assert.deepEqual(b.sales[0],{edition:first.id,serial:2,price:1155,by:'puja',at:clock});assert.deepEqual([b.stats.editions[0].last,b.stats.editions[0].change],[1155,-23]);
  assert.deepEqual(await units(luis),[{edition:first.id,serial:2}]);assert.deepEqual(await units(ana),[]);
  assert.equal(await coinsOf(ana),2000+1155-116);assert.equal(await total(),before+1155-116,'La puja retenida pasa al vendedor, menos la comisión');assert.deepEqual(await lastMove(ana),['mercado-venta',1039,'servidor','3']);
  assert.deepEqual((await board(ana)).notices,{...none,sold:[{id:3,edition:first.id,serial:2,price:1155,fee:116}]});
  assert.deepEqual((await board(luis)).notices,{...none,won:[{id:3,edition:first.id,serial:2,price:1155,fee:116,by:'puja'}]});
  assert.equal((await bid(eva,3,2000)).data.code,'cerrado');assert.equal((await buy(eva,3)).data.code,'cerrado');

  // Una subasta sin pujas caduca: la unidad vuelve al armario y el vendedor recibe el aviso. Sin espera para revender.
  assert.equal((await sell(luis,2,{startBid:5000,hours:6})).data.listing,4);clock+=6*HOUR;
  b=await board(luis);assert.deepEqual(b.notices,{...none,expired:[{id:4,edition:first.id,serial:2}]});assert.equal(b.mine[0].status,'caducado');
  assert.deepEqual(b.units,[{edition:first.id,serial:2,listing:null}]);
  // Una puja que llega al precio de compra ya, compra. Y comprar ya con una puja puesta se la devuelve a quien pujó.
  assert.equal((await sell(luis,2,{startBid:500,buyNow:900,hours:24})).data.listing,5);
  r=await bid(novato,5,600);assert.equal(r.status,200);
  before=await coinsOf(eva);r=await bid(eva,5,950);
  assert.deepEqual(r.data,{coins:before-900,bought:true,edition:first.id,serial:2,price:900,total:first.total});
  assert.equal(await coinsOf(novato),first.price,'Al novato se le devuelve su puja');assert.deepEqual((await board(novato)).notices,{...none,outbid:[{listing:5,edition:first.id,serial:2,amount:600}]});
  // Quien iba ganando puede comprar ya: su puja retenida cuenta para el saldo.
  assert.equal((await sell(eva,2,{startBid:1000,buyNow:1200,hours:1})).data.listing,6);
  assert.equal((await bid(novato,6,1000)).status,200);assert.equal(await coinsOf(novato),200);
  r=await buy(novato,6);assert.deepEqual(r.data,{coins:0,edition:first.id,serial:2,price:1200,total:first.total});
  // El novato compra y puja, pero no vende: hace falta nivel 10.
  assert.equal((await sell(novato,2,{buyNow:1100})).data.code,'nivel');

  // Tope de anuncios activos: tres por cuenta. Al retirar uno, cabe otro.
  const store=fileStore(path.join(directory,'otro','answers.json')).community,rico='a'.repeat(64),pobre='b'.repeat(64);
  for(let serial=1;serial<=4;serial++)await store.addCollectible(first.id,serial,rico);
  for(let serial=1;serial<=3;serial++)assert.ok((await store.marketList(rico,first.id,serial,{buyNow:100},MARKET.max,0)).id);
  assert.deepEqual(await store.marketList(rico,first.id,4,{buyNow:100},MARKET.max,0),{error:'tope'});
  assert.ok((await store.marketList(rico,first.id,4,{buyNow:100},null,0)).id,'Sin tope (los suscriptores, más adelante)');
  assert.deepEqual(await store.marketCancel(1,rico,0),{ok:true});assert.deepEqual(await store.marketCancel(1,rico,0),{error:'cerrado'});
  await store.move(pobre,500,'prueba');
  assert.deepEqual(await store.marketBuy(2,pobre,10,null,0),{coins:400,edition:first.id,serial:2,price:100,fee:10});
  assert.deepEqual(await store.marketBuy(99,pobre,10,null,0),{error:'cerrado'});
  assert.deepEqual(await store.marketOwners(),{[first.id]:{owners:2,units:4}});

  // El libro cuadra con el saldo de todos.
  for(const player of everyone)assert.equal((await moves(player)).reduce((sum,one)=>sum+one.amount,0),await coinsOf(player));

  // Contra Supabase: publicar, retirar, comprar, pujar y cerrar son funciones de la base de datos; los avisos se marcan al leerlos.
  const calls=[],fake=async(url,init={})=>{const target=new URL(url);calls.push({path:target.pathname,query:Object.fromEntries(target.searchParams),method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    return Response.json(target.pathname.endsWith('/rpc/market_settle')?2:target.pathname.includes('/rpc/market_owners')?[{edition:'voltio',owners:'3',units:'5'}]:target.pathname.includes('/rpc/')?{id:7}
      :target.pathname.endsWith('/listings')&&(init.method||'GET')==='GET'?[{id:7,edition:'voltio',serial:3,seller:'s',buy_now:900,start_bid:100,top_bid:null,top_bidder:null,bids:0,ends_at:'2026-11-20T10:00:00Z',status:'activo',sold_price:null,sold_by:null,fee:0,buyer:null,created_at:'2026-11-20T09:00:00Z',closed_at:null}]:[])};
  const remote=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:fake}).community,hash='c'.repeat(64),sent=()=>calls.at(-1);
  assert.deepEqual(await remote.marketList(hash,'voltio',3,{buyNow:900,startBid:100,hours:6},3),{id:7});
  assert.deepEqual(sent(),{path:'/rest/v1/rpc/market_list',query:{},method:'POST',body:{p_seller:hash,p_edition:'voltio',p_serial:3,p_buy_now:900,p_start_bid:100,p_hours:6,p_max:3}});
  await remote.marketCancel(7,hash);assert.deepEqual(sent().body,{p_listing:7,p_seller:hash});
  await remote.marketBuy(7,hash,10);assert.deepEqual([sent().path,sent().body],['/rest/v1/rpc/market_buy',{p_listing:7,p_buyer:hash,p_fee_percent:10}]);
  await remote.marketBid(7,hash,500,{percent:10,step:5,snipe:60000});assert.deepEqual([sent().path,sent().body],['/rest/v1/rpc/market_bid',{p_listing:7,p_bidder:hash,p_amount:500,p_fee_percent:10,p_step_percent:5,p_snipe_seconds:60}]);
  assert.equal(await remote.marketSettle(10),2);assert.deepEqual(sent().body,{p_fee_percent:10});
  assert.deepEqual(await remote.marketOwners(),{voltio:{owners:3,units:5}});
  const [open]=await remote.marketOpen();assert.deepEqual([sent().query.status,sent().query.order],['eq.activo','id.asc']);
  assert.deepEqual([open.id,open.buyNow,open.startBid,open.endsAt,open.at,open.closedAt],[7,900,100,Date.parse('2026-11-20T10:00:00Z'),Date.parse('2026-11-20T09:00:00Z'),null]);
  assert.deepEqual(await remote.marketNotices(hash),none);
  assert.deepEqual(calls.slice(-3).map(call=>[call.method,call.path.split('/').pop(),call.body]),[['PATCH','listings',{seller_seen:true}],['PATCH','listings',{buyer_seen:true}],['PATCH','bids',{seen:true}]]);

  console.log('mercado: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
