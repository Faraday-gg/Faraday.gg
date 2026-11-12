// Prueba los duelos 1 vs 1 (lib/duelos.mjs) a través de la API, con un reloj controlado: no espera ni usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {RULES,CHAT,chatText,points,multiplier} from '../lib/duelos.mjs';
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

  // Chat de la partida (decisión 0039): reacciones y frases de una lista cerrada y texto libre corto.
  {
    let c=await duel('crear',ana,{name:'Ana'});const chatId=c.data.id;
    assert.equal((await duel('chat',ana,{id:chatId,kind:'reaction',value:'ok'})).status,409,'Sin rival no hay chat');
    await duel('unirse',luis,{code:c.data.code,name:'Luis'});
    c=await duel('chat',ana,{id:chatId,kind:'reaction',value:'fuego'});assert.equal(c.status,200);
    assert.deepEqual(c.data.chat.map(({from,kind,value})=>({from,kind,value})),[{from:'you',kind:'reaction',value:'fuego'}]);
    clock+=1000;let l=await duel('chat',luis,{id:chatId,kind:'phrase',value:'suerte'});
    assert.deepEqual(l.data.chat.map(m=>[m.from,m.value]),[['rival','fuego'],['you','suerte']],'Cada uno ve quién escribe desde su lado');
    clock+=1000;l=await duel('chat',luis,{id:chatId,kind:'text',value:'  hola‮  <b>qué tal</b>\n'+'x'.repeat(300)});
    const text=l.data.chat.at(-1).value;assert(text.startsWith('hola <b>qué tal</b> x'),'El texto se limpia de controles y espacios; el HTML lo escapa el navegador');assert.equal(text.length,CHAT.maxText);
    assert.equal(chatText('\u0000\n  '),'');
    for(const [kind,value] of [['reaction','pistola'],['phrase','insulto'],['text','   '],['text',42],['otro','ok']])
      assert.equal((await duel('chat',luis,{id:chatId,kind,value})).status,400,`${kind}:${value} no es válido`);
    assert.equal((await duel('chat',otra,{id:chatId,kind:'reaction',value:'ok'})).status,403,'Un tercero no puede escribir');
    // Límite: nada de dos mensajes en menos de 0,4 s ni más de 6 cada 10 s.
    clock+=1000;assert.equal((await duel('chat',ana,{id:chatId,kind:'reaction',value:'ok'})).status,200);
    assert.equal((await duel('chat',ana,{id:chatId,kind:'reaction',value:'ok'})).status,429);
    for(let i=0;i<4;i++){clock+=500;assert.equal((await duel('chat',ana,{id:chatId,kind:'reaction',value:'risa'})).status,200)}
    clock+=500;assert.equal((await duel('chat',ana,{id:chatId,kind:'reaction',value:'risa'})).status,429,'Seis en diez segundos como mucho');
    clock+=10000;assert.equal((await duel('chat',ana,{id:chatId,kind:'reaction',value:'risa'})).status,200);
    // Solo se guardan los últimos mensajes, y el chat sigue abierto al terminar (para el «GG»).
    for(let i=0;i<CHAT.keep;i++){clock+=2000;await duel('chat',i%2?ana:luis,{id:chatId,kind:'phrase',value:'gg'})}
    a=await duel('estado',ana,{id:chatId});assert.equal(a.data.chat.length,CHAT.keep);
    await duel('salir',luis,{id:chatId});clock+=1000;
    assert.equal((await duel('chat',ana,{id:chatId,kind:'phrase',value:'gg'})).status,200,'Se puede escribir con el duelo terminado');
    // Faraday-bot contesta con un par de segundos de retraso, nunca al instante.
    let bot=await duel('crear',ana,{name:'Ana'});bot=await duel('bot',ana,{id:bot.data.id});
    let replies=0;
    for(let i=0;i<8;i++){
      clock+=6000;const sent=await duel('chat',ana,{id:bot.data.id,kind:'phrase',value:'suerte'});
      assert(sent.data.chat.at(-1).from==='you','La respuesta del bot no llega en el mismo instante');
      clock+=3100;const later=await duel('estado',ana,{id:bot.data.id});const last=later.data.chat.at(-1);
      if(last.from==='rival'){replies++;assert.deepEqual([last.kind,last.value],['phrase','igualmente'])}
    }
    assert(replies>=3&&replies<8,`El bot contesta a veces (${replies} de 8)`);
  }

  // Validación.
  assert.equal((await duel('estado','nadie',{id})).status,400);assert.equal((await duel('estado',ana,{id:'x'})).status,400);
  assert.equal((await duel('estado',ana,{id:randomUUID()})).status,404);assert.equal((await duel('bailar',ana)).status,400);
  assert.equal((await duel('responder',ana,{id,guess:-3})).status,400);
  assert.equal((await duel('estado',ana,{id},{headers:{'Content-Type':'application/json',origin:'https://otra.test'}})).status,403,'Origen ajeno');

  // Almacén de Supabase contra una tabla duels simulada: control de versión y fallo si la tabla no existe.
  const rows=new Map();
  const fake=async(input,init={})=>{
    const url=new URL(input),eq=key=>url.searchParams.get(key)?.replace(/^eq\./,'');
    assert.equal(new Headers(init.headers).get('apikey'),'clave');assert.equal(url.pathname,'/rest/v1/duels');
    if(init.method==='POST'){const row=JSON.parse(init.body);if([...rows.values()].some(r=>r.code===row.code))return new Response('{}',{status:409});rows.set(row.id,row);return new Response(null,{status:201})}
    if(init.method==='PATCH'){const row=rows.get(eq('id'));if(!row||row.version!==Number(eq('version')))return Response.json([]);Object.assign(row,JSON.parse(init.body));return Response.json([{version:row.version}])}
    let found=[...rows.values()];
    if(eq('id'))found=found.filter(r=>r.id===eq('id'));if(eq('code'))found=found.filter(r=>r.code===eq('code'));
    if(eq('status'))found=found.filter(r=>r.status===eq('status')&&r.public&&r.updated_at>=url.searchParams.get('updated_at').replace(/^gte\./,''));
    return Response.json(found.map(({state,version})=>({state,version})));
  };
  const remote=build(supabaseStore({url:'https://x.supabase.co',key:'clave',fetch:fake}));
  a=await remote('buscar',ana,{name:'Ana'});b=await remote('buscar',luis,{name:'Luis'});
  assert.equal(b.data.id,a.data.id);assert.equal(rows.get(a.data.id).status,'playing');assert.equal(rows.get(a.data.id).version,2);
  clock+=RULES.introMs;a=await remote('responder',ana,{id:a.data.id,guess:5});assert.deepEqual(a.data.round.answered,[true,false]);assert.equal(rows.get(a.data.id).version,3);
  const broken=build(supabaseStore({url:'https://x.supabase.co',key:'clave',fetch:async()=>new Response('{"message":"relation does not exist"}',{status:404})}));
  assert.equal((await broken('buscar',ana,{})).status,503,'Sin la tabla duels, la API responde 503 y no rompe el resto');

  console.log('OK: duelos (emparejamiento, reloj de 3 min y 30 s, vida, K.O., revancha, abandono, código, bot, chat, validación y Supabase).');
}finally{if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(directory,{recursive:true,force:true})}
