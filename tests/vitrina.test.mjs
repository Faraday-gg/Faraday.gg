// Prueba las vitrinas de colecciones (decisión 0079): la propia, enseñarla o no, verla con su enlace y la lista de
// coleccionistas. A través de la API, con cuentas falsas; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {EDITIONS} from '../lib/catalogo.mjs';
import {SHOWCASE} from '../lib/vitrina.mjs';

assert.deepEqual([SHOWCASE.top,SHOWCASE.finishes],[20,60]);
// La migración: una tabla y una función sin permisos públicos.
const file=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(name=>name.endsWith('_vitrinas.sql'));
const sql=fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
for(const text of ['create table public.showcases','alter table public.showcases enable row level security','revoke all on table public.showcases from anon, authenticated','create function public.showcase_ranking(',"set search_path = ''",'revoke execute on function public.showcase_ranking('])assert.ok(sql.includes(text),text);

const [first]=[...EDITIONS.values()].sort((a,b)=>a.from<b.from?-1:1);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-vitrina-'));
let dice=0;const clock=Date.parse(first.from+'T09:00:00Z');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const store=fileStore(path.join(directory,'answers.json')),hashOf=player=>createHash('sha256').update(player).digest('hex');
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,random:()=>(dice=(dice+.137)%1),auth,log:()=>{}});
async function post(body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const own=async player=>(await post({action:'vitrina'},player)).data.showcase,see=(player,code)=>post({action:'vitrina',code},player);
const publish=(player,open,name)=>post({action:'vitrina-publicar',public:open,name,avatar:{top:'sud-gris',raro:'<x>'}},player);
const collectors=async player=>(await post({action:'coleccionistas'},player)).data.collectors;
try{
  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID();
  for(const player of [luis,ana,eva])await post({action:'guardar',state:{v:1,xp:4500},delta:first.price},player);
  // Luis tiene tres unidades (una, anunciada) y dos piezas con acabado; Ana, una unidad; Eva, nada.
  for(const serial of [5,2,9])await store.community.addCollectible(first.id,serial,hashOf(luis));
  await store.community.addCollectible(first.id,7,hashOf(ana));
  await store.community.addItems(hashOf(luis),['top:sud-gris','top:sud-gris--or','shoes:skate-negro--cr'],'cofre');
  await store.community.marketList(hashOf(luis),first.id,9,{buyNow:900},null,clock);

  // La vitrina propia existe siempre, aunque no se enseñe: las unidades por número de serie (también las anunciadas) y los acabados.
  assert.equal((await post({action:'vitrina'},null)).status,401);
  let mine=await own(luis);
  assert.deepEqual(mine,{mine:true,code:null,public:false,name:'',avatar:{},units:[{edition:first.id,serial:2,listed:false},{edition:first.id,serial:5,listed:false},{edition:first.id,serial:9,listed:true}],
    finishes:['top:sud-gris--or','shoes:skate-negro--cr'],editions:1,released:1});
  assert.deepEqual(await own(eva),{mine:true,code:null,public:false,name:'',avatar:{},units:[],finishes:[],editions:0,released:1});
  assert.deepEqual(await collectors(eva),[],'Nadie la enseña todavía');

  // Enseñarla: da un código para el enlace, y el nombre y el avatar se limpian.
  assert.equal((await publish(null,true,'Luis')).status,401);for(const bad of ['si',null,1])assert.equal((await post({action:'vitrina-publicar',public:bad},luis)).status,400);
  let r=await publish(luis,true,'  Luis <b> ');const code=r.data.showcase.code;
  assert.match(code,/^[A-Z2-9]{8}$/);assert.deepEqual([r.data.showcase.public,r.data.showcase.name,r.data.showcase.avatar,r.data.showcase.units.length],[true,'Luis b',{top:'sud-gris'},3]);
  // Otro jugador la ve con el código: lo mismo, sin saber de qué cuenta es.
  r=await see(ana,code.toLowerCase());assert.equal(r.status,200);
  assert.deepEqual(r.data.showcase,{...mine,mine:false,code,public:true,name:'Luis b',avatar:{top:'sud-gris'}});
  assert.ok(!JSON.stringify(r.data).includes(hashOf(luis)),'No viaja el identificador de la cuenta');
  assert.equal((await see(luis,code)).data.showcase.mine,true);
  for(const bad of ['ABC','abcdefg!','ABCDEFGHI',42])assert.equal((await see(ana,bad)).status,400);
  assert.equal((await see(ana,code==='ZZZZZZZZ'?'YYYYYYYY':'ZZZZZZZZ')).status,404);

  // La lista de coleccionistas: solo quien la enseña y tiene algo, de más a menos unidades.
  await publish(ana,true,'Ana');await publish(eva,true,'Eva');
  assert.deepEqual((await collectors(eva)).map(one=>[one.name,one.units,one.editions,one.code===code]),[['Luis b',3,1,true],['Ana',1,1,false]]);
  assert.ok((await collectors(eva)).every(one=>Object.keys(one).sort().join()==='avatar,code,editions,name,units'));

  // Dejar de enseñarla: conserva el código, sale de la lista y los demás ya no la ven; su dueño sí.
  r=await publish(luis,false,'Luis');assert.deepEqual([r.data.showcase.code,r.data.showcase.public],[code,false]);
  assert.equal((await see(ana,code)).data.code,'oculta');assert.equal((await see(luis,code)).status,200);
  assert.deepEqual((await collectors(eva)).map(one=>one.name),['Ana']);
  // Al volver a enseñarla, el enlace es el mismo y refleja lo que tiene ahora (ha comprado la de Ana en un intercambio, por ejemplo).
  await store.community.addCollectible(first.id,11,hashOf(luis));r=await publish(luis,true,'Luis');
  assert.equal(r.data.showcase.code,code);assert.equal((await see(ana,code)).data.showcase.units.length,4);

  // Contra Supabase: una fila por jugador y la lista como función de la base de datos.
  const calls=[],fake=async(url,init={})=>{const target=new URL(url);calls.push({path:target.pathname,query:Object.fromEntries(target.searchParams),method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    if(target.pathname.endsWith('/rpc/showcase_ranking'))return Response.json([{code:'ABCDEFGH',name:'Luis',avatar:null,units:'3',editions:'1'}]);
    if((init.method||'GET')==='POST')return new Response(null,{status:calls.filter(call=>call.method==='POST').length===1?409:201});
    return Response.json([{player_hash:'c'.repeat(64),code:'ABCDEFGH',public:true,name:'Luis',avatar:{top:'x'}}])};
  const remote=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:fake}).community,hash='c'.repeat(64),sent=()=>calls.at(-1);
  assert.deepEqual(await remote.showcaseOf(hash),{player:hash,code:'ABCDEFGH',public:true,name:'Luis',avatar:{top:'x'}});assert.equal(sent().query.player_hash,'eq.'+hash);
  await remote.showcaseByCode('ABCDEFGH');assert.equal(sent().query.code,'eq.ABCDEFGH');
  assert.equal(await remote.showcaseSave(hash,{code:'ABCDEFGH',public:true,name:'Luis',avatar:{}}),false,'Código repetido: se prueba otro');
  assert.equal(await remote.showcaseSave(hash,{code:'ABCDEFG2',public:true,name:'Luis',avatar:{}}),true);
  assert.deepEqual([sent().method,sent().query.on_conflict,sent().body.player_hash,sent().body.code,sent().body.public],['POST','player_hash',hash,'ABCDEFG2',true]);
  assert.deepEqual(await remote.showcaseRanking(20),[{code:'ABCDEFGH',name:'Luis',avatar:{},units:3,editions:1}]);assert.deepEqual(sent().body,{p_limit:20});

  console.log('vitrina: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
