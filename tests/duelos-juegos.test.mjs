// Prueba los duelos de los demás juegos (lib/duelos-juegos.mjs): Ascensión, Traza la tendencia y Archivo Vivo,
// con el mismo motor que la estimación (lib/duelos.mjs) y un reloj controlado. No espera ni usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {RULES,createDuels,memoryDuels,scaledMultiplier} from '../lib/duelos.mjs';
import {GAME_IDS,GAME_NAMES,GAME_RULES,MAX_POINTS,createDuelGames,gameId,gameList} from '../lib/duelos-juegos.mjs';
import {betStake} from '../lib/apuestas.mjs';
import {createDuelPrizes} from '../lib/premios.mjs';
import {ascensionEdition} from '../lib/ascension.mjs';
import {trendEdition} from '../lib/tendencias.mjs';
import * as archive from '../dist/archivo-vivo-rondas.js';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {madridDate} from '../content-engine.mjs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const ascensionBank=JSON.parse(read('content/ascension.json')),charts=JSON.parse(read('content/tendencias-estables.json'));
const categoryById=new Map(ascensionBank.categories.map(category=>[category.id,category])),chartById=new Map(charts.map(chart=>[chart.id,chart]));
const sceneById=new Map(archive.scenes.map(scene=>[scene.id,scene]));

let t=Date.parse('2026-11-26T10:00:00Z'),seed=5;
const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const bank=new Map(Array.from({length:30},(_,i)=>[`q${i}`,{id:`q${i}`,answer:100*(i+1),title:`Pregunta ${i}`,unit:'u',category:'x',sources:[]}]));
// Una voz de mentira: estas pruebas comprueban el enganche, no lo que hace lib/voz.mjs por dentro.
const voice={
  voiceAction(state,seat,data,now){if(data.op==='mal')return {status:409,body:{error:'Ahora no'}};state.voice={count:(state.voice?.count||0)+1,last:data.op,seat,at:now};return {status:200}},
  voiceView:(state,seat,phase,info)=>({seat,phase,count:state.voice?.count||0,now:info?.now??null,until:info?.until??null})
};
const store=memoryDuels();
const duels=createDuels({duels:store,questions:bank,pool:()=>[...bank.keys()],now:()=>t,random,voice});
const call=async(action,player,extra={})=>{const r=await duels.handle({action,player,...extra});return {status:r.status,data:r.body}};
const people=n=>Array.from({length:n},()=>randomUUID());
const stateOf=async id=>(await store.get(id)).state;
// Vistas reales de cada juego (pregunta, resultado y final), para pintarlas después con dist/duel-games.js.
const samples={};

try{
  // Tiempos (contrato del equipo): ni tan largos que dé tiempo a buscarlo, ni tan cortos que no dé tiempo a responder.
  assert.deepEqual(GAME_IDS,['estimacion','ascension','traza','archivo']);
  assert.deepEqual(GAME_IDS.map(id=>[GAME_RULES[id].roundMs,GAME_RULES[id].rushMs]),[[60000,20000],[25000,10000],[45000,15000],[45000,15000]]);
  assert.deepEqual([RULES.roundMs,RULES.rushMs],[60000,20000],'RULES son los tiempos del duelo de estimación');
  for(const id of GAME_IDS){const rules=GAME_RULES[id];assert(rules.bot[0]+rules.bot[1]+rules.rushMs<rules.roundMs,`El bot de ${id} responde con tiempo para que quede entero el plazo recortado`);assert(rules.rushMs<rules.roundMs&&rules.maxRounds>=5&&rules.maxRounds<=10)}
  assert.equal(gameId(undefined),'estimacion');assert.equal(gameId('traza'),'traza');assert.equal(gameId('ajedrez'),null);assert.equal(gameId(7),null);
  assert.deepEqual([1,2,3,4,5].map(r=>scaledMultiplier(r,5)),[.2,.4,.8,1.25,2],'Con cinco rondas el daño de la práctica sube más deprisa');
  assert.deepEqual([1,5,10,11].map(r=>scaledMultiplier(r,10)),[.2,.6,2,2]);

  // El portal pregunta qué juegos hay y con qué tiempos: el navegador no tiene copia.
  const [ana,luis,eva,otro]=people(4);
  const listed=await call('juegos',ana);
  assert.equal(listed.status,200);assert.deepEqual(listed.data.games.map(game=>game.id),GAME_IDS);
  assert.deepEqual(listed.data.games.map(game=>game.name),GAME_IDS.map(id=>GAME_NAMES[id]));
  assert.deepEqual(listed.data.games[1].rules,{roundMs:25000,rushMs:10000,maxRounds:7});
  assert(listed.data.games.every(game=>game.bot&&game.sizes.includes(2)&&game.sizes.includes(3)));
  assert.deepEqual(gameList().map(game=>game.ranked),[true,false,false,false],'Solo la estimación tiene clasificatorias');
  assert.deepEqual(listed.data.games.map(game=>game.ranked),[false,false,false,false],'Sin motor de clasificatorias no se ofrece ninguna');
  assert.deepEqual(listed.data.games.map(game=>game.stakes),[true,true,true,false],'Archivo Vivo no admite apuesta ni paga faradios');

  // Emparejamiento: la partida rápida solo junta a quienes buscan el mismo juego.
  let a=await call('buscar',ana,{name:'Ana',game:'ascension'});
  assert.equal(a.status,200);assert.equal(a.data.status,'waiting');assert.equal(a.data.game,'ascension');
  assert.deepEqual(a.data.rules,{roundMs:25000,rushMs:10000,revealMs:GAME_RULES.ascension.revealMs,maxRounds:7});
  let b=await call('buscar',luis,{name:'Luis'});
  assert.notEqual(b.data.id,a.data.id,'Quien busca estimación no entra en un duelo de Ascensión');assert.equal(b.data.game,'estimacion');
  assert.deepEqual(b.data.rules,{roundMs:60000,rushMs:20000,revealMs:RULES.revealMs,maxRounds:10});
  let c=await call('buscar',eva,{name:'Eva',game:'traza'});
  assert.notEqual(c.data.id,a.data.id);assert.equal(c.data.game,'traza');
  await call('salir',luis,{id:b.data.id});await call('salir',eva,{id:c.data.id});
  assert.equal((await call('buscar',otro,{game:'ajedrez'})).status,400,'Juego desconocido');
  assert.equal((await call('crear',otro,{game:'ajedrez'})).status,400);
  assert.equal((await call('buscar',otro,{game:'traza',mode:'ranked'})).status,400,'Las clasificatorias son solo de estimación');
  b=await call('buscar',luis,{name:'Luis',game:'ascension'});
  assert.equal(b.data.id,a.data.id,'Dos que buscan Ascensión se encuentran');assert.equal(b.data.phase,'intro');assert.equal(b.data.game,'ascension');
  const asc=a.data.id;
  assert.equal((await stateOf(asc)).game,'ascension');
  assert(!('game' in (await stateOf((await call('crear',otro,{name:'Otro'})).data.id))),'Un duelo de estimación no lleva el campo, como los de siempre');

  // ── Ascensión ─────────────────────────────────────────────────────────────────────────────────────────────
  {
    const state=await stateOf(asc),today=new Set(ascensionEdition(madridDate(new Date(t)),ascensionBank,0).map(category=>category.id));
    assert.equal(state.questions.length,7);assert.equal(new Set(state.questions).size,7,'Sin repetir categoría dentro del duelo');
    assert(state.questions.every(id=>categoryById.has(id)&&!today.has(id)),'No sale ninguna categoría de la Ascensión diaria de hoy');
    t+=RULES.introMs;
    a=await call('estado',ana,{id:asc});
    assert.equal(a.data.phase,'question');assert.equal(a.data.round.deadline-a.data.round.startsAt,25000);assert.equal(a.data.round.rushed,false);
    samples.ascension={question:a.data};
    const category=categoryById.get(a.data.round.question.id);
    assert.deepEqual(Object.keys(a.data.round.question).sort(),['count','description','id','theme','title'],'La categoría viaja sin sus respuestas');
    assert.equal(a.data.round.question.count,category.answers.length);
    const summit=category.answers.find(answer=>answer.points===100&&!answer.million),common=category.answers.find(answer=>answer.points===Math.min(...category.answers.map(one=>one.points)));
    assert(!JSON.stringify(a.data).includes(JSON.stringify(summit.name)),'Ninguna respuesta de la categoría sale durante la pregunta');
    // Validación: forma, respuesta que no está en el banco (se puede probar otra) y respuesta aceptada.
    for(const bad of [7,'','   ','x'.repeat(161),'a\u0000b',['a'],null])assert.equal((await call('responder',ana,{id:asc,guess:bad})).status,400,`Respuesta no válida: ${JSON.stringify(bad)}`);
    const unknown=await call('responder',ana,{id:asc,guess:'zzqq no existe zzqq'});
    assert.equal(unknown.status,422);assert.equal(unknown.data.code,'unknown');
    a=await call('estado',ana,{id:asc});assert.deepEqual(a.data.round.answered,[false,false],'Una respuesta que no vale no cuenta como respondida');assert.equal(a.data.round.rushed,false);
    t+=8000;
    a=await call('responder',ana,{id:asc,guess:'  '+summit.name.toUpperCase()+' '});
    assert.equal(a.status,200);assert.equal(a.data.round.yourGuess,summit.name,'Se guarda el nombre del banco, no lo tecleado');
    assert.equal(a.data.round.rushed,true);assert.equal(a.data.round.deadline,t+10000,'Al responder uno, al otro le quedan 10 s');
    b=await call('estado',luis,{id:asc});
    assert.deepEqual(b.data.round.answered,[true,false]);assert.equal(b.data.round.yourGuess,null);
    for(const key of ['guesses','marks','reveal','points'])assert(!(key in b.data.round),`«${key}» no viaja antes de resolver la ronda`);
    assert(!JSON.stringify(b.data).includes(JSON.stringify(summit.name)),'El rival no ve la respuesta de Ana');
    assert.equal((await call('responder',ana,{id:asc,guess:common.name})).data.round.yourGuess,summit.name,'La primera respuesta aceptada es la que vale');
    t+=3000;
    b=await call('responder',luis,{id:asc,guess:common.name});
    assert.equal(b.data.phase,'reveal');
    assert.deepEqual(b.data.round.points,[5000,common.points*50],'Puntos normalizados a 0–5000');assert.equal(MAX_POINTS,5000);
    samples.ascension.reveal=b.data;
    assert.equal(b.data.round.damage,5000-common.points*50);assert.equal(b.data.round.loser,'you');
    assert.deepEqual(b.data.round.guesses,[summit.name,common.name]);
    assert.deepEqual(b.data.round.marks.map(mark=>mark.raw),[100,common.points]);assert.equal(b.data.round.marks[0].tier,'summit');assert(b.data.round.marks[1].label);
    assert(b.data.round.reveal.sources.length&&b.data.round.reveal.sources.every(source=>source.title&&/^https:/.test(source.url)),'El resultado trae las fuentes de la categoría');
    assert(b.data.round.reveal.examples.every(example=>![summit.name,common.name].includes(example.name)&&example.label));
    assert.equal(b.data.round.nextAt-b.data.round.resolvedAt,GAME_RULES.ascension.revealMs);
    assert.deepEqual(b.data.players.map(player=>player.hp),[6000,6000-b.data.round.damage]);
    // Nadie responde: se acaba el plazo de 25 s y nadie pierde vida.
    t+=GAME_RULES.ascension.revealMs;
    a=await call('estado',ana,{id:asc});assert.equal(a.data.phase,'question');assert.equal(a.data.round.number,2);
    t+=25000+RULES.graceMs-1;assert.equal((await call('estado',ana,{id:asc})).data.phase,'question','Hasta el último instante se puede responder');
    t+=1;a=await call('estado',ana,{id:asc});
    assert.equal(a.data.phase,'reveal');assert.deepEqual(a.data.round.points,[0,0]);assert.deepEqual(a.data.round.marks,[null,null]);assert.equal(a.data.round.loser,null);
    assert.equal((await call('responder',ana,{id:asc,guess:'algo'})).status,409,'Fuera de tiempo');
    // Ana sigue ganando hasta dejar a Luis sin vida: el duelo acaba por K.O. antes de las siete rondas.
    for(let guard=0;guard<10&&a.data.phase!=='finished';guard++){
      t+=GAME_RULES.ascension.revealMs;a=await call('estado',ana,{id:asc});
      const best=categoryById.get(a.data.round.question.id).answers.find(answer=>answer.points===100&&!answer.million);
      t+=4000;a=await call('responder',ana,{id:asc,guess:best.name});
      t+=10000+RULES.graceMs;a=await call('estado',ana,{id:asc});
    }
    assert.equal(a.data.phase,'finished');assert.equal(a.data.winner,'you');assert.equal(a.data.reason,'ko');assert.equal(a.data.game,'ascension');
    assert(a.data.rounds.length>=3&&a.data.rounds.length<=7);samples.ascension.final=a.data;
    assert(a.data.rounds.every(round=>round.question.title&&round.marks.length===2&&round.reveal.sources.length),'El repaso final trae cada categoría con sus fuentes');
    // Revancha: conserva el juego.
    a=await call('revancha',ana,{id:asc,name:'Ana'});assert.equal(a.data.status,'waiting');assert.equal(a.data.game,'ascension');assert.equal(a.data.public,false);
    b=await call('revancha',luis,{id:asc,name:'Luis'});assert.equal(b.data.id,a.data.id);assert.equal(b.data.phase,'intro');assert.equal(b.data.game,'ascension');
    assert.equal((await stateOf(b.data.id)).questions.filter(id=>state.questions.includes(id)).length,0,'La revancha trae categorías que no han visto');
    await call('salir',luis,{id:b.data.id});
  }

  // ── Traza la tendencia ────────────────────────────────────────────────────────────────────────────────────
  {
    // Con código: el enlace no lleva el juego; lo sabe el servidor.
    a=await call('crear',ana,{name:'Ana',game:'traza'});assert.equal(a.data.game,'traza');assert.equal(a.data.public,false);
    assert.equal((await call('buscar',otro,{name:'Otro',game:'traza'})).data.id===a.data.id,false,'Un duelo con código no entra en la partida rápida');
    b=await call('unirse',luis,{code:a.data.code,name:'Luis'});assert.equal(b.data.phase,'intro');assert.equal(b.data.game,'traza','Quien se une juega al juego del duelo');
    const id=a.data.id,state=await stateOf(id),today=trendEdition(madridDate(new Date(t))).map(chart=>chart.id);
    assert.equal(state.questions.length,5);assert.equal(new Set(state.questions).size,5);
    assert(state.questions.every(one=>chartById.has(one)&&!today.includes(one)),'No sale ninguna gráfica de la Traza de hoy');
    t+=RULES.introMs;
    a=await call('estado',ana,{id});
    assert.equal(a.data.round.deadline-a.data.round.startsAt,45000);
    const question=a.data.round.question,chart=chartById.get(question.id),actual=chart.values.slice(chart.cut+1);
    assert.deepEqual(question.history,chart.values.slice(0,chart.cut+1),'Se ve el tramo conocido');samples.traza={question:a.data};
    assert(!('values' in question)&&!('actual' in question)&&!('source' in question)&&!('context' in question),'El tramo oculto no viaja durante la pregunta');
    assert.equal(question.end-question.start-question.cut,actual.length);
    for(const bad of [5,'1,2',[],actual.slice(1),[...actual.slice(1),chart.max+1],[...actual.slice(1),'3'],[...actual.slice(1),NaN]])
      assert.equal((await call('responder',ana,{id,guess:bad})).status,400,`Trazo no válido: ${JSON.stringify(bad)}`);
    t+=20000;
    a=await call('responder',ana,{id,guess:actual});
    assert.equal(a.status,200);assert.deepEqual(a.data.round.yourGuess,actual);assert.equal(a.data.round.deadline,t+15000,'Al responder uno, al otro le quedan 15 s');
    b=await call('estado',luis,{id});assert(!('guesses' in b.data.round)&&!('reveal' in b.data.round));
    // Luis dibuja una línea plana desde el último dato.
    const flat=actual.map(()=>chart.values[chart.cut]);
    t+=5000;b=await call('responder',luis,{id,guess:flat});
    assert.equal(b.data.phase,'reveal');assert.equal(b.data.round.points[0],5000,'El trazo exacto vale 5000');samples.traza.reveal=b.data;
    assert.equal(b.data.round.points[1],b.data.round.marks[1].score*5,'Los puntos del modo (0–1000) se multiplican por cinco');
    assert(b.data.round.points[1]>=0&&b.data.round.points[1]<=5000);assert.equal(b.data.round.marks[0].score,1000);assert.equal(b.data.round.marks[0].error,0);
    assert.deepEqual(b.data.round.reveal.actual,actual);assert.deepEqual(b.data.round.guesses,[actual,flat]);
    assert(b.data.round.reveal.source.title&&/^https:/.test(b.data.round.reveal.source.url)&&b.data.round.reveal.source.license,'La serie trae su fuente y su licencia');
    assert.equal(b.data.round.nextAt-b.data.round.resolvedAt,GAME_RULES.traza.revealMs);
    // Nadie vuelve: el duelo termina solo tras las cinco rondas.
    t+=5*(45000+RULES.graceMs+GAME_RULES.traza.revealMs);
    a=await call('estado',ana,{id});
    assert.equal(a.data.status,'finished');assert.equal(a.data.reason,'rondas');assert.equal(a.data.rounds.length,5);assert.equal(a.data.maxRounds,5);
    assert.equal(a.data.winner,b.data.round.points[1]<5000?'you':'draw');
    assert(a.data.rounds.every(round=>round.question.title&&round.reveal.source.url),'El repaso conserva la fuente de cada gráfica');samples.traza.final=a.data;
    a=await call('revancha',ana,{id,name:'Ana'});assert.equal(a.data.game,'traza');await call('salir',ana,{id:a.data.id});
  }

  // ── Archivo Vivo ──────────────────────────────────────────────────────────────────────────────────────────
  {
    a=await call('buscar',ana,{name:'Ana',game:'archivo'});b=await call('buscar',luis,{name:'Luis',game:'archivo'});
    assert.equal(b.data.id,a.data.id);assert.equal(b.data.game,'archivo');
    const id=a.data.id,state=await stateOf(id),today=archive.initialSceneIdsForDay(madridDate(new Date(t)));
    assert.equal(state.questions.length,5);assert.equal(new Set(state.questions).size,5);
    assert(state.questions.every(one=>sceneById.has(one)&&!today.includes(one)),'No sale ninguna foto del Archivo Vivo de hoy');
    t+=RULES.introMs;
    a=await call('estado',ana,{id});
    assert.equal(a.data.round.deadline-a.data.round.startsAt,45000);
    const question=a.data.round.question,scene=sceneById.get(question.id);
    assert.deepEqual(Object.keys(question).sort(),['alt','detail','id','maxYear','minYear','photo'],'La foto viaja sin año, título ni autoría');
    assert.equal(question.photo,`assets/archivo-vivo/${scene.id}-foto.jpg`);assert(fs.existsSync(new URL('../dist/'+question.photo,import.meta.url)),'La foto existe');
    assert.deepEqual([question.minYear,question.maxYear],[1840,2020]);samples.archivo={question:a.data};
    for(const bad of [1839,2021,1950.5,'1950',null,[1950]])assert.equal((await call('responder',ana,{id,guess:bad})).status,400,`Año no válido: ${JSON.stringify(bad)}`);
    t+=10000;
    a=await call('responder',ana,{id,guess:scene.year});
    assert.equal(a.data.round.yourGuess,scene.year);assert.equal(a.data.round.deadline,t+15000);
    const far=scene.year+12<=2020?scene.year+12:scene.year-12;
    t+=2000;b=await call('responder',luis,{id,guess:far});
    assert.equal(b.data.phase,'reveal');assert.deepEqual(b.data.round.points,[5000,archive.scoreYear(far,scene.year)*5]);assert.equal(b.data.round.points[1],1840);
    assert.deepEqual(b.data.round.marks,[{off:0},{off:12}],'Cada uno ve a cuántos años se ha quedado');samples.archivo.reveal=b.data;
    assert.equal(b.data.round.reveal.year,scene.year);
    assert.equal(b.data.round.reveal.credit,scene.credit);assert.equal(b.data.round.reveal.rights,scene.rights);assert.equal(b.data.round.reveal.source,scene.source,'El resultado conserva la autoría, la licencia y la ficha de la foto');
    // Luis abandona: gana Ana, y el repaso final sigue llevando la atribución.
    b=await call('salir',luis,{id});assert.equal(b.data.reason,'abandono');
    a=await call('estado',ana,{id});assert.equal(a.data.winner,'you');
    assert(a.data.rounds.length===1&&a.data.rounds[0].reveal.credit&&a.data.rounds[0].reveal.rights&&a.data.rounds[0].question.photo);samples.archivo.final=a.data;
  }

  // Archivo Vivo va sin faradios (los años de sus fotos están en un archivo público): el servidor quita la apuesta
  // que traiga cada jugador, la vista lo dice (stakes:false), no hay bote y el duelo terminado no paga. En Traza, sí.
  {
    const [p,q,r]=people(3),rich={level:20,bet:'alto-voltaje'};
    const prize=createDuelPrizes({duel:async id=>(await store.get(id))?.state||null,paid:async()=>0});
    let made=await call('crear',p,{game:'traza',...rich}),joined=await call('unirse',q,{code:made.data.code,...rich});
    let state=await stateOf(made.data.id);
    assert.deepEqual([made.data.stakes,joined.data.stakes,state.players.map(one=>one.bet),joined.data.players.map(one=>one.bet),betStake(state)],[true,true,['alto-voltaje','alto-voltaje'],['alto-voltaje','alto-voltaje'],150]);
    await call('salir',q,{id:made.data.id});state=await stateOf(made.data.id);
    assert.deepEqual([(await prize(state.players[0].hash,made.data.id)).amount,(await prize(state.players[1].hash,made.data.id)).amount],[15,0],'Traza paga la victoria (y nada a quien abandona)');

    made=await call('crear',p,{game:'archivo',...rich});
    assert.deepEqual([made.data.stakes,made.data.players[0].bet,(await stateOf(made.data.id)).players[0].bet],[false,null,null],'La apuesta no llega ni a guardarse');
    joined=await call('unirse',q,{code:made.data.code,...rich});state=await stateOf(made.data.id);
    assert.deepEqual([joined.data.stakes,state.players.map(one=>one.bet),joined.data.players.map(one=>one.bet),betStake(state)],[false,[null,null],[null,null],0]);
    // Aunque un duelo guardado trajera apuestas (uno creado antes de este cambio), ni hay bote ni se enseñan.
    {const row=await store.get(made.data.id);row.state.players.forEach(one=>{one.bet='chispazo'});assert(await store.save(row.state,row.version))}
    state=await stateOf(made.data.id);
    assert.deepEqual([betStake(state),(await call('estado',p,{id:made.data.id})).data.players.map(one=>one.bet)],[0,[null,null]]);
    await call('salir',q,{id:made.data.id});state=await stateOf(made.data.id);
    const won=await prize(state.players[0].hash,made.data.id);
    assert.deepEqual([won.result,won.amount,won.abandoned,(await prize(state.players[1].hash,made.data.id)).amount],['win',0,false,0],'Ganar un duelo de Archivo Vivo no da faradios');
    // Tampoco en la partida rápida, en la revancha, contra el bot ni en el duelo de tres.
    const quick=await call('buscar',r,{game:'archivo',...rich});
    assert.deepEqual([quick.data.stakes,(await stateOf(quick.data.id)).players[0].bet],[false,null]);await call('salir',r,{id:quick.data.id});
    const again=await call('revancha',p,{id:made.data.id,...rich});
    assert.deepEqual([again.data.game,again.data.stakes,(await stateOf(again.data.id)).players[0].bet],['archivo',false,null]);
    const practice=await call('bot',p,{id:again.data.id});assert.deepEqual(practice.data.players.map(one=>one.bet),[null,null]);await call('salir',p,{id:again.data.id});
    const table=await call('crear',p,{game:'archivo',size:3,...rich});await call('unirse',q,{code:table.data.code,...rich});await call('unirse',r,{code:table.data.code,...rich});
    state=await stateOf(table.data.id);
    assert.deepEqual([state.status,state.players.map(one=>one.bet),betStake(state)],['playing',[null,null,null],0]);
    for(const one of [p,q,r])await call('salir',one,{id:table.data.id});
    const three=await call('crear',p,{game:'traza',size:3,...rich});await call('unirse',q,{code:three.data.code,...rich});await call('unirse',r,{code:three.data.code,...rich});
    assert.equal(betStake(await stateOf(three.data.id)),150,'En los demás juegos el duelo de tres sigue teniendo bote');
    for(const one of [p,q,r])await call('salir',one,{id:three.data.id});
    t+=1000;
  }

  // Duelo incoherente: Preview y producción comparten la tabla de duelos, y una versión del servidor que no conoce los
  // juegos arranca un duelo de Traza con preguntas de estimación. Aquí se cierra como cancelado en vez de fallar.
  {
    const [p,q,x]=people(3);
    const made=await call('buscar',p,{game:'traza'});
    const tamper=async(id,change)=>{const row=await store.get(id);change(row.state);assert(await store.save(row.state,row.version))};
    const oldStart=state=>{state.players.push({hash:'f'.repeat(64),name:'Prod',avatar:{},level:1,hp:6000,bet:null});state.questions=[...bank.keys()].slice(0,10);state.status='playing';state.seenAt=t;
      state.rounds=[{startsAt:t+5000,deadline:t+185000,guesses:[null,null],ats:[null,null],multipliers:[1,1]}];delete state.seen};
    await tamper(made.data.id,oldStart);
    t+=6000;
    const seen=await call('estado',p,{id:made.data.id});
    assert.deepEqual([seen.status,seen.data.status,seen.data.phase,seen.data.reason,seen.data.winner,seen.data.rounds,seen.data.game],[200,'finished','finished','cancelado',null,[],'traza']);
    const state=await stateOf(made.data.id);
    assert.deepEqual([state.status,state.reason,state.winner],['finished','cancelado',null],'El duelo queda guardado como cancelado');
    assert.equal((await call('estado',p,{id:made.data.id})).status,200);
    assert.equal((await call('responder',p,{id:made.data.id,guess:[1,2,3]})).status,409);
    assert.equal((await call('activo',p)).data.active,null,'Un duelo cancelado no se ofrece al volver');
    assert.equal(await createDuelPrizes({duel:async()=>state,paid:async()=>0})(state.players[0].hash,made.data.id),null,'Ni se cobra');
    // Lo mismo si el fallo se descubre al responder o al reconectar, y con una sola ronda que no exista.
    const other=await call('crear',p,{game:'ascension'});await call('unirse',q,{code:other.data.code});
    await tamper(other.data.id,state=>{state.questions[3]='no-existe'});
    t+=RULES.introMs;
    assert.equal((await call('activo',q)).data.active,null);
    assert.deepEqual([(await call('responder',q,{id:other.data.id,guess:'algo'})).status,(await stateOf(other.data.id)).reason],[409,'cancelado']);
    // Un duelo que ya terminó con rondas que aquí no existen (lo jugó entero la otra versión): se ve el resultado, sin rondas.
    const done=await call('crear',p,{game:'traza'});await call('unirse',q,{code:done.data.code});
    await tamper(done.data.id,state=>{state.questions=[...bank.keys()].slice(0,5);state.rounds[0]={...state.rounds[0],guesses:[5,7],ats:[t,t],points:[100,50],loser:1,damage:10,resolvedAt:t};state.status='finished';state.winner=0;state.reason='ko'});
    const final=await call('estado',q,{id:done.data.id});
    assert.deepEqual([final.status,final.data.phase,final.data.winner,final.data.reason,final.data.rounds],[200,'finished','rival','ko',[]]);
    assert.equal((await call('activo',q)).data.active.id,done.data.id);
    // Un juego que este servidor no conoce (de una versión posterior): esperando no se puede entrar; en marcha, se cancela.
    const future=await call('crear',p,{game:'archivo'});
    await tamper(future.data.id,state=>{state.game='parchis'});
    const refused=await call('unirse',x,{code:future.data.code});
    assert.deepEqual([refused.status,refused.data.error],[409,'Ese duelo ya no está disponible']);
    assert.equal((await call('estado',p,{id:future.data.id})).status,200);
    await tamper(future.data.id,state=>{state.players.push({hash:'e'.repeat(64),name:'Otra',avatar:{},level:1,hp:6000,bet:null});state.questions=['casilla-1'];state.status='playing';state.rounds=[{startsAt:t,deadline:t+30000,guesses:[null,null],ats:[null,null]}]});
    assert.deepEqual([(await call('estado',p,{id:future.data.id})).data.reason,(await stateOf(future.data.id)).status],['cancelado','finished']);
    t+=1000;
  }

  // Sin repetir entre duelos: con un banco pequeño (Archivo Vivo), las fotos del duelo anterior salen las últimas.
  {
    const [p,q]=people(2);
    const first=await call('crear',p,{game:'archivo'});await call('unirse',q,{code:first.data.code});
    const seen=(await stateOf(first.data.id)).questions;await call('salir',q,{id:first.data.id});t+=1000;
    const second=await call('crear',p,{game:'archivo'});await call('unirse',q,{code:second.data.code});
    const next=(await stateOf(second.data.id)).questions,fresh=archive.scenes.length-archive.initialSceneIdsForDay(madridDate(new Date(t))).length-seen.length;
    assert.equal(next.filter(one=>seen.includes(one)).length,Math.max(0,5-fresh),'Solo se repite lo imprescindible');
    await call('salir',q,{id:second.data.id});
  }

  // Práctica contra Faraday-bot en los cuatro juegos: responde solo, dentro del plazo y con una respuesta válida.
  const games=createDuelGames();
  for(const game of GAME_IDS){
    const solo=randomUUID(),rules=GAME_RULES[game];
    let v=await call('crear',solo,{name:'Sola',game});v=await call('bot',solo,{id:v.data.id});
    assert.equal(v.data.players[1].bot,true);assert.equal(v.data.game,game);assert.equal(v.data.round.multiplier,.2);
    t+=RULES.introMs;
    for(let second=0;second<rules.roundMs/1000&&!v.data.round?.answered[1];second++){t+=1000;v=await call('estado',solo,{id:v.data.id})}
    assert.deepEqual(v.data.round.answered,[false,true],`El bot de ${game} responde solo`);assert.equal(v.data.round.rushed,true);
    assert.equal(v.data.round.deadline-(await stateOf(v.data.id)).rounds[0].ats[1],rules.rushMs);
    t+=rules.rushMs+RULES.graceMs;v=await call('estado',solo,{id:v.data.id});
    assert.equal(v.data.phase,'reveal');assert(v.data.round.points[1]>=0&&v.data.round.points[1]<=MAX_POINTS);assert.equal(v.data.round.points[0],0);
    if(game!=='estimacion'){
      const state=await stateOf(v.data.id),adapter=games[game];
      assert(adapter.shape(state.rounds[0].guesses[1]),`La respuesta del bot de ${game} tiene la forma de una respuesta`);
      assert.notEqual(adapter.accept(adapter.item(state.questions[0]),state.rounds[0].guesses[1]).guess,undefined);
    }
    // Si la persona responde primero, el bot no agota el plazo recortado.
    t+=rules.revealMs;v=await call('estado',solo,{id:v.data.id});assert.equal(v.data.phase,'question');
    const state=await stateOf(v.data.id),mine=game==='estimacion'?100:state.rounds[0].guesses[1];
    t+=1000;v=await call('responder',solo,{id:v.data.id,guess:game==='ascension'?games.ascension.item(state.questions[1]).answers[0].name:game==='traza'?games.traza.item(state.questions[1]).values.slice(games.traza.item(state.questions[1]).cut+1):mine});
    assert.equal(v.status,200);assert.deepEqual(v.data.round.answered,[true,false]);
    for(let second=0;second<rules.rushMs/1000&&v.data.phase==='question';second++){t+=1000;v=await call('estado',solo,{id:v.data.id})}
    assert.equal(v.data.phase,'reveal','El bot ha respondido antes de que acabe el plazo recortado');assert.equal(v.data.round.number,2);assert.notEqual(v.data.round.guesses[1],null);
    assert(v.data.round.resolvedAt<v.data.round.deadline,'La ronda se cierra con la respuesta del bot, no por el reloj');
    t+=3600000;v=await call('estado',solo,{id:v.data.id});assert.equal(v.data.status,'finished');assert(v.data.rounds.length>=2&&v.data.rounds.length<=rules.maxRounds);assert.equal(v.data.maxRounds,rules.maxRounds);
    const again=await call('revancha',solo,{id:v.data.id});assert.equal(again.data.game,game,'La revancha contra el bot conserva el juego');assert.equal(again.data.players[1].bot,true);
  }

  // Duelo de tres en un juego nuevo: el reparto de daño es el de siempre, con los puntos de ese juego.
  {
    const [x,y,z]=people(3);
    a=await call('buscar',x,{name:'X',size:3,game:'archivo'});assert.equal(a.data.size,3);assert.equal(a.data.game,'archivo');
    assert.notEqual((await call('buscar',y,{name:'Y',size:3})).data.id,a.data.id,'Un duelo de tres de estimación no se mezcla con uno de Archivo Vivo');
    b=await call('buscar',y,{name:'Y',size:3,game:'archivo'});c=await call('buscar',z,{name:'Z',size:3,game:'archivo'});
    assert.equal(c.data.id,a.data.id);assert.equal(c.data.phase,'intro');
    t+=RULES.introMs;const id=a.data.id,year=sceneById.get((await call('estado',x,{id})).data.round.question.id).year;
    await call('responder',x,{id,guess:year});await call('responder',y,{id,guess:year});
    c=await call('responder',z,{id,guess:year>1900?year-60:year+60});
    assert.equal(c.data.phase,'reveal');assert.deepEqual(c.data.round.best,[0,1]);assert.deepEqual(c.data.round.points.slice(0,2),[5000,5000]);
    assert.deepEqual(c.data.round.damages,[0,0,5000-c.data.round.points[2]]);assert.equal(c.data.round.marks[2].off,60);
  }

  // Voz: la acción «voz» pasa por el duelo (solo sus jugadores) y la vista lleva lo que diga el módulo de voz.
  {
    const [p,q]=people(2);
    a=await call('crear',p,{name:'P',game:'archivo'});const id=a.data.id;await call('unirse',q,{code:a.data.code,name:'Q'});
    assert.equal((await call('voz',otro,{id,op:'opt',on:true})).status,403,'Un tercero no entra en la llamada');
    assert.equal((await call('voz',p,{op:'opt',on:true})).status,400,'Hace falta el duelo');
    let v=await call('voz',p,{id,op:'opt',on:true});
    assert.equal(v.status,200);assert.equal(v.data.id,id,'Responde con la vista del duelo');assert.deepEqual([v.data.voice.count,v.data.voice.seat,v.data.voice.phase,v.data.voice.now],[1,0,'intro',t]);
    assert.deepEqual((await stateOf(id)).voice,{count:1,last:'opt',seat:0,at:t},'Lo que cambia la voz se guarda con el duelo');
    v=await call('voz',q,{id,op:'mal'});assert.equal(v.status,409);assert.equal(v.data.error,'Ahora no');assert.equal((await stateOf(id)).voice.count,1,'Una operación rechazada no se guarda');
    v=await call('estado',q,{id});assert.deepEqual([v.data.voice.count,v.data.voice.seat,v.data.voice.until],[1,1,null]);
    // En el resultado de la ronda, la voz sabe hasta cuándo dura (12 s en este juego, no los 10 de la estimación).
    t+=RULES.introMs;await call('responder',p,{id,guess:1900});v=await call('responder',q,{id,guess:1900});
    assert.equal(v.data.phase,'reveal');assert.equal(v.data.voice.until,v.data.round.nextAt);assert.equal(v.data.voice.until-v.data.round.resolvedAt,GAME_RULES.archivo.revealMs);
    // Sin módulo de voz, los duelos siguen igual y la acción dice que no está disponible.
    const mute=createDuels({duels:memoryDuels(),questions:bank,pool:()=>[...bank.keys()],now:()=>t,random,voice:null});
    const quiet=await mute.handle({action:'crear',player:p});assert(!('voice' in quiet.body));
    assert.equal((await mute.handle({action:'voz',player:p,id:quiet.body.id,op:'opt',on:true})).status,503);
    // Por defecto se usa lib/voz.mjs: la vista trae el campo (lo que lleve dentro es cosa de ese módulo).
    const real=createDuels({duels:memoryDuels(),questions:bank,pool:()=>[...bank.keys()],now:()=>t,random});
    assert('voice' in (await real.handle({action:'crear',player:p})).body);
  }

  // Reconectar: el aviso dice a qué se estaba jugando y cuántas rondas tiene.
  {
    const [p,q]=people(2);
    a=await call('crear',p,{game:'traza'});await call('unirse',q,{code:a.data.code});
    const active=(await call('activo',p)).data.active;
    assert.equal(active.id,a.data.id);assert.equal(active.game,'traza');assert.equal(active.maxRounds,5);
    assert(!JSON.stringify(active).includes('values'),'Reconectar no filtra la serie');
  }

  // Sin tocar lib/api.mjs: la API crea duelos de los juegos nuevos con los bancos de content/ y dist/.
  {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-duelos-juegos-'));
    try{
      const api=createApi({store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>t,random,duelLimit:null,log:()=>{}});
      const post=async body=>{const response=await api.handle(new Request('http://casi.test/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()}};
      const [p,q]=people(2);
      for(const game of ['ascension','traza','archivo']){
        const made=await post({action:'crear',player:p,game});assert.equal(made.status,200);assert.equal(made.data.game,game);
        const joined=await post({action:'unirse',player:q,code:made.data.code});assert.equal(joined.data.phase,'intro');assert.equal(joined.data.round.number,1);
        await post({action:'salir',player:q,id:made.data.id});
      }
      assert.equal((await post({action:'juegos',player:p})).data.games[0].ranked,true,'Con la API hay clasificatorias de estimación');
    }finally{if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(directory,{recursive:true,force:true})}
  }

  // El navegador: los tiempos salen del servidor (sin copias en dist/duel.js) y la lista de juegos coincide.
  const duelJs=read('dist/duel.js'),gamesJs=read('dist/duel-games.js');
  for(const literal of ['180000','30000','3 min','3:00','<b>30 s</b>'])assert(!duelJs.includes(literal),`dist/duel.js sigue teniendo un tiempo fijo: ${literal}`);
  for(const literal of ['60000','20000','25000','45000','15000'])assert(!duelJs.includes(literal)&&!gamesJs.includes(literal),`El navegador no guarda copia de los tiempos: ${literal}`);
  assert(/rules\.rushMs/.test(duelJs)&&/rules\.roundMs/.test(duelJs),'El reloj del duelo usa los tiempos de la vista');
  for(const id of GAME_IDS)assert(gamesJs.includes(`id:'${id}'`),`dist/duel-games.js no conoce el juego ${id}`);
  for(const piece of ['window.Duel=','create(','join(','cancel(','open,create,join,cancel,GAMES','GAMES','Voice?.connect','Voice?.update','Voice?.reset'])assert(duelJs.includes(piece),`dist/duel.js ya no expone o engancha: ${piece}`);
  // dist/duel-games.js pinta esas mismas vistas: se carga aquí con un navegador de mentira y se le pasan las vistas reales.
  {
    const page={window:{},document:{addEventListener(){}}};vm.runInNewContext(gamesJs,page);
    const Games=page.window.DuelGames,html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    assert.deepEqual(JSON.parse(JSON.stringify(Games.GAMES.map(game=>[game.id,game.name]))),GAME_IDS.map(id=>[id,GAME_NAMES[id]]),'La lista de juegos del navegador es la del servidor');
    assert(Games.GAMES.every(game=>game.pitch&&game.unit&&game.how.length===2&&game.icon.startsWith('<svg')));
    assert.equal(Games.picker('traza').match(/aria-pressed="true"/g).length,1);assert(Games.picker('traza').includes('data-duel-game="traza"'));
    assert.deepEqual([[5000],[4250],[3000],[1500],[500],[35],[0],[5000,false]].map(args=>String(Games.cue(...args))),['clavada','acierto','cerca','lejos','fallo','desastre','ko','ko']);
    const ui={seats:[0,1],label:seat=>seat?'Luis':'Tú',figure:()=>'<i></i>',best:seat=>seat===0,out:()=>false,hit:()=>''};
    const clean=(text,what)=>{assert.equal(typeof text,'string');for(const bad of ['undefined','NaN','[object'])assert(!text.includes(bad),`${what} pinta «${bad}»`);return text};
    const fields=answers=>({querySelector:selector=>answers[selector]||null});
    for(const game of ['ascension','traza','archivo']){
      const {question,reveal,final}=samples[game];
      const asked=clean(Games.question(question),`La pregunta de ${game}`),box=clean(Games.form(question),`La caja de ${game}`);
      assert(asked.includes('id="duel-title"'));
      for(const piece of ['id="duel-form"','id="duel-help"','id="duel-rival-state"','type="submit"'])assert(box.includes(piece),`La caja de ${game} no tiene ${piece}`);
      const shown=Games.reveal(reveal,ui);clean(shown.head,`El resultado de ${game}`);clean(shown.extra,`El detalle de ${game}`);
      assert.equal(shown.head.match(/data-points="/g).length,2,'Una columna con sus puntos por jugador');assert(shown.head.includes(`data-points="${reveal.round.points[1]}"`));
      clean(Games.review(final,ui),`El repaso de ${game}`);
      clean(Games.sent({...question,round:{...question.round,yourGuess:reveal.round.guesses[0]}},null),`La respuesta enviada de ${game}`);
    }
    // Ascensión: categoría, texto libre y, en el resultado, las fuentes de la categoría.
    assert(Games.question(samples.ascension.question).includes(html(samples.ascension.question.round.question.title)));
    assert.deepEqual({...Games.read(samples.ascension.question,fields({'#dg-text':{value:'  Islas   Feroe '}}))},{guess:'Islas Feroe'});
    assert(Games.read(samples.ascension.question,fields({'#dg-text':{value:'   '}})).error);
    assert(Games.reveal(samples.ascension.reveal,ui).extra.includes(html(samples.ascension.reveal.round.reveal.sources[0].url)));
    assert(Games.review(samples.ascension.final,ui).includes(html(samples.ascension.final.rounds[0].reveal.sources[0].url)));
    // Traza: la gráfica sin el tramo oculto y, en el resultado, la serie real con su fuente y su licencia.
    assert(Games.question(samples.traza.question).includes('<svg')&&Games.question(samples.traza.question).includes('is-drawing'));
    assert(Games.read(samples.traza.question,fields({})).error,'Sin trazo completo no se envía nada');
    const trend=Games.reveal(samples.traza.reveal,ui).head,source=samples.traza.reveal.round.reveal.source;
    assert(trend.includes('dg-actual')&&trend.match(/class="dg-guess"/g).length===2,'El resultado dibuja la serie real y los dos trazos');
    assert(trend.includes(html(source.title))&&trend.includes(html(source.url))&&trend.includes(html(source.license)),'La atribución de la serie está a la vista');
    assert(Games.review(samples.traza.final,ui).includes(html(samples.traza.final.rounds[0].reveal.source.url)));
    // Archivo Vivo: la foto, el año entre 1840 y 2020 y, siempre, la autoría y la licencia.
    assert(Games.question(samples.archivo.question).includes(samples.archivo.question.round.question.photo));
    assert(Games.form(samples.archivo.question).includes('min="1840"')&&Games.form(samples.archivo.question).includes('max="2020"')&&Games.form(samples.archivo.question).includes('type="range"'));
    assert.deepEqual({...Games.read(samples.archivo.question,fields({'#dg-year':{valueAsNumber:1950}}))},{guess:1950});
    for(const year of [1839,2021,1950.5,NaN])assert(Games.read(samples.archivo.question,fields({'#dg-year':{valueAsNumber:year}})).error);
    const photo=samples.archivo.reveal.round.reveal;
    for(const text of [Games.reveal(samples.archivo.reveal,ui).head,Games.review(samples.archivo.final,ui)])
      assert(text.includes(html(photo.credit))&&text.includes(html(photo.rights))&&text.includes(html(photo.source)),'La autoría, la licencia y la ficha de la foto se pintan siempre');
    assert(Games.reveal(samples.archivo.reveal,ui).head.includes('a 12 años')&&Games.reveal(samples.archivo.reveal,ui).head.includes('¡Año exacto!'));
    // Nada de lo que llega se pinta como HTML.
    const evil=JSON.parse(JSON.stringify(samples.ascension.reveal));evil.round.guesses[1]='<img src=x onerror=alert(1)>';evil.round.question.title='<script>x</script>';evil.round.reveal.sources[0].url='javascript:alert(1)';
    const painted=Games.reveal(evil,ui);assert(!(painted.head+painted.extra).includes('<img src=x')&&!painted.head.includes('<script>')&&!painted.extra.includes('javascript:'));
  }
  // Vercel: la función solo lleva lo que se lista; los bancos que lee lib/duelos-juegos.mjs están dentro.
  const included=JSON.parse(read('vercel.json')).functions['api/index.mjs'].includeFiles;
  for(const file of ['content/ascension.json','content/tendencias*.json'])assert(included.includes(file),`vercel.json no incluye ${file}`);

  console.log('OK: duelos de Ascensión, Traza y Archivo Vivo (emparejamiento por juego, validación, puntos 0–5000, plazos y recorte, revelado sin filtrar, K.O., rondas, abandono, revancha, bot, de tres, voz, reconexión, API y navegador).');
}catch(error){console.error(error);process.exit(1)}
