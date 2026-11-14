// Prueba las preguntas de la comunidad y el progreso con cuenta (lib/comunidad.mjs, decisión 0049) a través de la API,
// con un reloj controlado y una cuenta falsa: no usa red ni OpenAI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {RULES,openRound,closesOn,checkProposal,communityDay,memoryCommunity} from '../lib/comunidad.mjs';
import {generateDay} from '../lib/generar.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-comunidad-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-16');

// Cuenta falsa: la cookie «faraday_sesion» lleva el UUID del jugador de la cuenta.
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
let moderation=null;
const store=fileStore(path.join(directory,'answers.json'));
const api=createApi({store,persistDays:false,now:()=>clock,auth,log:()=>{},moderate:async proposal=>moderation?moderation(proposal):{ok:true,reason:'',title:proposal.title,unit:proposal.unit}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const community=(action,player,extra={})=>post('comunidad',{action,...extra},player);
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const ask=(player,title,extra={})=>community('proponer',player,{title,unit:'metros',name:'Luis',avatar:{body:'hombre',hat:'gorra',evil:'<x>'},...extra});

try{
  // Rondas: la del lunes R se vota del domingo R−8 al sábado R−2.
  assert.equal(openRound('2026-11-16'),'2026-11-23','El lunes se vota la ronda del lunes siguiente');
  assert.equal(openRound('2026-11-21'),'2026-11-23','El sábado sigue abierta');
  assert.equal(openRound('2026-11-22'),'2026-11-30','El domingo empieza la siguiente');
  assert.equal(closesOn('2026-11-23'),'2026-11-21');
  assert.equal(checkProposal({title:'cuántos metros mide la torre Eiffel',unit:'metros'}).title,'¿Cuántos metros mide la torre Eiffel?');
  assert.ok(checkProposal({title:'corta',unit:'m'}).error);
  assert.ok(checkProposal({title:'¿Qué hay en https://x.com hoy?',unit:'m'}).error,'Sin enlaces');

  const luis=randomUUID(),ana=randomUUID(),eva=randomUUID();

  // Sin cuenta se ve la ronda, pero no se propone, ni se vota, ni se guarda progreso.
  let r=await community('ronda');
  assert.equal(r.status,200);assert.equal(r.data.round,'2026-11-23');assert.equal(r.data.account,false);assert.deepEqual(r.data.proposals,[]);
  assert.equal((await ask(null,'¿Cuántos metros mide la torre Eiffel?')).status,401);
  assert.equal((await progress('guardar',null,{state:{v:1},delta:100})).status,401);

  // Progreso con cuenta: la primera vez se acepta el saldo (con tope); después, las ganancias tienen tope diario.
  assert.deepEqual((await progress('leer',luis)).data,{state:null,coins:null});
  r=await progress('guardar',luis,{state:{v:1,xp:50,coins:999999},delta:300});
  assert.equal(r.data.coins,300,'La primera vez entra lo que dice el navegador');
  r=await progress('leer',luis);assert.equal(r.data.coins,300);assert.equal(r.data.state.xp,50);assert.equal(r.data.state.coins,undefined,'El saldo no va dentro del estado');
  r=await progress('guardar',luis,{state:{v:1,xp:60},delta:RULES.dailyGain+5000});
  assert.equal(r.data.coins,300+RULES.dailyGain,'Tope diario de ganancias');
  r=await progress('guardar',luis,{state:{v:1,xp:60},delta:100});
  assert.equal(r.data.coins,300+RULES.dailyGain,'Tope ya gastado hoy');
  r=await progress('guardar',luis,{state:{v:1,xp:60},delta:-200});
  assert.equal(r.data.coins,100+RULES.dailyGain,'Gastar siempre resta');
  clock=at('2026-11-17');
  r=await progress('guardar',luis,{state:{v:1,xp:70},delta:100});assert.equal(r.data.coins,200+RULES.dailyGain,'Al día siguiente vuelve a haber tope');
  assert.equal((await progress('guardar',luis,{state:[1,2],delta:0})).status,400);
  assert.equal((await post('progreso',{action:'guardar',state:{big:'x'.repeat(RULES.stateBytes)},delta:0},luis)).status,413);

  // Proponer: cobra, limpia el nombre y el avatar, y tiene tope por ronda.
  await progress('guardar',ana,{state:{v:1},delta:RULES.voteCost*2});
  assert.equal((await ask(ana,'¿Cuántos metros mide la torre Eiffel?')).data.code,'saldo','Ana no llega a 50');
  r=await ask(luis,'¿Cuántos metros mide la torre Eiffel?',{name:'  Luis <>  '});
  assert.equal(r.status,200);assert.equal(r.data.coins,200+RULES.dailyGain-RULES.proposeCost);
  assert.equal((await ask(luis,'Pregunta sin nombre de autor',{name:'  '})).status,400);
  moderation=async()=>({ok:false,reason:'No tiene una cifra única.',title:'',unit:''});
  r=await ask(luis,'¿Cuál es la mejor canción de la historia?');
  assert.equal(r.status,422);assert.equal(r.data.error,'No tiene una cifra única.');
  moderation=null;
  assert.equal((await progress('leer',luis)).data.coins,200+RULES.dailyGain-RULES.proposeCost,'Si se rechaza no se cobra');
  await ask(luis,'¿Cuántos litros de agua caben en una piscina olímpica?');
  await ask(luis,'¿Cuántos pasos hay de Madrid a Lisboa?');
  assert.equal((await ask(luis,'¿Cuántas hojas tiene un roble adulto?')).data.code,'limite');

  r=await community('ronda',ana);
  assert.equal(r.data.proposals.length,3);assert.equal(r.data.coins,RULES.voteCost*2);
  const [eiffel,piscina,pasos]=r.data.proposals;
  assert.equal(eiffel.name,'Luis');assert.deepEqual(eiffel.avatar,{body:'hombre',hat:'gorra'});assert.equal(eiffel.mine,false);
  assert.equal(r.data.proposals.some(p=>'player' in p),false,'No se enseña el jugador del autor');

  // Votar: cobra, una vez por pregunta y nunca la propia.
  r=await community('votar',ana,{id:piscina.id});assert.equal(r.status,200);assert.equal(r.data.votes,1);assert.equal(r.data.coins,RULES.voteCost);
  assert.equal((await community('votar',ana,{id:piscina.id})).data.code,'repetido');
  assert.equal((await community('votar',luis,{id:piscina.id})).data.code,'propia');
  assert.equal((await community('votar',ana,{id:randomUUID()})).data.code,'no-existe');
  await community('votar',ana,{id:pasos.id});
  assert.equal((await community('votar',ana,{id:eiffel.id})).data.code,'saldo');
  await progress('guardar',eva,{state:{v:1},delta:100});
  await community('votar',eva,{id:piscina.id});
  r=await community('ronda',ana);
  assert.deepEqual(r.data.proposals.map(p=>[p.title,p.votes,p.voted]),[
    ['¿Cuántos litros de agua caben en una piscina olímpica?',2,true],['¿Cuántos pasos hay de Madrid a Lisboa?',1,true],['¿Cuántos metros mide la torre Eiffel?',0,false]]);
  assert.equal((await community('ronda',luis)).data.proposals[0].mine,true);

  // Domingo: la ronda se cierra (no se puede votar) y empieza la siguiente.
  clock=at('2026-11-22');
  assert.equal((await community('votar',eva,{id:eiffel.id})).data.code,'cerrada');
  r=await community('ronda',ana);assert.equal(r.data.round,'2026-11-30');assert.equal(r.data.previous.round,'2026-11-23');assert.equal(r.data.previous.resolved,false);

  // Resolución del lunes: solo las que tienen votos; las que la IA no puede resolver se saltan y se completa con el banco.
  const sample={category:'naturaleza',ambito:'mundial',tag:'Piscina olímpica',detail:'Llena hasta arriba.',unit:'litros',answer:2500000,math:'50 × 25 × 2 m³',referenceExpression:'50 × 25 × 2 × 1000',
    assumptions:'Profundidad mínima.',confidence:'Dato documentado + cálculo',sources:[{title:'World Aquatics · Reglas',url:'https://www.worldaquatics.com/',fact:'50 × 25 m y 2 m de fondo'}],
    reasoning:{heading:'De metros a litros',steps:['A ojo','Orden de magnitud','Afinar']},calc:{intro:'Volumen en litros.',rows:[{label:'Volumen',value:'2.500 m³'},{label:'Litros por m³',value:'× 1.000'}],result:'Litros'},actualidad:false};
  const seen=[];
  const chosen=await communityDay({date:'2026-11-23',community:store.community,checkUrls:false,log:()=>{},now:new Date(clock),
    resolve:async candidates=>{seen.push(...candidates.map(c=>c.title));return candidates.map(c=>c.title.includes('piscina')?{id:c.id,ok:true,reason:'',question:{...sample,title:c.title}}:{id:c.id,ok:false,reason:'Sin datos',question:sample})}});
  assert.deepEqual(seen,['¿Cuántos litros de agua caben en una piscina olímpica?','¿Cuántos pasos hay de Madrid a Lisboa?'],'Sin votos no se resuelve');
  assert.equal(chosen.day.questions.length,3);
  const [first,...rest]=chosen.day.questions;
  assert.equal(first.id,'comunidad-2026-11-23-1');assert.deepEqual(first.author,{name:'Luis',avatar:{body:'hombre',hat:'gorra'}});assert.equal(first.community.votes,2);
  assert.ok(rest.every(q=>!q.author&&q.id.startsWith('comunidad-2026-11-23-')),'El resto sale del banco editorial');
  const before=(await progress('leer',luis)).data.coins;
  await chosen.done();
  assert.equal((await progress('leer',luis)).data.coins,before+RULES.authorPrize,'Premio para el autor');
  clock=at('2026-11-23');
  r=await community('ronda',ana);assert.equal(r.data.previous.resolved,true);assert.deepEqual(r.data.previous.winners.map(p=>p.title),['¿Cuántos litros de agua caben en una piscina olímpica?']);

  // Sin propuestas votadas no hay jornada de la comunidad.
  assert.equal(await communityDay({date:'2026-11-30',community:memoryCommunity(),resolve:async()=>[],log:()=>{}}),null);

  // generateDay: los lunes prueba antes con la comunidad; los demás días ni la mira.
  let asked=0;const saved=[];
  const fakeStore={async dayInfo(){return null},async saveGeneratedDay(day){saved.push(day)}};
  const fromCommunity={day:{id:'2027-03-01',questions:[{title:'¿A?'}]},done:async()=>{asked++}};
  r=await generateDay({date:'2027-03-01',store:fakeStore,apiKey:'x',log:()=>{},community:async()=>fromCommunity});
  assert.equal(r.reason,'preguntas de la comunidad');assert.equal(saved[0],fromCommunity.day);assert.equal(asked,1);
  await assert.rejects(generateDay({date:'2027-03-02',store:fakeStore,apiKey:'x',log:()=>{},attempts:1,fetch:async()=>{throw Error('sin red')},community:async()=>{asked+=10;return fromCommunity}}),/sin red/);
  assert.equal(asked,1,'Un martes no se usa la comunidad');

  console.log('comunidad: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
