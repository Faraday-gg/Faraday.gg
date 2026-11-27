// Tiempo límite de los modos individuales (Contrato 5): el reloj común del navegador (dist/round-timer.js) con reloj y
// almacenamiento simulados, y lo que hace el servidor cuando el tiempo se agota en Archivo Vivo, Traza y el reto extra.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {createArchivoVivo,ARCHIVO_SECONDS} from '../lib/archivo-vivo.mjs';
import {createContinuations,fileContinuations} from '../lib/continuaciones.mjs';
import {createTrends,createTrendPrizes,fileTrends,isBlankTrace,trendEdition,TREND_SECONDS} from '../lib/tendencias.mjs';
import {trendPrize} from '../lib/premios.mjs';

// ---------- Reloj del navegador
const source=fs.readFileSync(new URL('../dist/round-timer.js',import.meta.url),'utf8');
function fakeDocument(){
  const listeners=new Map();
  function createElement(tag){
    const node={tag,className:'',children:[],attrs:{},hidden:false,textContent:'',innerHTML:'',parentNode:null,
      style:{values:{},setProperty(name,value){this.values[name]=value}},
      classList:{names:new Set(),toggle(name,on){if(on)this.names.add(name);else this.names.delete(name)},contains(name){return this.names.has(name)}},
      setAttribute(name,value){node.attrs[name]=value},
      append(...kids){for(const kid of kids){kid.parentNode=node;node.children.push(kid)}},
      replaceChildren(...kids){for(const kid of node.children)kid.parentNode=null;node.children=[];node.append(...kids)},
      remove(){if(node.parentNode){node.parentNode.children=node.parentNode.children.filter(kid=>kid!==node);node.parentNode=null}}};
    return node;
  }
  return {createElement,listeners,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
}
const find=(node,name)=>node.className===name?node:node.children.map(kid=>find(kid,name)).find(Boolean);
// Una «página»: el script cargado con su reloj, sus intervalos y su localStorage. Pasar el mismo `storage` a otra
// página equivale a recargar.
function page({storage={},now=Date.parse('2026-11-26T10:00:00Z'),broken=false,document}={}){
  const timers=new Map(),sounds=[],clock={now};let ids=0;
  const localStorage={
    getItem(key){if(broken)throw Error('sin almacenamiento');return key in storage?storage[key]:null},
    setItem(key,value){if(broken)throw Error('sin almacenamiento');storage[key]=String(value)},
    removeItem(key){delete storage[key]}
  };
  const context={window:{Sound:{tone:(...args)=>sounds.push(args)}},localStorage,console,Date:{now:()=>clock.now},
    setInterval(fn){timers.set(++ids,fn);return ids},clearInterval(id){timers.delete(id)}};
  if(document)context.document=document;
  vm.createContext(context);vm.runInContext(source,context);
  // Avanza el reloj y deja correr los intervalos; por pasos de un segundo para ver cada cifra.
  function advance(ms,step=ms){for(let left=ms;left>0;left-=step){clock.now+=Math.min(step,left);for(const fn of [...timers.values()])fn()}}
  return {Timer:context.window.RoundTimer,storage,timers,sounds,clock,advance,stored:key=>JSON.parse(storage['faraday:relojes']||'{}')[key]};
}
const settled=()=>new Promise(resolve=>setImmediate(resolve));

{ // Cuenta atrás por fecha de fin, vencimiento y una sola llamada a onExpire.
  const tab=page();let fired=0;
  assert.deepEqual({...tab.Timer.SECONDS},{reto:90,traza:45,archivo:45},'Los tiempos del Contrato 5');
  const start=tab.clock.now,timer=tab.Timer.start({key:'reto:2026-11-26:0',seconds:90,onExpire:()=>fired++});
  assert.equal(timer.remaining(),90000);
  assert.equal(tab.stored('reto:2026-11-26:0').end,start+90000,'Se guarda la fecha de fin, no un contador');
  tab.advance(30000);
  assert.equal(timer.remaining(),60000);
  // Un tick atrasado (pestaña en segundo plano) no alarga el tiempo: manda la fecha.
  tab.clock.now+=59000;
  assert.equal(timer.remaining(),1000);assert.equal(timer.expired(),false);assert.equal(fired,0);
  tab.advance(1000);
  assert.equal(fired,1);assert.equal(timer.remaining(),0);assert.equal(timer.expired(),true);
  assert.equal(tab.timers.size,0,'Al vencer deja de contar');
  tab.advance(5000);assert.equal(fired,1,'onExpire salta una sola vez');
  assert.equal(tab.Timer.peek('reto:2026-11-26:0').expired,true);
  assert.equal(tab.Timer.peek('reto:2026-11-26:1'),null);
  assert.throws(()=>tab.Timer.start({seconds:90}),{name:'TypeError'});
  assert.throws(()=>tab.Timer.start({key:'sin-segundos'}),{name:'TypeError'});
}

{ // Recargar no reinicia el tiempo; si ya venció, onExpire salta al momento (pero con el reloj ya devuelto).
  const first=page();
  first.Timer.start({key:'traza:hoy:0:a',seconds:45});
  first.advance(30000);
  const reloaded=page({storage:first.storage,now:first.clock.now});let fired=0;
  const timer=reloaded.Timer.start({key:'traza:hoy:0:a',seconds:45,onExpire:()=>fired++});
  assert.equal(timer.remaining(),15000,'Tras recargar quedan los mismos segundos');
  reloaded.advance(15000);assert.equal(fired,1);

  const later=page({storage:first.storage,now:first.clock.now+3600000});let late=0,given=null;
  const expired=later.Timer.start({key:'traza:hoy:0:a',seconds:45,onExpire:timer=>{late++;given=timer}});
  assert.equal(late,0,'Nunca dentro de start()');
  assert.equal(expired.remaining(),0);assert.equal(expired.expired(),true);
  await settled();
  assert.equal(late,1,'Ya vencido: avisa al momento');assert.equal(given,expired);
  assert.equal(later.timers.size,0);
  // Otra clave empieza de cero.
  assert.equal(later.Timer.start({key:'traza:hoy:0:b',seconds:45}).remaining(),45000);
}

{ // stop() deja de contar pero la fecha sigue corriendo; done() la olvida.
  const tab=page();let fired=0;
  const timer=tab.Timer.start({key:'archivo:run:0',seconds:45,onExpire:()=>fired++});
  tab.advance(10000);timer.stop();
  assert.equal(tab.timers.size,0);
  tab.advance(60000);assert.equal(fired,0,'Parado no avisa');
  assert.equal(tab.Timer.peek('archivo:run:0').expired,true,'Pero el plazo ha seguido corriendo');
  const again=tab.Timer.start({key:'archivo:run:0',seconds:45,onExpire:()=>fired++});
  again.stop();await settled();
  assert.equal(fired,0,'Un reloj vencido que se para antes de avisar ya no avisa');
  const closing=tab.Timer.start({key:'archivo:run:1',seconds:45,onExpire:()=>fired++});
  tab.advance(5000);closing.done();
  assert.equal(tab.Timer.peek('archivo:run:1'),null);
  assert.equal(tab.Timer.start({key:'archivo:run:1',seconds:45}).remaining(),45000,'Tras done() la clave empieza de cero');
  tab.Timer.clear('archivo:run:0');assert.equal(tab.Timer.peek('archivo:run:0'),null);
}

{ // Pausa y reanudación, a mano y con pauseWhen, con un margen total por clave.
  const tab=page();let fired=0,hint=false;
  const timer=tab.Timer.start({key:'reto:pausa:0',seconds:90,maxPause:60,pauseWhen:()=>hint,onExpire:()=>fired++});
  tab.advance(10000);hint=true;tab.advance(200);
  assert.equal(timer.paused(),true);const left=timer.remaining();assert.equal(left,79800);
  tab.advance(20000,1000);assert.equal(timer.remaining(),left,'En pausa no corre');
  hint=false;tab.advance(200);
  assert.equal(timer.paused(),false);assert.equal(timer.remaining(),left,'Al reanudar queda lo mismo que al pausar');
  timer.pause();timer.pause();assert.equal(timer.paused(),true);
  tab.advance(5000);assert.equal(timer.remaining(),left,'La pausa manual no la levanta pauseWhen');
  timer.resume();timer.resume();assert.equal(timer.paused(),false);
  // Quedan 60 − 20,2 − 5 = 34,8 s de margen: dejar la pista abierta más tiempo ya no para el reloj.
  hint=true;tab.advance(200);const held=timer.remaining();assert.equal(held,left-200);
  tab.advance(34000,1000);assert.equal(timer.paused(),true);assert.equal(timer.remaining(),held);
  tab.advance(1000);assert.equal(timer.paused(),false,'Agotado el margen, sigue aunque pauseWhen diga que no');
  tab.advance(10000,1000);assert.equal(timer.paused(),false);assert.ok(timer.remaining()<held-9000);
  timer.pause();assert.equal(timer.paused(),false,'Sin margen no hay más pausas');
  tab.advance(90000,1000);assert.equal(fired,1);
}

{ // Una pausa que se queda abierta al recargar o cerrar la pestaña cuenta, como mucho, por lo que quedara de margen.
  const first=page();
  const timer=first.Timer.start({key:'reto:pausa:1',seconds:90,maxPause:60});
  first.advance(10000);timer.pause();first.advance(15000);
  const soon=page({storage:first.storage,now:first.clock.now});
  assert.equal(soon.Timer.start({key:'reto:pausa:1',seconds:90,maxPause:60}).remaining(),80000,'Recarga en plena pausa: se reanuda donde estaba');
  const other=page();let fired=0;
  const paused=other.Timer.start({key:'reto:pausa:2',seconds:90,maxPause:60});
  other.advance(10000);paused.pause();
  const back=page({storage:other.storage,now:other.clock.now+3600000});
  const late=back.Timer.start({key:'reto:pausa:2',seconds:90,maxPause:60,onExpire:()=>fired++});
  assert.equal(late.remaining(),0);await settled();assert.equal(fired,1,'Dejar la pista abierta y volver al cabo de una hora no conserva el tiempo');
}

{ // Nunca queda más que el total de la ronda: ni con la fecha guardada retocada ni con el reloj del sistema atrasado.
  const first=page();let fired=0;
  first.Timer.start({key:'reto:atras:0',seconds:90}).stop();
  first.advance(30000);
  const edit=(tab,key,change)=>{const all=JSON.parse(tab.storage['faraday:relojes']);change(all[key]);tab.storage['faraday:relojes']=JSON.stringify(all)};
  // Fecha de fin a una hora vista: al volver se recorta a 90 s, no «3600 s».
  edit(first,'reto:atras:0',entry=>{entry.end=first.clock.now+3600000});
  const seen=first.Timer.peek('reto:atras:0');
  assert.equal(seen.remaining,90000,'peek tampoco enseña más que el total');assert.equal(seen.expired,false);
  const tampered=page({storage:first.storage,now:first.clock.now});
  const timer=tampered.Timer.start({key:'reto:atras:0',seconds:90,onExpire:()=>fired++});
  assert.equal(timer.remaining(),90000,'Una fecha de fin más lejana que la ronda se recorta al total');
  assert.equal(tampered.stored('reto:atras:0').end,tampered.clock.now+90000,'Y la fecha guardada se corrige');
  tampered.advance(89000,1000);assert.equal(fired,0);
  tampered.advance(1000);assert.equal(fired,1,'Vence a los 90 s, no al cabo de una hora');

  // Reloj del sistema atrasado una hora con la ronda abierta: como mucho, la ronda vuelve a empezar.
  const tab=page();let late=0;
  const running=tab.Timer.start({key:'traza:atras:0',seconds:45,onExpire:()=>late++});
  tab.advance(20000,1000);assert.equal(running.remaining(),25000);
  tab.clock.now-=3600000;
  assert.equal(running.remaining(),45000,'Con el reloj atrasado no quedan 3625 s');
  tab.advance(200);
  assert.equal(tab.stored('traza:atras:0').end,tab.clock.now+45000,'El siguiente tick guarda la fecha recortada');
  tab.advance(44000,1000);assert.equal(late,0);
  tab.advance(1000);assert.equal(late,1);

  // Lo mismo en pausa: lo que «quedaba» al pausar tampoco puede superar el total.
  const held=page();
  const paused=held.Timer.start({key:'reto:atras:1',seconds:90,maxPause:60});
  held.advance(10000);paused.pause();
  edit(held,'reto:atras:1',entry=>{entry.left=3600000});
  assert.equal(held.Timer.peek('reto:atras:1',60).remaining,90000);
  const back=page({storage:held.storage,now:held.clock.now});
  assert.equal(back.Timer.start({key:'reto:atras:1',seconds:90,maxPause:60}).remaining(),90000);

  // Un plazo impuesto desde fuera (servidor) tampoco puede ser más largo que la ronda.
  const forced=page();
  assert.equal(forced.Timer.start({key:'archivo:atras:0',seconds:45,deadline:forced.clock.now+3600000}).remaining(),45000);
}

{ // quietWhen: con la pantalla del reloj tapada no hay tics ni anuncios hablados, pero el reloj sigue y vence.
  const document=fakeDocument(),tab=page({document}),card=document.createElement('div');let covered=true,fired=0;
  tab.Timer.start({key:'reto:mudo:0',seconds:12,mount:card,quietWhen:()=>covered,onExpire:()=>fired++});
  const live=find(card.children[0],'round-timer-live');
  tab.advance(9000,1000);
  assert.equal(tab.sounds.length,0,'Tapado no suena');assert.equal(live.textContent,'','Tapado no habla');
  assert.equal(find(card.children[0],'round-timer-time').textContent,'3 s','Pero sigue contando');
  covered=false;tab.advance(1000);
  assert.equal(tab.sounds.length,1,'A la vista vuelve el tic');
  covered=true;tab.advance(2000,1000);
  assert.equal(fired,1,'Y vence igual');assert.equal(live.textContent,'');assert.equal(tab.sounds.length,1);
  // Si quietWhen falla, el reloj se comporta como siempre.
  const loud=page({document:fakeDocument()});
  loud.Timer.start({key:'reto:mudo:1',seconds:6,quietWhen:()=>{throw Error('roto')}});loud.advance(6000,1000);
  assert.equal(loud.sounds.length,5);
}

{ // Fecha impuesta por el servidor y navegador sin almacenamiento.
  const tab=page();
  tab.Timer.start({key:'archivo:srv:0',seconds:45}).stop();
  const forced=tab.Timer.start({key:'archivo:srv:0',seconds:45,deadline:tab.clock.now+7000});
  assert.equal(forced.remaining(),7000,'El plazo del servidor sustituye al guardado');
  forced.stop();
  assert.equal(tab.Timer.start({key:'archivo:srv:0',seconds:45}).remaining(),7000,'Y queda guardado');

  const locked=page({broken:true});let fired=0;
  const timer=locked.Timer.start({key:'reto:sin-disco:0',seconds:90,onExpire:()=>fired++});
  locked.advance(40000);timer.stop();
  assert.equal(locked.Timer.start({key:'reto:sin-disco:0',seconds:90,onExpire:()=>fired++}).remaining(),50000,'Sin localStorage, el plazo vive en memoria');
  locked.advance(50000);assert.equal(fired,1);
}

{ // Lo que se ve y se oye: cifra en segundos, barra, aviso a los 10 s, tics en los últimos 5 y voz solo a los 30, 10 y 5.
  const document=fakeDocument(),tab=page({document}),card=document.createElement('div'),sheet=document.createElement('div');
  const timer=tab.Timer.start({key:'reto:dom:0',seconds:45,mount:[card,sheet]});
  const root=card.children[0],time=find(root,'round-timer-time'),live=find(root,'round-timer-live');
  assert.equal(root.attrs.role,'timer');assert.equal(root.attrs['aria-label'],'Tiempo restante');
  assert.equal(live.attrs['aria-live'],'polite');
  assert.equal(find(sheet,'round-timer-live'),undefined,'Una sola región hablada aunque haya dos relojes');
  assert.equal(time.textContent,'45 s');assert.equal(find(sheet,'round-timer-time').textContent,'45 s');
  assert.ok(document.listeners.has('visibilitychange'));
  const spoken=[];let last='';
  for(let second=1;second<=45;second++){
    tab.advance(1000);
    if(live.textContent!==last){last=live.textContent;spoken.push(last)}
    const left=45-second;
    assert.equal(time.textContent,`${left} s`);
    assert.equal(root.classList.contains('is-warning'),left<=10,`Aviso visual con ${left} s`);
    assert.equal(root.classList.contains('is-last'),left<=5);
    assert.equal(root.style.values['--rt'],String(left/45));
  }
  assert.deepEqual(spoken,['Quedan 30 segundos','Quedan 10 segundos','Quedan 5 segundos','Se acabó el tiempo']);
  assert.equal(tab.sounds.length,5,'Un tic por segundo en los últimos 5');
  assert.equal(document.listeners.has('visibilitychange'),false);
  timer.stop();
  assert.equal(card.children.length,0);assert.equal(sheet.children.length,0,'stop() quita el reloj de la pantalla');

  const quiet=page({document:fakeDocument()});
  quiet.Timer.start({key:'reto:dom:1',seconds:6,sound:false});quiet.advance(6000,1000);
  assert.equal(quiet.sounds.length,0);
}

// ---------- Archivo Vivo: el servidor lleva el plazo de cada foto
{
  assert.equal(ARCHIVO_SECONDS,45);
  const mode='archivo-vivo',sceneIds=['01','02','03','04','05','06','07','08','09'];
  let time=Date.parse('2026-11-26T12:00:00Z');
  const archive=createArchivoVivo({store:fileContinuations(),scope:'preview',now:()=>time,sceneIds,initialIds:['04','01','03'],planOf:async()=>({plus:true})});
  const post=(action,extra={},player='jugador')=>archive(player,{action,mode,...extra},true);
  const ref=run=>({id:run.id,index:run.index});
  let run=await post('archivo-estado');
  assert.ok(!('clock' in run)&&!('deadline' in run),'El plazo no sale en la vista de la partida');
  await assert.rejects(post('archivo-ver',{id:'otra',index:0}),{status:409});
  await assert.rejects(post('archivo-ver',{id:run.id,index:7}),{status:400});
  assert.equal((await post('archivo-ver',{id:run.id,index:1})).clock,null,'Solo la foto abierta tiene plazo');
  const seen=await post('archivo-ver',ref(run));
  assert.deepEqual(seen.clock,{deadline:time+45000,now:time,seconds:45});
  time+=10000;
  assert.deepEqual((await post('archivo-ver',ref(run))).clock,{deadline:seen.clock.deadline,now:time,seconds:45},'Volver a abrir la foto no reinicia el plazo');
  assert.deepEqual(await post('archivo-estado'),run,'Con plazo en marcha la partida sigue igual');
  // Dentro del plazo más los 3 s de margen, la respuesta entra.
  time=seen.clock.deadline+2999;
  run=await post('archivo-responder',{...ref(run),guess:1900});
  assert.deepEqual(run.guesses,[1900]);
  assert.equal((await post('archivo-ver',ref(run))).clock,null,'Una foto respondida ya no tiene plazo');
  run=await post('archivo-siguiente',ref(run));
  // Segunda foto: se agota. Lo resuelve la siguiente petición, sea cual sea.
  const second=await post('archivo-ver',ref(run));
  time=second.clock.deadline+3000;
  const late=await post('archivo-responder',{...ref(run),guess:1950});
  assert.deepEqual(late.guesses,[1900,null],'Fuera de plazo queda sin respuesta aunque llegue un año');
  assert.deepEqual((await post('archivo-estado')).guesses,[1900,null]);
  run=await post('archivo-siguiente',ref(late));
  assert.equal(run.index,2);
  // Tercera foto: el navegador avisa de que se acabó el tiempo. Sin año, sin respuesta; con año, cuenta ese año.
  await post('archivo-ver',ref(run));
  await assert.rejects(post('archivo-responder',ref(run)),{status:400});
  run=await post('archivo-responder',{...ref(run),timeout:true});
  assert.deepEqual(run.guesses,[1900,null,null]);
  assert.equal((await post('archivo-siguiente',ref(run))).index,3,'Una partida con fotos sin respuesta se puede terminar');

  let other=await post('archivo-estado',{},'otro');
  const clock=(await post('archivo-ver',ref(other),'otro')).clock;
  time=clock.deadline+1000;
  other=await post('archivo-responder',{...ref(other),guess:1931,timeout:true},'otro');
  assert.deepEqual(other.guesses,[1931],'Al agotarse cuenta el año que marcaba el selector');
  other=await post('archivo-siguiente',ref(other),'otro');
  await post('archivo-ver',ref(other),'otro');
  time+=3600000;
  assert.deepEqual((await post('archivo-estado',{},'otro')).guesses,[1931,null],'Cerrar Archivo Vivo no para el tiempo: al volver, la foto está cerrada');
  // Sin «archivo-ver» (una pestaña antigua) no hay plazo: se comporta como antes.
  let old=await post('archivo-estado',{},'antiguo');
  time+=86400000;
  old=await post('archivo-responder',{...ref(old),guess:1850},'antiguo');
  assert.deepEqual(old.guesses,[1850]);
}

// ---------- Traza: el reloj es del navegador; el servidor admite cerrar una gráfica sin trazo (0 puntos)
{
  assert.equal(TREND_SECONDS,45);
  const now=Date.parse('2026-11-26T12:00:00Z'),store=fileTrends();
  const game=createTrends({store,now:()=>now});
  const state=(await game('lento',{action:'estado'})).body;
  assert.equal(state.seconds,45);
  const [first,second,third]=trendEdition(state.date);
  const actual=chart=>chart.values.slice(chart.cut+1);
  const reveal=(player,chart,extra)=>game(player,{action:'revelar',date:state.date,game:0,chart:chart.id,...extra});
  assert.equal((await reveal('lento',first,{})).status,400,'Sin trazo y sin tiempo agotado no se revela');
  assert.equal((await reveal('lento',first,{guess:actual(first).slice(1)})).status,400);
  const blank=(await reveal('lento',first,{timeout:true})).body;
  assert.equal(blank.results.length,1);
  assert.deepEqual({score:blank.results[0].score,error:blank.results[0].error,guess:blank.results[0].guess,blank:blank.results[0].blank},{score:0,error:null,guess:[],blank:true});
  assert.deepEqual(blank.results[0].actual,actual(first));
  assert.equal(blank.current.id,second.id,'Sin trazo la gráfica queda cerrada y se pasa a la siguiente');
  assert.equal((await reveal('lento',first,{guess:actual(first)})).body.results[0].blank,true,'No se puede rehacer');
  const [row]=await store.answers('publico',state.date,'lento',0);
  assert.ok(row.guess.length>=1&&row.guess.length<=30&&row.guess.every(Number.isFinite),'Cabe en trend_answers sin migración');
  assert.equal(isBlankTrace(first,row.guess),true);assert.equal(isBlankTrace(first,actual(first)),false);
  // Al agotarse con trazo, el navegador lo envía completo: cuenta como cualquier otro.
  const drawn=(await reveal('lento',second,{guess:actual(second),timeout:true})).body;
  assert.equal(drawn.results[1].score,1000);assert.ok(!('blank' in drawn.results[1]));
  // Los trazos de los demás no enseñan el hueco de quien no dibujó.
  await reveal('rapido',first,{guess:actual(first)});
  const peers=(await game('lento',{action:'trazos',date:state.date,chart:first.id,after:0})).body;
  assert.deepEqual(peers,{traces:[actual(first).map(value=>Number(value.toFixed(first.precision)))],next:null,simulated:false});
  const alone=(await game('rapido',{action:'trazos',date:state.date,chart:first.id,after:0})).body;
  assert.equal(alone.simulated,true,'Quien no dibujó no cuenta como trazo de otro jugador');
  assert.equal(alone.traces.length,200);
  // El premio diario se calcula igual, con 0 puntos en la gráfica sin trazo.
  const done=(await reveal('lento',third,{guess:actual(third)})).body;
  assert.equal(done.current,null);assert.equal(done.reward.score,2000);
  const prize=await createTrendPrizes({store,today:()=>state.date})('lento',state.date);
  assert.deepEqual(prize,{...trendPrize(2000),score:2000});
}

// ---------- Reto extra (práctica del reto diario): una pregunta se puede cerrar sin respuesta
{
  const now=Date.parse('2026-11-26T12:00:00Z');
  const pool=['a','b','c','d'].map((id,index)=>({id:'q-'+id,category:'cat-'+index,title:id,unit:'u',answer:10}));
  const practice=createContinuations({store:fileContinuations(),now:()=>now,planOf:async()=>({plus:true}),questions:()=>pool});
  const day=await practice.handle('jugador',{action:'reto-extra',mode:'daily'},true);
  const answer=(index,guess)=>practice.handle('jugador',{action:'responder-extra',mode:'daily',id:day.id,index,guess},true);
  await assert.rejects(answer(0,undefined),{status:400});
  await assert.rejects(answer(0,0),{status:400});
  assert.deepEqual((await answer(0,null)).guesses,[null]);
  assert.deepEqual((await answer(0,12)).guesses,[null],'Una pregunta cerrada sin respuesta no se reabre');
  assert.deepEqual((await answer(1,12)).guesses,[null,12]);
  assert.deepEqual((await answer(2,null)).guesses,[null,12,null]);
  assert.equal((await practice.status('jugador','daily',true)).id,null,'Con tres preguntas cerradas la práctica está terminada');
}

// ---------- Por la ruta HTTP de verdad: las acciones nuevas llegan a su modo sin tocar lib/api.mjs
{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'faraday-tiempos-'));
  try{
    let time=Date.parse('2026-11-26T12:00:00Z');
    const api=createApi({store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>time,log:()=>{}});
    const cookie='faraday_jugador='+randomUUID();
    const call=async(route,data)=>{
      const response=await api.handle(new Request('https://faraday.test/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',origin:'https://faraday.test',cookie},body:JSON.stringify(data)}));
      return {status:response.status,body:await response.json()};
    };
    const run=(await call('continuacion',{mode:'archivo-vivo',action:'archivo-estado'})).body;
    const seen=await call('continuacion',{mode:'archivo-vivo',action:'archivo-ver',id:run.id,index:0});
    assert.equal(seen.status,200);assert.deepEqual(seen.body.clock,{deadline:time+45000,now:time,seconds:45});
    time+=60000;
    assert.deepEqual((await call('continuacion',{mode:'archivo-vivo',action:'archivo-estado'})).body.guesses,[null]);
    const trends=(await call('tendencias',{action:'estado'})).body;
    const closed=await call('tendencias',{action:'revelar',date:trends.date,game:0,chart:trends.current.id,timeout:true});
    assert.equal(closed.status,200);assert.equal(closed.body.results[0].blank,true);assert.equal(closed.body.results[0].score,0);
  }finally{fs.rmSync(directory,{recursive:true,force:true})}
}

// ---------- Los tres modos usan el reloj común y los tiempos del contrato
{
  const read=name=>fs.readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
  assert.match(read('app.js'),/RoundTimer\.start\(\{key:clockKey\(day,index\),seconds:QUESTION_SECONDS/);
  assert.match(read('app.js'),/QUESTION_SECONDS=window\.RoundTimer\?\.SECONDS\.reto\|\|90/);
  // El reto solo se pausa con el anuncio de la pista (no con su oferta), calla si no está delante y no cierra el anuncio.
  assert.match(read('app.js'),/pauseWhen:hintAd,quietWhen:\(\)=>!dailyInFront\(\)/);
  assert.doesNotMatch(read('app.js'),/hint-dialog\[open\],dialog\.ad-dialog\[open\]/);
  assert.doesNotMatch(read('app.js'),/\[data-ad-close\]/);
  // Los reintentos al agotarse el tiempo tienen tope en Traza y en Archivo Vivo.
  assert.match(read('tendencias.js'),/\+\+tries<MAX_TRIES/);
  assert.match(read('archivo-vivo.js'),/attempt < MAX_TRIES/);
  assert.match(read('tendencias.js'),/RoundTimer\.start\(\{key:clockKey,seconds:seconds\(\)/);
  assert.match(read('archivo-vivo.js'),/RoundTimer\.start\(\{ key, seconds, deadline/);
  const html=read('index.html');
  assert.ok(html.indexOf('round-timer.js')>0&&html.indexOf('round-timer.js')<html.indexOf('src="app.js"'),'El reloj carga antes que el juego');
  assert.match(html,/round-timer\.css/);
}

console.log('tiempos: reloj por fecha de fin, recarga, vencimiento, recorte al total, pausas con margen, avisos y silencio, Archivo Vivo con plazo en servidor, Traza sin trazo y reto extra sin respuesta correctos');
