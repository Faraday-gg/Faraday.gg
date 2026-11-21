import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createArchivoVivo} from '../lib/archivo-vivo.mjs';
import {createContinuations,fileContinuations} from '../lib/continuaciones.mjs';
import {createApi} from '../lib/api.mjs';

const mode='archivo-vivo';
const database=fileContinuations();
const adKey='ad:practice';
const archiveScope='archivo-vivo-preview';
const rowDay='1970-01-01';
const sceneIds=['01','02','03','04','05','06','07','08','09'];
const initialIds=['04','01','03'];
const day='2026-11-21';
let time=Date.parse('2026-11-21T12:00:00Z');
const storedLimitation=/^(ad:(daily|trends|duel|duel3|ranked|practice)|daily:[a-f0-9-]{36})$/;
const store={
  ...database,
  async put(scope,date,player,key,...args){
    assert.match(scope,/^[a-z0-9-]{1,32}$/);
    assert.match(key,storedLimitation);
    return database.put(scope,date,player,key,...args);
  }
};
const make=()=>createArchivoVivo({store,scope:'preview',now:()=>time,sceneIds,initialIds,planOf:async player=>({plus:player==='suscriptor'})});
let archive=make();
const post=(action,extra={},player='invitado',signedIn=false)=>archive(player,{action,mode,...extra},signedIn);
const ref=run=>({id:run.id,index:run.index,date:run.date});
async function finish(run,player='invitado',signedIn=false){
  while(run.index<3){
    const answered=await post('archivo-responder',{...ref(run),guess:1940},player,signedIn);
    assert.equal(answered.guesses.length,run.index+1);
    run=await post('archivo-siguiente',ref(answered),player,signedIn);
  }
  return run;
}

await assert.rejects(post('preparar'),{status:409});
const opening=await post('archivo-estado');
assert.equal(opening.date,day);
assert.deepEqual(opening.scenes,initialIds);
assert.deepEqual(await post('archivo-estado'),opening,'Recargar conserva la partida');
await assert.rejects(post('archivo-extra',{from:opening.id}),{status:409});
await assert.rejects(post('archivo-siguiente',ref(opening)),{status:409});
await assert.rejects(post('archivo-responder',{...ref(opening),index:1,guess:1940}),{status:409});
await assert.rejects(post('archivo-responder',{...ref(opening),guess:1790}),{status:400});
const initial=await finish(opening);
await assert.rejects(post('archivo-extra',{from:initial.id}),{status:409});

const cancelled=await post('preparar');
assert.equal(cancelled.seconds,15);
await post('cancelar',{date:day,ticket:cancelled.ticket});
assert.equal((await post('estado')).watched,0);
await assert.rejects(post('completar',{date:day,ticket:cancelled.ticket}),{status:409});

const first=await post('preparar');
assert.equal(first.seconds,15);
time+=14999;
await assert.rejects(post('completar',{date:day,ticket:first.ticket}),{status:409});
time++;
await Promise.all(Array.from({length:4},()=>post('completar',{date:day,ticket:first.ticket})));
assert.equal((await post('estado')).watched,1);
archive=make();
const recovery=await post('preparar');
assert.equal(recovery.watch,false);
assert.equal(recovery.ticket,first.ticket);
const unlock={date:day,ticket:first.ticket,from:initial.id};
const [extra,duplicate]=await Promise.all([post('archivo-extra',unlock),post('archivo-extra',unlock)]);
assert.deepEqual(extra,duplicate,'Una operación concurrente recupera la misma partida');
assert.notEqual(extra.id,initial.id);
assert.equal(new Set([...extra.scenes,...initial.scenes]).size,6);
assert.deepEqual(await post('archivo-estado'),extra);
assert.deepEqual(await post('archivo-extra',{...unlock,id:extra.id}),extra);
assert.equal((await post('preparar')).id,extra.id);
await assert.rejects(post('archivo-extra',unlock,'otro'),{status:409});

const firstDone=await finish(extra);
await assert.rejects(post('archivo-extra',{...unlock,from:firstDone.id}),{status:409},'Un ad consumido no desbloquea la siguiente partida');
const second=await post('preparar');
assert.equal(second.seconds,60);
time+=59999;
await assert.rejects(post('completar',{date:day,ticket:second.ticket}),{status:409});
time++;
await post('completar',{date:day,ticket:second.ticket});
const thirdSet=await post('archivo-extra',{from:firstDone.id,ticket:second.ticket});
assert.equal(new Set([...initial.scenes,...extra.scenes,...thirdSet.scenes]).size,9);
assert.equal((await database.get(archiveScope,rowDay,'invitado',adKey)).state.ad.grants.length,2);
assert.equal(await database.get('preview',day,'invitado',adKey),null);
const shared=createContinuations({store:database,scope:'preview',now:()=>time});
assert.equal((await shared.status('invitado','practice')).watched,0);
assert.equal((await shared.status('invitado','duel')).seconds,15);

const adopted=await post('archivo-estado',{legacy:{index:2,guesses:[1938,1969,1985]}},'antiguo');
assert.equal(adopted.kind,'legacy');
assert.deepEqual(adopted.scenes,['01','02','03']);
assert.deepEqual(adopted.guesses,[1938,1969,1985]);
assert.deepEqual(await post('archivo-estado',{legacy:{index:0,guesses:[]}},'antiguo'),adopted);
assert.equal((await post('archivo-siguiente',ref(adopted),'antiguo')).index,3);

const subscriber=await finish(await post('archivo-estado',{},'suscriptor',true),'suscriptor',true);
const plusOffer=await post('preparar',{},'suscriptor',true);
assert.equal(plusOffer.watch,false);
assert.equal(plusOffer.plus,true);
assert.equal((await post('archivo-extra',{from:subscriber.id},'suscriptor',true)).kind,'extra');
assert.equal((await post('estado',{},'suscriptor',true)).watched,0);
assert.equal((await post('estado',{},'suscriptor',false)).plus,false,'Anonimato no activa Plus');

time=Date.parse('2026-11-21T23:00:00Z');
assert.equal((await post('estado')).watched,0);
assert.equal((await post('estado')).seconds,15);
const carried=await post('archivo-estado');
assert.equal(carried.id,thirdSet.id,'Una partida abierta sigue disponible tras medianoche');
assert.equal(carried.date,'2026-11-22');
assert.equal((await post('preparar')).id,thirdSet.id);
assert.equal((await post('archivo-responder',{...ref(thirdSet),guess:1848})).guesses[0],1848,'Una respuesta también puede cruzar medianoche');
await assert.rejects(post('completar',{date:day,ticket:second.ticket}),{status:409});
const carriedSummary=await finish(await post('archivo-estado'));
const free=await post('preparar');
assert.equal(free.watch,false);
assert.equal(free.free,true);
const newDay=await post('archivo-extra',{from:carriedSummary.id,date:carriedSummary.date});
assert.notEqual(newDay.id,thirdSet.id);
assert.equal(newDay.kind,'initial');
assert.equal((await post('estado')).watched,0);
await assert.rejects(post('preparar',{},'otro'),{status:409});
assert.equal((await post('archivo-estado',{},'otro')).kind,'initial');

// Ruta de Vercel/preview: identidad vigente y ámbito editorial aislado de las prácticas de Duelos.
const player=randomUUID(),hash=createHash('sha256').update(player).digest('hex');
let reads=0;
const routeStore={...store,get(...args){reads++;return store.get(...args)}};
const auth={
  async current(request,read){
    const signedPlayer=read(request,'faraday_sesion');
    return signedPlayer?{account:{id:'cuenta-'+signedPlayer,player:signedPlayer},cookies:[]}:null;
  }
};
const api=createApi({store:{continuations:routeStore},persistDays:false,trendScope:'preview',now:()=>time,auth,log:()=>{}});
const readOnly=await api.handle(new Request('http://faraday.test/api/continuacion'));
assert.equal(readOnly.status,405);
assert.equal(reads,0);
const request=(action,extra={},signedPlayer)=>api.handle(new Request('http://faraday.test/api/continuacion',{
  method:'POST',headers:{'Content-Type':'application/json',
    cookie:'faraday_jugador='+player+(signedPlayer?'; faraday_sesion='+signedPlayer:'')},
  body:JSON.stringify({action,mode,...extra})
}));
const localResponse=await request('archivo-estado');
assert.equal(localResponse.status,200);
const localRun=await localResponse.json();
assert.deepEqual((await store.get(archiveScope,rowDay,hash,adKey)).state.run.scenes,localRun.scenes);
assert.equal((await request('preparar')).status,409);

const accountA=randomUUID(),accountB=randomUUID();
const openAs=async account=>(await request('archivo-estado',{},account)).json();
const runA=await openAs(accountA);
const runB=await openAs(accountB);
assert.equal(new Set([localRun.id,runA.id,runB.id]).size,3,'La sesión firmada separa las partidas incluso con la misma cookie visitante');
assert.equal((await request('archivo-responder',{...ref(runA),guess:1890},accountB)).status,409);
assert.equal((await request('archivo-responder',{...ref(runA),guess:1890},accountA)).status,200);
assert.deepEqual((await openAs(accountA)).guesses,[1890]);
assert.deepEqual((await openAs(accountB)).guesses,[]);
assert.deepEqual((await openAs()).guesses,[]);

let outage=true;
const flakyApi=createApi({store:{continuations:{...store,async get(...args){
  if(outage){outage=false;throw Error('Fallo temporal de prueba')}
  return store.get(...args);
}}},persistDays:false,trendScope:'preview',now:()=>time,log:()=>{}});
const reconnect=()=>flakyApi.handle(new Request('http://faraday.test/api/continuacion',{
  method:'POST',headers:{'Content-Type':'application/json',cookie:'faraday_jugador='+player},
  body:JSON.stringify({action:'archivo-estado',mode})
}));
assert.equal((await reconnect()).status,503);
assert.equal((await (await reconnect()).json()).id,localRun.id,'Después de un fallo de conexión, el mismo inicio recupera la partida');

console.log('Archivo Vivo: anuncios 15/60, reanudación, catálogo, aislamiento, versión anterior y Plus correctos');
