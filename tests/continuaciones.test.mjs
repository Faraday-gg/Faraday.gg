import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createContinuations,fileContinuations,CONTINUATION_MODES} from '../lib/continuaciones.mjs';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {memoryDuels} from '../lib/duelos.mjs';
import {getDay} from '../content-engine.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'faraday-continuaciones-'));
let clock=Date.parse('2026-11-19T10:00:00Z');
const hash=player=>createHash('sha256').update(player).digest('hex'),day='2026-11-19';
try{
  const adStore=fileContinuations(path.join(directory,'ads.json'));
  let ads=createContinuations({store:adStore,now:()=>clock});
  for(const mode of CONTINUATION_MODES)assert.equal((await ads.status('player',mode)).seconds,15);
  const cancelled=await ads.prepare('player','duel');await ads.handle('player',{action:'cancelar',mode:'duel',ticket:cancelled.ticket});
  assert.equal((await ads.status('player','duel')).watched,0);
  const first=await ads.prepare('player','duel');assert.equal(first.seconds,15);
  clock+=14999;await assert.rejects(ads.complete('player','duel',first.ticket),{status:409});
  clock++;await Promise.all(Array.from({length:4},()=>ads.complete('player','duel',first.ticket)));
  assert.equal((await ads.status('player','duel')).watched,1);
  const second=await ads.prepare('player','duel');assert.equal(second.seconds,60);
  clock+=15000;await assert.rejects(ads.complete('player','duel',second.ticket),{status:409});
  clock+=45000;await ads.complete('player','duel',second.ticket);
  assert.equal((await ads.status('player','duel3')).seconds,15,'Primer anuncio independiente por modalidad');
  // Persistencia, repeticiones ilimitadas y duración constante de los anuncios largos.
  ads=createContinuations({store:fileContinuations(path.join(directory,'ads.json')),now:()=>clock});
  for(let game=0;game<25;game++){
    const ad=await ads.prepare('player','duel');assert.equal(ad.seconds,60);clock+=60000;await ads.complete('player','duel',ad.ticket);
  }
  assert.equal(await ads.duelBonus('player'),27);
  await assert.rejects(ads.complete('other','duel',first.ticket),{status:409});
  await assert.rejects(ads.complete('player','trends',first.ticket),{status:409});
  const trend=await ads.prepare('player','trends');clock+=15000;await ads.complete('player','trends',trend.ticket);
  await Promise.all(Array.from({length:3},()=>ads.consume('player','trends',trend.ticket,'trends:1')));
  await assert.rejects(ads.consume('player','trends',trend.ticket,'trends:2'),{status:409});
  const oldTicket=await ads.prepare('player','ranked');clock=Date.parse('2026-11-19T23:00:01Z');
  assert.equal((await ads.status('player','duel')).watched,0,'Reinicio a medianoche de Madrid');
  await assert.rejects(ads.complete('player','ranked',oldTicket.ticket),{status:409});

  clock=Date.parse('2026-11-19T10:00:00Z');
  const store=fileStore(path.join(directory,'api','answers.json')),duels=memoryDuels();
  const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'prueba@example.test',player},cookies:[]}:null}};
  const api=createApi({store:{...store,duels},persistDays:false,now:()=>clock,auth,log:()=>{}});
  async function post(route,player,body){
    const headers={'Content-Type':'application/json',cookie:`faraday_sesion=${player}`};
    const response=await api.handle(new Request('http://faraday.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
    return {status:response.status,data:await response.json()};
  }
  const ad=(player,action,mode,extra={})=>post('continuacion',player,{action,mode,...extra});
  const duel=(player,action,extra={})=>post('duelo',player,{player,action,name:'Prueba',...extra});
  async function watch(player,mode,seconds){
    const pending=await ad(player,'preparar',mode);assert.equal(pending.status,200);assert.equal(pending.data.seconds,seconds);
    clock+=seconds*1000;
    assert.equal((await ad(player,'completar',mode,{date:day,ticket:pending.data.ticket})).status,200);
    return pending.data.ticket;
  }
  const player=randomUUID();
  for(let index=0;index<5;index++)await duels.create({id:randomUUID(),code:'AAAAA'+index,status:'finished',createdAt:clock,seenAt:clock,
    players:[{hash:hash(player),name:'Prueba',hp:1},{hash:'other-'+index,name:'Ejemplo',hp:0}],questions:['q'],rounds:[],winner:0});
  assert.equal((await duel(player,'crear')).status,403);
  const ticket=await watch(player,'duel3',15);
  assert.deepEqual((await duel(player,'limite')).data,{plus:false,limit:6,played:5});
  await ad(player,'completar','duel3',{date:day,ticket});assert.equal((await duel(player,'limite')).data.limit,6);
  const made=await duel(player,'crear',{size:3});assert.equal(made.status,200);
  await duel(randomUUID(),'unirse',{code:made.data.code});await duel(randomUUID(),'unirse',{code:made.data.code});
  assert.equal((await duel(player,'limite')).data.played,6);assert.equal((await duel(player,'crear')).status,403);
  await watch(player,'ranked',15);
  assert.equal((await duel(player,'buscar',{mode:'ranked',level:1})).status,403,'El anuncio no quita el desbloqueo por nivel');

  const learner=randomUUID();
  assert.equal((await ad(learner,'preparar','daily')).status,409);
  const official=getDay(day,{persist:false});
  for(const question of official.questions)assert.equal((await post('answers',learner,{player:learner,question:question.id,guess:question.answer})).status,200);
  const normalBefore=await store.byPlayer(hash(learner));
  const dailyTicket=await watch(learner,'daily',15);
  const created=await ad(learner,'reto-extra','daily',{ticket:dailyTicket});assert.equal(created.status,200);
  assert.equal(created.data.practice,true);assert.equal(created.data.questions.length,3);
  assert(created.data.questions.every(q=>!official.questions.some(other=>other.id===q.id)));
  const id=created.data.id;
  const resume=await ad(learner,'preparar','daily');assert.equal(resume.data.watch,false);assert.equal(resume.data.id,id);
  assert.equal((await ad(learner,'responder-extra','daily',{id,index:2,guess:1})).status,409);
  for(let index=0;index<3;index++){
    const response=await ad(learner,'responder-extra','daily',{id,index,guess:created.data.questions[index].answer});
    assert.equal(response.status,200);assert.equal(response.data.guesses.length,index+1);
  }
  const duplicate=await ad(learner,'responder-extra','daily',{id,index:0,guess:999});
  assert.equal(duplicate.data.guesses[0],created.data.questions[0].answer,'La primera respuesta se conserva');
  assert.deepEqual(await store.byPlayer(hash(learner)),normalBefore,'Las prácticas no contaminan respuestas oficiales');
  assert.equal(await store.community.progress(hash(learner)),null,'No hay faradios ni premios por prácticas');
  assert.equal((await ad(learner,'preparar','daily')).data.seconds,60);
  assert.equal((await ad(player,'reto-extra','daily',{ticket:dailyTicket})).status,409,'No se puede usar el recibo ajeno');
  await store.community.setSubscription(hash(learner),clock+86400000);
  assert.equal((await ad(learner,'preparar','daily')).data.watch,false);
  const paid=await ad(learner,'reto-extra','daily');assert.equal(paid.status,200);assert.notEqual(paid.data.id,id);
  assert.equal((await ad(learner,'estado','daily')).data.watched,1,'Plus no cuenta como anuncio');
  console.log('continuaciones: 15/60 s, ilimitadas, cuotas, concurrencia, persistencia, Plus y prácticas sin premios correctos');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
