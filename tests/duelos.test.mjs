// Prueba los duelos 1 vs 1 (lib/duelos.mjs) a través de la API, con un reloj controlado: no espera ni usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {RULES,points,multiplier} from '../lib/duelos.mjs';
import {editorialDays} from '../content-engine.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-duelos-'));
const answers=new Map(editorialDays.flatMap(day=>day.questions.map(q=>[q.id,q.answer])));
let clock=Date.parse('2026-11-11T10:00:00Z'),seed=7;
const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
function build(store){
  const api=createApi({store,persistDays:false,now:()=>clock,random,log:()=>{}});
  return async(action,player,extra={},init={})=>{
    const response=await api.handle(new Request('http://casi.test/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,player,...extra}),...init}));
    return {status:response.status,data:await response.json()};
  };
}
try{
  // Reglas: puntos por distancia en escala logarítmica y multiplicador de daño.
  assert.equal(points(100,100),5000);assert.equal(points(200,100),points(50,100),'El doble y la mitad puntúan igual');
  assert.equal(points(200,100),3997);assert.equal(points(1e6,100),0);assert.equal(points(-1,100),0);
  assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(multiplier),[.2,.3,.4,.5,.6,.8,1,1.25,1.5,2]);
  for(let r=2;r<=RULES.maxRounds;r++)assert(multiplier(r)>multiplier(r-1),'el daño sube en cada ronda');
  // Nadie cae en las tres primeras rondas aunque las pierda todas por 5000 a 0.
  assert([1,2,3].reduce((sum,r)=>sum+RULES.maxPoints*multiplier(r),0)<RULES.maxHp);

  const duel=build(fileStore(path.join(directory,'answers.json')));
  const ana=randomUUID(),luis=randomUUID(),otra=randomUUID();

  // Partida rápida: la primera persona espera y la segunda se empareja con ella.
  let a=await duel('buscar',ana,{name:'Ana <b>',avatar:{body:'mujer',hat:'gorra',top:'<script>',otra:'x',badge:'racha-3'},level:4});
  assert.deepEqual(a.data.players[0].avatar,{body:'mujer',hat:'gorra',badge:'racha-3'},'Del avatar solo se guardan piezas con identificador válido');
  assert.equal(a.status,200);assert.equal(a.data.status,'waiting');assert.equal(a.data.players[0].name,'Ana b','El nombre se limpia');
  const id=a.data.id;
  let b=await duel('buscar',luis,{name:'Luis',avatar:99});
  assert.equal(b.data.id,id,'Se une al duelo que estaba esperando');assert.equal(b.data.phase,'intro');assert.equal(b.data.you,1);assert.deepEqual(b.data.players[1].avatar,{},'Un avatar no válido se queda en el de por defecto');
  assert.deepEqual(b.data.players.map(p=>p.hp),[RULES.maxHp,RULES.maxHp]);
  assert.equal((await duel('estado',otra,{id})).status,403,'Un tercero no puede mirar el duelo');
  assert.equal((await duel('responder',ana,{id,guess:10})).status,409,'No se responde antes de que empiece la ronda');

  // Pregunta: 3 minutos, sin la cifra real a la vista.
  clock+=RULES.introMs;
  a=await duel('estado',ana,{id});
  assert.equal(a.data.phase,'question');assert.equal(a.data.round.deadline-a.data.round.startsAt,RULES.roundMs);assert.equal(a.data.round.rushed,false);
  assert(!('answer' in a.data.round)&&!('answer' in a.data.round.question)&&!('guesses' in a.data.round),'La cifra real no viaja durante la pregunta');
  const real=answers.get(a.data.round.question.id);assert(real>0);

  // Ana responde a los 20 s: a Luis le quedan 30 s y sabe que Ana ha respondido, pero no qué.
  clock+=20000;
  a=await duel('responder',ana,{id,guess:real*2});
  assert.equal(a.data.round.yourGuess,real*2);assert.deepEqual(a.data.round.answered,[true,false]);
  b=await duel('estado',luis,{id});
  assert.equal(b.data.round.rushed,true);assert.equal(b.data.round.deadline,clock+RULES.rushMs);assert.equal(b.data.round.yourGuess,null);assert(!('guesses' in b.data.round));
  assert.equal((await duel('responder',ana,{id,guess:real})).data.round.yourGuess,real*2,'La primera respuesta es la que vale');

  // Luis no responde: al acabar el tiempo pierde tantos puntos de vida como puntos sacó Ana.
  clock+=RULES.rushMs+RULES.graceMs;
  b=await duel('estado',luis,{id});
  assert.equal(b.data.phase,'reveal');assert.deepEqual(b.data.round.points,[3997,0]);assert.equal(b.data.round.damage,799);assert.equal(b.data.round.loser,'you');
  assert.equal(b.data.round.answer,real);assert.deepEqual(b.data.players.map(p=>p.hp),[6000,5201]);
  assert.equal((await duel('responder',luis,{id,guess:real})).status,409,'Fuera de tiempo');

  // Rondas 2 a 4: responden los dos y el resultado sale al momento. Ana clava todas y Luis falla por 100×:
  // el daño crece (1500, 2000, 2500) y Luis aguanta hasta la cuarta, donde cae por K.O.
  const seen=new Set([a.data.round.question.id]);
  for(const [number,hp] of [[2,3701],[3,1701],[4,0]]){
    clock+=RULES.revealMs;
    b=await duel('estado',luis,{id});assert.equal(b.data.phase,'question');assert.equal(b.data.round.number,number);
    const real2=answers.get(b.data.round.question.id);assert(!seen.has(b.data.round.question.id));seen.add(b.data.round.question.id);
    clock+=5000;await duel('responder',luis,{id,guess:real2*100});
    clock+=5000;a=await duel('responder',ana,{id,guess:real2});
    assert.equal(a.data.players[1].hp,hp);
    if(hp)assert.equal(a.data.phase,'reveal'),assert.equal(a.data.round.nextMultiplier,multiplier(number+1));
  }
  assert.equal(a.data.phase,'finished');assert.equal(a.data.winner,'you');assert.equal(a.data.reason,'ko');assert.equal(a.data.rounds.length,4);
  b=await duel('estado',luis,{id});assert.equal(b.data.winner,'rival');assert.equal(b.data.round.loser,'you');

  // Revancha: Ana la pide, Luis la ve en el duelo terminado y la acepta.
  a=await duel('revancha',ana,{id,name:'Ana'});assert.equal(a.data.status,'waiting');assert.equal(a.data.public,false);
  b=await duel('estado',luis,{id});assert.equal(b.data.next,a.data.code);
  b=await duel('revancha',luis,{id,name:'Luis'});assert.equal(b.data.id,a.data.id);assert.equal(b.data.phase,'intro');

  // Abandonar da la victoria al rival.
  b=await duel('salir',luis,{id:b.data.id});assert.equal(b.data.winner,'rival');assert.equal(b.data.reason,'abandono');

  // Duelo privado con código.
  a=await duel('crear',ana,{name:'Ana'});const code=a.data.code;assert.match(code,/^[A-Z2-9]{6}$/);
  assert.equal((await duel('buscar',otra,{name:'Otra'})).data.status,'waiting','Un duelo privado no entra en la partida rápida');
  assert.equal((await duel('unirse',luis,{code:'ZZZZZZ'})).status,404);assert.equal((await duel('unirse',luis,{code:'x'})).status,400);
  b=await duel('unirse',luis,{code:code.toLowerCase(),name:'Luis'});assert.equal(b.data.phase,'intro');
  assert.equal((await duel('unirse',randomUUID(),{code})).status,409,'Un duelo en marcha no admite a nadie más');
  assert.equal((await duel('unirse',ana,{code})).data.you,0,'Quien ya está dentro vuelve a su sitio');

  // Una espera abandonada deja de ofrecerse.
  clock+=RULES.freshMs+1000;
  const sola=await duel('buscar',randomUUID(),{name:'Sola'});assert.equal(sola.data.status,'waiting');assert.equal(sola.data.players.length,1);

  // Bot de práctica: responde solo y recorta el tiempo de la persona.
  a=await duel('crear',ana,{name:'Ana'});a=await duel('bot',ana,{id:a.data.id});
  assert.equal(a.data.players[1].bot,true);assert.equal(a.data.phase,'intro');
  clock+=RULES.introMs;
  for(let second=0;second<60&&!a.data.round?.answered[1];second++){clock+=1000;a=await duel('estado',ana,{id:a.data.id})}
  assert.equal(a.data.phase,'question');assert.deepEqual(a.data.round.answered,[false,true]);assert.equal(a.data.round.rushed,true);
  clock+=RULES.rushMs+RULES.graceMs;a=await duel('estado',ana,{id:a.data.id});
  assert.equal(a.data.phase,'reveal');assert.equal(a.data.round.loser,'you');assert(a.data.round.damage>0);
  // Si nadie vuelve, el duelo termina solo al agotar las rondas.
  clock+=3600000;a=await duel('estado',ana,{id:a.data.id});assert.equal(a.data.status,'finished');
  const cancel=await duel('crear',ana,{});assert.equal((await duel('salir',ana,{id:cancel.data.id})).data.reason,'cancelado');

  // Validación.
  assert.equal((await duel('estado','nadie',{id})).status,400);assert.equal((await duel('estado',ana,{id:'x'})).status,400);
  assert.equal((await duel('estado',ana,{id:randomUUID()})).status,404);assert.equal((await duel('bailar',ana)).status,400);
  assert.equal((await duel('responder',ana,{id,guess:-3})).status,400);
  assert.equal((await duel('estado',ana,{id},{headers:{'Content-Type':'application/json',origin:'https://otra.test'}})).status,403,'Origen ajeno');

  // Reconectar a la partida (decisión 0039): el servidor dice si el jugador tiene un duelo en marcha.
  const [p1,p2,p3]=[randomUUID(),randomUUID(),randomUUID()];
  assert.equal((await duel('activo',p1)).data.active,null,'Sin duelos, no hay nada que reconectar');
  assert.equal((await duel('activo','no-es-un-jugador')).status,400);
  let w=await duel('crear',p1,{name:'Pía'});
  let r=await duel('activo',p1);
  assert.equal(r.data.active.id,w.data.id);assert.equal(r.data.active.status,'waiting');assert.equal(r.data.active.code,w.data.code,'Un reto con código en espera se puede retomar');
  assert.equal((await duel('activo',p2)).data.active,null,'Solo lo ve quien participa');
  clock+=RULES.waitingMs+1000;
  assert.equal((await duel('activo',p1)).data.active,null,'Una espera abandonada hace rato ya no se ofrece');
  w=await duel('buscar',p1,{name:'Pía'});w=await duel('buscar',p2,{name:'Quim'});
  clock+=RULES.introMs+30000;
  r=await duel('activo',p1);
  assert.equal(r.data.active.id,w.data.id);assert.equal(r.data.active.status,'playing');assert.equal(r.data.active.phase,'question');assert.equal(r.data.active.you,0);assert.equal(r.data.active.round,1);
  assert.equal(r.data.active.rival.name,'Quim');assert.deepEqual(r.data.active.hp,[RULES.maxHp,RULES.maxHp]);
  assert(!JSON.stringify(r.data).includes('answer'),'Reconectar no filtra la cifra real');
  assert.equal((await duel('activo',p2)).data.active.you,1);assert.equal((await duel('activo',p3)).data.active,null);
  // Con el duelo en marcha se vuelve a él con «estado» y se ve la ronda actual, no una nueva.
  assert.equal((await duel('estado',p1,{id:w.data.id})).data.round.number,1);
  // Salir a propósito es rendirse: quien se fue no vuelve a verlo; el rival ve cómo acabó.
  await duel('salir',p1,{id:w.data.id});
  assert.equal((await duel('activo',p1)).data.active,null,'Quien se rinde no ve «Reconectar»');
  r=await duel('activo',p2);assert.equal(r.data.active.status,'finished');assert.equal(r.data.active.winner,'you');assert.equal(r.data.active.reason,'abandono');
  clock+=RULES.resultMs+1000;
  assert.equal((await duel('activo',p2)).data.active,null,'El resultado caduca');
  // Un duelo que termina por el reloj mientras estás fuera: sigue disponible para ver el resultado.
  w=await duel('crear',p3,{name:'Ona'});await duel('bot',p3,{id:w.data.id});
  assert.equal((await duel('activo',p3)).data.active.status,'playing');
  clock+=RULES.maxRounds*(RULES.roundMs+RULES.revealMs);
  r=await duel('activo',p3);assert.equal(r.data.active.status,'finished');assert.equal(r.data.active.winner,'rival','El bot respondió y tú no');assert.equal(r.data.active.rival.bot,true);
  assert.equal((await duel('estado',p3,{id:w.data.id})).data.phase,'finished');
  // Un duelo cancelado (nadie llegó) no se ofrece.
  w=await duel('crear',p1,{});await duel('salir',p1,{id:w.data.id});
  assert.equal((await duel('activo',p1)).data.active,null,'Un duelo cancelado no se ofrece');

  // Almacén de Supabase contra una tabla duels simulada: control de versión y fallo si la tabla no existe.
  const rows=new Map();
  const fake=async(input,init={})=>{
    const url=new URL(input),eq=key=>url.searchParams.get(key)?.replace(/^eq\./,'');
    assert.equal(new Headers(init.headers).get('apikey'),'clave');assert.equal(url.pathname,'/rest/v1/duels');
    if(init.method==='POST'){const row=JSON.parse(init.body);if([...rows.values()].some(r=>r.code===row.code))return new Response('{}',{status:409});rows.set(row.id,row);return new Response(null,{status:201})}
    if(init.method==='PATCH'){const row=rows.get(eq('id'));if(!row||row.version!==Number(eq('version')))return Response.json([]);Object.assign(row,JSON.parse(init.body));return Response.json([{version:row.version}])}
    let found=[...rows.values()];
    const contains=url.searchParams.get('state');
    if(contains)found=found.filter(r=>r.state.players.some(p=>p.hash===JSON.parse(contains.replace(/^cs\./,'')).players[0].hash)&&r.updated_at>=url.searchParams.get('updated_at').replace(/^gte\./,''));
    if(eq('id'))found=found.filter(r=>r.id===eq('id'));if(eq('code'))found=found.filter(r=>r.code===eq('code'));
    if(eq('status'))found=found.filter(r=>r.status===eq('status')&&r.public&&r.updated_at>=url.searchParams.get('updated_at').replace(/^gte\./,''));
    return Response.json(found.map(({state,version})=>({state,version})));
  };
  const remote=build(supabaseStore({url:'https://x.supabase.co',key:'clave',fetch:fake}));
  a=await remote('buscar',ana,{name:'Ana'});b=await remote('buscar',luis,{name:'Luis'});
  assert.equal(b.data.id,a.data.id);assert.equal(rows.get(a.data.id).status,'playing');assert.equal(rows.get(a.data.id).version,2);
  clock+=RULES.introMs;a=await remote('responder',ana,{id:a.data.id,guess:5});assert.deepEqual(a.data.round.answered,[true,false]);assert.equal(rows.get(a.data.id).version,3);
  r=await remote('activo',ana);assert.equal(r.data.active.id,a.data.id);assert.equal(r.data.active.status,'playing');assert.equal((await remote('activo',randomUUID())).data.active,null);
  const broken=build(supabaseStore({url:'https://x.supabase.co',key:'clave',fetch:async()=>new Response('{"message":"relation does not exist"}',{status:404})}));
  assert.equal((await broken('buscar',ana,{})).status,503,'Sin la tabla duels, la API responde 503 y no rompe el resto');

  console.log('OK: duelos (emparejamiento, reloj de 3 min y 30 s, vida, K.O., revancha, abandono, reconexión, código, bot, validación y Supabase).');
}finally{if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(directory,{recursive:true,force:true})}
