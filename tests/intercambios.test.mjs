// Prueba los intercambios privados de artículos de colección (decisión 0075): crear, entrar con el código, ofrecer,
// confirmar los dos y el cambio entero, sin faradios. A través de la API, con cuentas falsas; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {EDITIONS} from '../lib/catalogo.mjs';
import {TRADES,tradeCode} from '../lib/intercambios.mjs';

assert.deepEqual([TRADES.units,TRADES.open,TRADES.idle],[10,5,30*60000]);
assert.match(tradeCode(()=>0),/^[A-Z2-9]{6}$/);assert.match(tradeCode(()=>.999),/^[A-Z2-9]{6}$/);

// La migración define las funciones sin permisos públicos y con search_path fijo.
const file=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(name=>name.endsWith('_intercambios.sql'));
const sql=fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'),FUNCTIONS=['trade_free','trade_join','trade_offer','trade_confirm','trade_cancel'];
for(const name of FUNCTIONS){assert.ok(sql.includes(`create function public.${name}(`),name);assert.ok(sql.includes(`revoke execute on function public.${name}(`),name)}
assert.equal(sql.match(/set search_path = ''/g).length,FUNCTIONS.length);assert.ok(sql.includes('alter table public.trades enable row level security'));

const [first]=[...EDITIONS.values()].sort((a,b)=>a.from<b.from?-1:1),unit=serial=>({edition:first.id,serial});
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-intercambios-'));
let clock=Date.parse(first.from+'T09:00:00Z'),dice=0;
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
// Cada código sale distinto: el dado avanza con cada tirada.
const api=createApi({playedDays:async()=>200,store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,random:()=>(dice=(dice+.137)%1),auth,log:()=>{}});
async function post(body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const coinsOf=async player=>(await post({action:'leer'},player)).data.coins,units=async player=>(await post({action:'inventario'},player)).data.collectibles;
const create=(player,name)=>post({action:'intercambio-crear',name,avatar:{top:'sud-gris',raro:'<x>'}},player),join=(player,code,name)=>post({action:'intercambio-unirse',code,name,avatar:{}},player);
const offer=(player,id,list)=>post({action:'intercambio-ofrecer',id,units:list},player),confirm=(player,id,version,ok=true)=>post({action:'intercambio-confirmar',id,version,ok},player);
const read=(player,id)=>post({action:'intercambio',id},player),cancel=(player,id)=>post({action:'intercambio-cancelar',id},player);
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID();
  // Luis y Ana compran la edición al salir (números 1 y 2). Eva no tiene nada.
  for(const [player,coins] of [[luis,first.price+500],[ana,first.price],[eva,100]])await post({action:'guardar',state:{v:1,xp:4500},delta:coins},player);
  for(const player of [luis,ana])assert.equal((await post({action:'comprar-edicion',edition:first.id},player)).status,200);
  const money=async()=>Promise.all([luis,ana,eva].map(coinsOf)),before=await money();

  // La lista, vacía: las reglas y lo que se puede ofrecer.
  assert.equal((await post({action:'intercambios'},null)).status,401);
  let r=await post({action:'intercambios'},luis);
  assert.deepEqual(r.data,{now:clock,rules:{units:10,open:5,minutes:30},trades:[],units:[unit(1)]});

  // Crear: da un código para compartir. El nombre y el avatar se limpian.
  assert.equal((await create(null,'Luis')).status,401);
  r=await create(luis,'  Luis <b> ');const id=r.data.trade.id,code=r.data.trade.code;
  assert.match(code,/^[A-Z2-9]{6}$/);assert.deepEqual(r.data.units,[unit(1)]);
  assert.deepEqual(r.data.trade,{id,code,status:'abierto',version:0,updatedAt:clock,host:true,me:{name:'Luis b',avatar:{top:'sud-gris'},offer:[],ok:false},other:null});
  assert.equal((await confirm(luis,id,0)).data.code,'solo','Hasta que no entra alguien no se confirma');

  // Entrar: con el código, y solo caben dos. Quien no participa no lo ve.
  for(const bad of ['','abc','ABCDE1','ABCDEFG',null,42])assert.equal((await join(ana,bad,'Ana')).status,400);
  assert.equal((await join(ana,code==='ZZZZZZ'?'YYYYYY':'ZZZZZZ','Ana')).data.code,'cerrado');
  r=await join(ana,code.toLowerCase(),'Ana');
  assert.deepEqual(r.data.trade,{id,code,status:'abierto',version:0,updatedAt:clock,host:false,me:{name:'Ana',avatar:{},offer:[],ok:false},other:{name:'Luis b',avatar:{top:'sud-gris'},offer:[],ok:false}});
  assert.equal((await join(ana,code,'Ana')).status,200,'Volver a entrar no cambia nada');assert.equal((await join(luis,code,'Luis')).data.trade.host,true);
  assert.equal((await join(eva,code,'Eva')).data.code,'lleno');assert.equal((await read(eva,id)).status,404);assert.equal((await read(luis,999)).status,404);
  assert.deepEqual((await read(luis,id)).data.trade.other,{name:'Ana',avatar:{},offer:[],ok:false});

  // Ofrecer: solo artículos de colección propios, sin repetir. Sin nada ofrecido no se confirma.
  assert.equal((await confirm(luis,id,0)).data.code,'vacio');
  assert.equal((await offer(eva,id,[])).data.code,'cerrado');
  for(const bad of [null,'x',[unit(1),unit(1)],[{edition:'no-existe',serial:1}],[{edition:first.id,serial:0}],[{edition:first.id,serial:'1'}],Array.from({length:11},(_,i)=>unit(i+1))])assert.equal((await offer(luis,id,bad)).status,400);
  assert.equal((await offer(luis,id,[unit(2)])).data.code,'no-disponible','La n.º 2 es de Ana');
  r=await offer(luis,id,[unit(1)]);assert.deepEqual([r.data.trade.version,r.data.trade.me.offer,r.data.trade.me.ok],[1,[unit(1)],false]);

  // Confirmar: con la versión que se ha visto. Si el otro cambia su oferta, la confirmación se pierde.
  assert.equal((await confirm(luis,id,0)).data.code,'cambio');for(const bad of [[null,true],[1,'si']])assert.equal((await post({action:'intercambio-confirmar',id,version:bad[0],ok:bad[1]},luis)).status,400);
  r=await confirm(luis,id,1);assert.deepEqual([r.data.trade.me.ok,r.data.trade.other.ok,r.data.trade.status],[true,false,'abierto']);
  r=await offer(ana,id,[unit(2)]);assert.deepEqual([r.data.trade.version,r.data.trade.me.ok,r.data.trade.other.ok],[2,false,false]);
  assert.equal((await confirm(ana,id,1)).data.code,'cambio');
  // Se puede quitar la confirmación.
  await confirm(luis,id,2);r=await confirm(luis,id,2,false);assert.equal(r.data.trade.me.ok,false);
  // Con las dos confirmaciones, el cambio se hace entero: cada uno tiene lo del otro y no se mueve ni un faradio.
  await confirm(luis,id,2);r=await confirm(ana,id,2);
  assert.deepEqual([r.data.trade.status,r.data.trade.me.ok,r.data.trade.other.ok],['hecho',true,true]);
  assert.deepEqual(await units(luis),[unit(2)]);assert.deepEqual(await units(ana),[unit(1)]);assert.deepEqual(await money(),before);
  for(const again of [offer(luis,id,[]),confirm(luis,id,2),cancel(luis,id)])assert.equal((await again).data.code,'cerrado');

  // Un regalo: uno ofrece y el otro nada. Vale entre dos cuentas cualesquiera.
  r=await create(ana,'Ana');const gift=r.data.trade.id;await join(eva,r.data.trade.code,'Eva');
  await offer(ana,gift,[unit(1)]);await confirm(eva,gift,1);r=await confirm(ana,gift,1);assert.equal(r.data.trade.status,'hecho');
  assert.deepEqual(await units(eva),[unit(1)]);assert.deepEqual(await units(ana),[]);

  // Lo anunciado en el mercado no se puede ofrecer. Y si se anuncia después de ofrecerlo, el cambio no se hace.
  r=await create(luis,'Luis');const third=r.data.trade.id;await join(eva,r.data.trade.code,'Eva');
  await offer(luis,third,[unit(2)]);await offer(eva,third,[unit(1)]);
  assert.equal((await post({action:'vender',edition:first.id,serial:2,buyNow:900},luis)).status,200);
  assert.equal((await offer(luis,third,[unit(2)])).data.code,'no-disponible');
  await confirm(eva,third,2);r=await confirm(luis,third,2);assert.equal(r.data.code,'no-disponible');
  r=await read(eva,third);assert.deepEqual([r.data.trade.status,r.data.trade.me.ok,r.data.trade.other.ok],['abierto',false,false],'Se quitan las dos confirmaciones');
  assert.deepEqual(await units(eva),[unit(1)]);
  // Cancelar: cualquiera de los dos.
  assert.equal((await cancel(ana,third)).data.code,'cerrado');r=await cancel(eva,third);assert.equal(r.data.trade.status,'cancelado');

  // Como mucho cinco abiertos a la vez; si nadie los toca en media hora, caducan.
  for(let n=0;n<TRADES.open;n++)assert.equal((await create(eva,'Eva')).status,200);
  assert.equal((await create(eva,'Eva')).data.code,'tope');
  r=await post({action:'intercambios'},eva);assert.deepEqual(r.data.trades.map(trade=>trade.status),[...Array(TRADES.open).fill('abierto'),'cancelado','hecho']);
  assert.equal(new Set(r.data.trades.map(trade=>trade.code)).size,r.data.trades.length,'Cada intercambio tiene su código');
  clock+=TRADES.idle+1000;r=await post({action:'intercambios'},eva);
  assert.deepEqual(r.data.trades.map(trade=>trade.status),[...Array(TRADES.open).fill('caducado'),'cancelado','hecho']);
  assert.equal((await create(eva,'Eva')).status,200);

  // Contra Supabase: entrar, ofrecer, confirmar y cancelar son funciones de la base de datos.
  const row={id:9,code:'ABCDEF',a:'a'.repeat(64),b:null,a_name:'Luis',b_name:'',a_avatar:{},b_avatar:{},offer_a:[],offer_b:[],ok_a:false,ok_b:false,status:'abierto',version:0,created_at:'2026-11-20T09:00:00Z',updated_at:'2026-11-20T09:05:00Z'};
  const calls=[],fake=async(url,init={})=>{const target=new URL(url);calls.push({path:target.pathname,query:Object.fromEntries(target.searchParams),method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    return Response.json(target.pathname.endsWith('/rpc/trade_cancel')?{error:'cerrado'}:target.pathname.includes('/rpc/')?row:(init.method==='PATCH'?[]:[row]))};
  const remote=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:fake}).community,hash='c'.repeat(64),sent=()=>calls.at(-1);
  const made=await remote.tradeCreate(hash,'Luis',{top:'x'},'ABCDEF');
  assert.deepEqual([made.id,made.code,made.aName,made.offerA,made.updatedAt],[9,'ABCDEF','Luis',[],Date.parse('2026-11-20T09:05:00Z')]);
  assert.deepEqual([sent().method,sent().path,sent().query,sent().body],['POST','/rest/v1/trades',{on_conflict:'code'},{code:'ABCDEF',a:hash,a_name:'Luis',a_avatar:{top:'x'}}]);
  await remote.tradeJoin('ABCDEF',hash,'Ana',{});assert.deepEqual([sent().path,sent().body],['/rest/v1/rpc/trade_join',{p_code:'ABCDEF',p_player:hash,p_name:'Ana',p_avatar:{}}]);
  await remote.tradeOffer(9,hash,[{edition:'voltio',serial:3}]);assert.deepEqual(sent().body,{p_trade:9,p_player:hash,p_units:[{edition:'voltio',serial:3}]});
  await remote.tradeConfirm(9,hash,true,4);assert.deepEqual([sent().path,sent().body],['/rest/v1/rpc/trade_confirm',{p_trade:9,p_player:hash,p_ok:true,p_version:4}]);
  assert.deepEqual(await remote.tradeCancel(9,hash),{error:'cerrado'});
  assert.equal((await remote.tradeGet(9)).id,9);assert.deepEqual([sent().query.id,sent().query.limit],['eq.9','1']);
  await remote.tradesOf(hash,12);assert.deepEqual([sent().query.or,sent().query.order,sent().query.limit],[`(a.eq.${hash},b.eq.${hash})`,'id.desc','12']);
  await remote.tradeExpire(hash,Date.parse('2026-11-20T09:00:00Z'));
  assert.deepEqual([sent().method,sent().query.status,sent().query.updated_at,sent().body],['PATCH','eq.abierto','lt.2026-11-20T09:00:00.000Z',{status:'caducado'}]);

  console.log('intercambios: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
