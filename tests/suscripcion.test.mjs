// Prueba la suscripción sin el cobro (decisión 0076): quién la tiene y hasta cuándo, el tope de 5 duelos al día del plan
// gratuito, los anuncios sin tope en el mercado y las piezas de suscriptor. A través de la API; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {PIECES,EDITIONS} from '../lib/catalogo.mjs';
import {PLAN,createPlan} from '../lib/suscripcion.mjs';
import {MARKET} from '../lib/mercado.mjs';

assert.equal(PLAN.duels,5);
assert.ok(fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8').includes(`freeDuels:${PLAN.duels},`),'dist/progress.js dice los mismos duelos');

// Las piezas de suscriptor: una por cuerpo, gratis de precio pero ni se compran, ni salen en cofres, ni llevan acabado.
const page={};page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/avatar.js',import.meta.url),'utf8'),page);
const {Avatar}=page,plusPieces=Array.from(Avatar.CATALOG).filter(item=>item.plus);
assert.deepEqual(plusPieces.map(item=>item.for).sort(),['hombre','mujer']);
for(const item of plusPieces){assert.equal(item.price,0);assert.equal(PIECES.has(item.slot+':'+item.id),false);assert.equal(Avatar.rarity(item),'nivel');assert.equal(Avatar.finishable(item),false);assert.ok(!item.edition&&!item.level)}
// El navegador solo las da por tuyas con la suscripción, y sin publicidad no se enseña el anuncio.
const progress=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8');
assert.ok(progress.includes('const owns=item=>item.plus?plus:('));assert.ok(fs.readFileSync(new URL('../dist/ads.js',import.meta.url),'utf8').includes('if(window.Progress?.plus?.())return Promise.resolve(true);'));

// La migración: una tabla sin permisos públicos.
const file=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(name=>name.endsWith('_suscripciones.sql'));
const sql=fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
assert.ok(sql.includes('create table public.subscriptions'));assert.ok(sql.includes('alter table public.subscriptions enable row level security'));assert.ok(sql.includes('revoke all on table public.subscriptions from anon, authenticated'));

// Si el almacén falla, nadie tiene suscripción y nada se rompe.
assert.deepEqual(await createPlan({community:{async subscriptionOf(){throw Error('sin tabla')}},now:()=>0,log:()=>{}})('x'),{plus:false,until:null});
assert.deepEqual(await createPlan({community:{},now:()=>0})('x'),{plus:false,until:null});

const [first]=[...EDITIONS.values()].sort((a,b)=>a.from<b.from?-1:1),DAY=86400000;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-suscripcion-'));
let clock=Date.parse(first.from+'T09:00:00Z');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const store=fileStore(path.join(directory,'answers.json')),hashOf=player=>createHash('sha256').update(player).digest('hex');
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const state=async player=>(await post('progreso',{action:'estado'},player)).data,duel=(player,body)=>post('duelo',{player,name:'Jugador',...body});
// Juega un duelo contra el bot hasta que empieza (con eso ya cuenta para el tope).
async function playBot(player){
  const made=await duel(player,{action:'crear'});if(made.status!==200)return made;
  const bot=await duel(player,{action:'bot',id:made.data.id});assert.equal(bot.status,200);return made;
}
try{
  const luis=randomUUID(),ana=randomUUID(),anon=randomUUID();
  for(const player of [luis,ana])await post('progreso',{action:'guardar',state:{v:1,xp:4500},delta:first.price*4},player);

  // Sin suscripción: plan gratuito.
  let s=await state(luis);assert.deepEqual([s.plus,s.plusUntil,s.freeDuels],[false,null,5]);
  assert.deepEqual((await duel(luis,{action:'limite'})).data,{plus:false,limit:5,played:0});

  // El tope de duelos: cinco al día, con cuenta o sin ella. Uno que no llega a empezar no cuenta.
  assert.equal((await duel(anon,{action:'crear'})).status,200,'Crear y no jugar no gasta');
  assert.equal((await duel(anon,{action:'limite'})).data.played,0);
  for(const player of [luis,anon])for(let n=1;n<=PLAN.duels;n++){assert.equal((await playBot(player)).status,200,`Duelo ${n}`);assert.equal((await duel(player,{action:'limite'})).data.played,n)}
  for(const action of ['crear','buscar']){const stop=await duel(luis,{action});assert.equal(stop.status,403);assert.deepEqual([stop.data.code,stop.data.limit,stop.data.played],['limite',5,5]);assert.match(stop.data.error,/5 duelos/)}
  assert.equal((await duel(luis,{action:'unirse',code:'ABCDEF'})).data.code,'limite');assert.equal((await duel(anon,{action:'crear'})).data.code,'limite');
  // Lo que ya está en marcha se puede seguir: el tope solo mira al empezar.
  assert.equal((await duel(luis,{action:'activo'})).status,200);
  // Al día siguiente (hora de Madrid) hay otros cinco.
  clock+=DAY;assert.deepEqual((await duel(luis,{action:'limite'})).data,{plus:false,limit:5,played:0});assert.equal((await playBot(luis)).status,200);

  // Con la suscripción: sin tope de duelos, y el estado lo dice con su fecha.
  const until=clock+30*DAY;await store.community.setSubscription(hashOf(ana),until,'manual');
  s=await state(ana);assert.deepEqual([s.plus,s.plusUntil],[true,until]);
  assert.deepEqual((await duel(ana,{action:'limite'})).data,{plus:true,limit:null,played:0});
  for(let n=0;n<PLAN.duels+3;n++)assert.equal((await playBot(ana)).status,200);

  // En el mercado: tres anuncios activos en el plan gratuito, sin tope con la suscripción.
  assert.equal((await post('progreso',{action:'mercado'},luis)).data.rules.max,MARKET.max);assert.equal((await post('progreso',{action:'mercado'},ana)).data.rules.max,null);
  for(const player of [luis,ana])for(let serial=1;serial<=4;serial++)await store.community.addCollectible(first.id,(player===luis?0:10)+serial,hashOf(player));
  const sell=(player,serial)=>post('progreso',{action:'vender',edition:first.id,serial,buyNow:500},player);
  for(let serial=1;serial<=3;serial++)assert.equal((await sell(luis,serial)).status,200);assert.equal((await sell(luis,4)).data.code,'tope');
  for(let serial=11;serial<=14;serial++)assert.equal((await sell(ana,serial)).status,200,'Con suscripción caben más de tres');

  // Al caducar, vuelve al plan gratuito sin tocar nada: los anuncios puestos siguen, pero no caben más y vuelve el tope de duelos.
  clock=until+1000;s=await state(ana);assert.deepEqual([s.plus,s.plusUntil],[false,null]);
  assert.equal((await post('progreso',{action:'mercado'},ana)).data.rules.max,MARKET.max);
  assert.deepEqual((await duel(ana,{action:'limite'})).data,{plus:false,limit:5,played:0});
  // Renovar es cambiar la fecha.
  await store.community.setSubscription(hashOf(ana),clock+DAY,'manual');assert.equal((await state(ana)).plus,true);

  // Contra Supabase: una fila por jugador y los duelos de hoy.
  const calls=[],fake=async(url,init={})=>{const target=new URL(url);calls.push({path:target.pathname,query:Object.fromEntries(target.searchParams),method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    return Response.json(target.pathname.endsWith('/subscriptions')&&(init.method||'GET')==='GET'?[{until:'2026-12-20T09:00:00Z',source:'manual'}]:target.pathname.endsWith('/duels')?[{created_at:'2026-11-20T09:00:00Z'}]:[])};
  const remote=supabaseStore({url:'https://proyecto.supabase.co',key:'sb_secret_prueba',fetch:fake}),hash='c'.repeat(64),sent=()=>calls.at(-1);
  assert.deepEqual(await remote.community.subscriptionOf(hash),{until:Date.parse('2026-12-20T09:00:00Z'),source:'manual'});
  assert.deepEqual([sent().path,sent().query.player_hash,sent().query.limit],['/rest/v1/subscriptions','eq.'+hash,'1']);
  await remote.community.setSubscription(hash,Date.parse('2027-01-01T00:00:00Z'),'manual','x');
  assert.deepEqual([sent().method,sent().query.on_conflict,sent().body.player_hash,sent().body.until,sent().body.source,sent().body.ref],['POST','player_hash',hash,'2027-01-01T00:00:00.000Z','manual','x']);
  assert.deepEqual(await remote.duels.played(hash,Date.parse('2026-11-19T00:00:00Z')),[Date.parse('2026-11-20T09:00:00Z')]);
  assert.deepEqual([sent().query.status,sent().query.created_at,sent().query.state],['neq.waiting','gte.2026-11-19T00:00:00.000Z',`cs.${JSON.stringify({players:[{hash}]})}`]);

  console.log('suscripcion: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
