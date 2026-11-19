import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createAscension,ascensionEdition,ascensionNormalize,ascensionAnswer,validateAscensionBank,ASCENSION_ROUNDS} from '../lib/ascension.mjs';
import {fileAscension} from '../lib/ascension-store.mjs';

const bank={version:'fixture-1',categories:Array.from({length:21},(_,i)=>({
  id:`categoria-${i}`,theme:`tema-${i%7}`,title:`Nombra un ejemplo de la categoría ${i}`,description:'Categoría cerrada de prueba.',
  sources:[{title:'Fuente de prueba',url:'https://example.org/catalogo'}],
  answers:[{name:'Águila real',aliases:['Aquila chrysaetos','Aguila-real'],points:10},
    {name:'Quebrantahuesos',aliases:['Gypaetus barbatus'],points:85},{name:'Colibrí',aliases:[],points:60},{name:'Ave del paraíso',aliases:[],points:100}]
}))};
const date='2026-11-19';
assert.equal(ASCENSION_ROUNDS,7);
assert.equal(ascensionNormalize('  ÁGUILA—Real! '),'aguila real');
assert.equal(ascensionNormalize('Côte d’Ivoire'),'cote d ivoire');
assert.equal(ascensionAnswer(bank.categories[0],'AQUILA  CHRYSAETOS').answer.points,10);
assert.equal(ascensionAnswer(bank.categories[0],'aguila rea').suggestion,'Águila real');
assert.equal(ascensionAnswer(bank.categories[0],'inventada').answer,null);
assert.throws(()=>validateAscensionBank({categories:bank.categories.slice(0,6)}),/siete/);
assert.throws(()=>validateAscensionBank({...bank,categories:[{...bank.categories[0],answers:[{name:'A',aliases:['á'],points:10},{name:'B',aliases:['a'],points:60}]},...bank.categories.slice(1)]}),/ambiguo/);
assert.throws(()=>validateAscensionBank({...bank,categories:[{...bank.categories[0],answers:[{name:'X',points:999}]},...bank.categories.slice(1)]}),/Respuesta/);
assert.throws(()=>validateAscensionBank({...bank,categories:[bank.categories[0],bank.categories[0],...bank.categories.slice(2)]}),/repetida/);
assert.throws(()=>validateAscensionBank({...bank,categories:bank.categories.map(category=>({...category,answers:category.answers.filter(answer=>answer.points!==100)}))}),/cumbre/,'Cada categoría permite alcanzar100puntos');
for(let day=1;day<=28;day++){
  const selected=ascensionEdition(`2026-11-${String(day).padStart(2,'0')}`,bank);
  assert.equal(selected.length,7);assert.equal(new Set(selected.map(category=>category.id)).size,7);
  for(const theme of new Set(selected.map(category=>category.theme)))assert(selected.filter(category=>category.theme===theme).length<=2);
}
assert.deepEqual(ascensionEdition(date,bank),ascensionEdition(date,{...bank,categories:[...bank.categories].reverse()}),'El orden del archivo no cambia la diaria');
assert.notDeepEqual(ascensionEdition(date,bank).map(category=>category.id),ascensionEdition(date,bank,1).map(category=>category.id),'La práctica rota categorías');

const directory=mkdtempSync(path.join(tmpdir(),'faraday-ascension-'));
try{
  const file=path.join(directory,'runs.json');let clock=Date.parse(date+'T11:00:00Z');
  const store=fileAscension(file),game=createAscension({store,bank,now:()=>clock,scope:'preview',planOf:async()=>({plus:true})});
  const call=(action,extra={},player='jugador-a',on=game)=>on(player,{action,date,...extra},true);
  const initial=await Promise.all([call('estado'),call('estado')]);
  for(const result of initial){
    assert.equal(result.status,200);assert.equal(result.body.phase,'ready');assert.equal(result.body.current,null);
    assert.equal(result.body.deadline,null);assert.equal(result.body.results.length,0);assert.equal(result.body.score,0);
    assert.equal(result.body.ranking,null);assert.equal(result.body.bank.categories,21);
    assert(!JSON.stringify(result.body).includes('Aquila'),'No filtra respuestas antes de jugar');
  }
  assert.equal((await call('responder',{round:0,answer:'Águila real'})).status,409);
  assert.equal((await call('empezar',{round:1})).status,409);
  assert.equal((await call('empezar',{round:-1})).status,400);
  assert.equal((await call('estado',{game:-1})).status,400);
  assert.equal((await call('estado',{game:999})).status,404);
  assert.equal((await call('estado',{date:'2026-11-20'})).status,409);
  assert.equal((await call('practica')).status,409,'No ensaya antes de terminar la diaria');
  const started=await Promise.all([call('empezar',{round:0}),call('empezar',{round:0})]);
  assert.equal(started[0].body.deadline,clock+25000);assert.equal(started[1].body.deadline,started[0].body.deadline);
  assert.equal(started[0].body.current.id,ascensionEdition(date,bank)[0].id);
  assert(!('answers' in started[0].body.current));assert(!('sources' in started[0].body.current));
  clock+=4000;
  const retryStart=await call('empezar',{round:0});assert.equal(retryStart.body.deadline,started[0].body.deadline,'Reintentar no reinicia el reloj');
  const invalid=await call('responder',{round:0,answer:'Mi dato privado que no es respuesta'});
  assert.equal(invalid.status,422);assert.equal(invalid.body.phase,'question');assert.equal(invalid.body.results.length,0);
  assert.equal(invalid.body.deadline,started[0].body.deadline);
  const before=await store.get('preview',date,'jugador-a',0);
  assert(!JSON.stringify(before.state).includes('Mi dato privado'),'No persiste texto libre rechazado');
  const suggested=await call('responder',{round:0,answer:'Aguila rea'});
  assert.equal(suggested.status,422);assert.equal(suggested.body.suggestion,'Águila real');assert.equal(suggested.body.score,0);
  const accepted=await Promise.all([
    call('responder',{round:0,answer:'AQUILA CHRYSAETOS',points:700}),
    call('responder',{round:0,answer:'Quebrantahuesos'})
  ]);
  assert(accepted.every(result=>result.status===200));
  assert.equal(accepted[0].body.results.length,1);assert.deepEqual(accepted[1].body.results,accepted[0].body.results,'Solo una respuesta gana la carrera');
  assert.equal(accepted[0].body.results[0].points,10,'Ignora los puntos del navegador');
  assert.equal(accepted[0].body.results[0].answer,'Águila real');assert.equal(accepted[0].body.height,100);
  assert.equal(accepted[0].body.phase,'result');assert(accepted[0].body.results[0].sources[0].url);
  assert(!JSON.stringify(accepted[0].body).includes('Gypaetus'),'Revela solo la respuesta aceptada, no todo el catálogo');

  assert(accepted[0].body.results[0].discoveries.length<=5);
  assert(accepted[0].body.results[0].discoveries.every(answer=>answer.name!=='Águila real'&&Object.keys(answer).length===2&&'points' in answer),'Los ejemplos excluyen la respuesta propia y no incluyen aliases');
  assert.equal(accepted[0].body.results[0].discoveries.some(answer=>answer.name==='Quebrantahuesos'),true);

  // Los ejemplos solo aparecen tras resolver y se limitan a la categoría jugada.
  {
    const sampleBank={version:'examples',categories:bank.categories.map(category=>({...category,answers:[10,30,60,85,100].flatMap(points=>[
      {name:`Hallazgo ${category.id} valor ${points}`,aliases:[],points},
      {name:`Otro hallazgo ${category.id} valor ${points}`,aliases:[],points}
    ])}))};
    const sampleGame=createAscension({store:fileAscension(),bank:sampleBank,now:()=>clock});
    const selected=ascensionEdition(date,sampleBank),first=selected[0],next=selected[1];
    await sampleGame('examples',{action:'estado'});
    const question=await sampleGame('examples',{action:'empezar',date,game:0,round:0});
    assert(!JSON.stringify(question.body).includes('Hallazgo'));
    const answer=first.answers[0].name;
    const result=await sampleGame('examples',{action:'responder',date,game:0,round:0,answer});
    const examples=result.body.results[0].discoveries;
    assert.equal(examples.length,5);assert.deepEqual(examples.map(example=>example.points),[10,30,60,85,100]);
    assert(examples.every(example=>example.name!==answer&&example.name.includes(first.id)));
    assert(!JSON.stringify(result.body).includes(next.answers[0].name),'No revela nombres de la siguiente categoría');
  }
  const next=await Promise.all([call('siguiente',{round:0}),call('siguiente',{round:0})]);
  assert.equal((await call('estado')).body.round,1,'Dos pestañas no saltan dos categorías');
  assert(next.every(result=>[200,409].includes(result.status)));
  assert.equal((await call('responder',{round:0,answer:'Quebrantahuesos'})).body.round,1,'Reenviar la anterior no responde la nueva');
  assert.equal((await call('empezar',{round:0})).status,409);
  const second=await call('empezar',{round:1});clock=second.body.deadline;
  const late=await call('responder',{round:1,answer:'Quebrantahuesos'});
  assert.equal(late.body.results[1].reason,'timeout');assert.equal(late.body.results[1].points,0,'En el límite ya venció el reloj');
  assert.equal(late.body.phase,'result');assert.equal(late.body.score,10);

  // Un proceso nuevo recupera el reloj y la referencia editorial guardados.
  const reloaded=createAscension({store:fileAscension(file),bank:{...bank,version:'fixture-2',categories:bank.categories.map(category=>({...category,answers:category.answers.map(answer=>({...answer,points:100}))}))},now:()=>clock,scope:'preview',planOf:async()=>({plus:true})});
  assert.equal((await call('estado',{},'jugador-a',reloaded)).body.bankVersion,'fixture-1');
  await call('siguiente',{round:1},'jugador-a',reloaded);
  await call('empezar',{round:2},'jugador-a',reloaded);
  const preserved=await call('responder',{round:2,answer:'Quebrantahuesos'},'jugador-a',reloaded);
  assert.equal(preserved.body.results[2].points,85,'Una nueva versión del banco no cambia una partida iniciada');

  // El resto de la partida usa el almacén recargado para no simular dos escritores de archivo.
  for(let round=3;round<7;round++){
    await call('siguiente',{round:round-1},'jugador-a',reloaded);
    await call('empezar',{round},'jugador-a',reloaded);
    const result=await call('responder',{round,answer:''},'jugador-a',reloaded);
    assert.equal(result.body.results[round].reason,'pass');
  }
  const finished=await call('siguiente',{round:6},'jugador-a',reloaded);
  assert.equal(finished.body.phase,'finished');assert.equal(finished.body.score,95);assert.equal(finished.body.height,950);
  assert.deepEqual(finished.body.ranking,{total:1,others:0,position:1,tied:1,percentile:null,bins:Array(14).fill(0),top:[95],normal:null},'Sin otros jugadores no inventa percentil');
  const dailyRow=await fileAscension(file).get('preview',date,'jugador-a',0);
  assert.equal(dailyRow.score,95);assert(dailyRow.finished_at);assert.equal(dailyRow.edition,finished.body.edition);

  const practice=await Promise.all([call('practica',{game:0},'jugador-a',reloaded),call('practica',{game:0},'jugador-a',reloaded)]);
  assert(practice.every(result=>result.body.game===1));assert(practice.every(result=>result.body.ranking===null));
  const resumed=await call('practica',{game:0},'jugador-a',reloaded);assert.equal(resumed.body.game,1);
  assert.equal((await call('estado',{game:1},'jugador-a',reloaded)).body.phase,'ready');

  for(let round=0;round<7;round++){
    if(round)await call('siguiente',{game:1,round:round-1},'jugador-a',reloaded);
    await call('empezar',{game:1,round},'jugador-a',reloaded);
    await call('responder',{game:1,round,answer:'Quebrantahuesos'},'jugador-a',reloaded);
  }
  assert.equal((await call('estado',{game:1},'jugador-a',reloaded)).body.score,700);
  assert.equal((await call('estado',{},'jugador-a',reloaded)).body.ranking.total,1,'La práctica perfecta no entra en la clasificación');
  assert.equal((await call('practica',{game:0},'jugador-a',reloaded)).body.game,1,'Un reintento antiguo no abre la segunda práctica');
  assert.equal((await call('practica',{game:1},'jugador-a',reloaded)).body.game,2,'La práctica terminada permite otra sin límite de anuncios o moneda');
  const activePractice=await call('empezar',{game:2,round:0},'jugador-a',reloaded);
  clock=activePractice.body.deadline;
  const resumedPractice=await call('practica',{game:1},'jugador-a',reloaded);
  assert.equal(resumedPractice.body.game,2);assert.equal(resumedPractice.body.phase,'result');
  assert.equal(resumedPractice.body.results[0].reason,'timeout','Reanudar práctica liquida la ronda vencida con CAS');

  // Recargar con una ronda activa conserva el plazo exacto, también al vencer.
  {
    let localClock=Date.parse(date+'T10:00:00Z');const savedFile=path.join(directory,'resume.json');
    const firstProcess=createAscension({store:fileAscension(savedFile),bank,now:()=>localClock});
    await firstProcess('resume',{action:'estado'});
    const active=await firstProcess('resume',{action:'empezar',date,game:0,round:0});
    const secondProcess=createAscension({store:fileAscension(savedFile),bank,now:()=>localClock});
    localClock+=24000;
    const afterReload=await secondProcess('resume',{action:'estado'});
    assert.equal(afterReload.body.phase,'question');assert.equal(afterReload.body.deadline,active.body.deadline);
    localClock+=1000;
    const expired=await secondProcess('resume',{action:'estado'});
    assert.equal(expired.body.phase,'result');assert.equal(expired.body.results[0].reason,'timeout');
    assert.equal(expired.body.results[0].acceptedAt,active.body.deadline);
  }

  // Clasificación real: incluye empates, separa ediciones y entornos, y excluye prácticas.
  const rankingStore=fileAscension();
  for(const [player,score] of [['a',95],['b',95],['c',200],['d',10]])await rankingStore.put({...dailyRow,player_hash:player,score},null);
  await rankingStore.put({...dailyRow,player_hash:'otro-entorno',scope:'publico',score:700},null);
  await rankingStore.put({...dailyRow,player_hash:'otra-edicion',edition:'otra',score:700},null);
  await rankingStore.put({...dailyRow,player_hash:'practica',game:1,score:700},null);
  const rankings=createAscension({store:rankingStore,bank,now:()=>clock,scope:'preview'});
  const ranked=await call('estado',{},'a',rankings);
  assert.deepEqual(ranked.body.ranking,{total:4,others:3,position:2,tied:2,percentile:33,bins:[1,1,0,0,1,...Array(9).fill(0)],top:[200,95,95,10],normal:null});
  assert(!JSON.stringify(ranked.body).includes('player_hash'),'La clasificación no expone identificadores');

  // Medianoche de Madrid: nueva diaria y se rechazan escrituras sobre la anterior.
  clock=Date.parse('2026-11-19T23:00:00Z');
  const tomorrow=await rankings('a',{action:'estado'});
  assert.equal(tomorrow.body.date,'2026-11-20');assert.equal(tomorrow.body.phase,'ready');assert.equal(tomorrow.body.results.length,0);
  assert.equal((await call('empezar',{round:0},'a',rankings)).status,409);

  const unavailable=createAscension({store:{get:async()=>{throw new Error('sin tabla')}},bank,now:()=>clock});
  assert.equal((await unavailable('x',{action:'estado'})).status,503,'La ausencia de migración falla de forma controlada');
}finally{rmSync(directory,{recursive:true,force:true})}

console.log('Ascensión: banco, siete rondas, reloj, alias, persistencia, concurrencia, prácticas y clasificación correctos');
