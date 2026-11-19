import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createAscension} from '../lib/ascension.mjs';
import {AD_SECONDS} from '../lib/continuaciones.mjs';
import {fileAscension} from '../lib/ascension-store.mjs';

const date='2026-11-19',directory=mkdtempSync(path.join(tmpdir(),'ascension-ad-'));
const bank={version:'ads-test',categories:Array.from({length:7},(_,i)=>({id:`tema-${i}`,title:`Categoría ${i}`,theme:`tema-${i}`,sources:[{title:'Fuente',url:'https://example.org'}],answers:[{name:'Cumbre',points:100}]}))};
let clock=Date.parse(date+'T11:00:00Z'),paid=false;
const file=path.join(directory,'runs.json');
const process=()=>createAscension({store:fileAscension(file),bank,now:()=>clock,planOf:async()=>({plus:paid})});
let game=process();
const call=(action,extra={},signed=false)=>game('guest',{action,date,game:0,...extra},signed);
try{
  assert.equal(AD_SECONDS.first,15);
  assert.equal((await call('preparar-practica')).body.code,'daily');
  await call('estado');
  for(let round=0;round<7;round++){
    if(round)await call('siguiente',{round:round-1});
    await call('empezar',{round});await call('responder',{round,answer:''});
  }
  const finished=await call('siguiente',{round:6});assert.equal(finished.body.phase,'finished');
  assert.equal(finished.body.continuation.requiresAd,true);
  await assert.rejects(game.continuation('guest',{action:'reto-extra',mode:'ascension'}),{status:400},'No cruza recibos ni acciones con otras modalidades');
  assert.equal((await call('practica',{watched:true,plus:true})).body.code,'ad','El navegador no puede declarar anuncio visto ni Plus');
  const prepare=await Promise.all([call('preparar-practica'),call('preparar-practica')]);
  assert(prepare.every(result=>result.body.watch));
  assert.equal(await fileAscension(file).latest('publico',date,'guest'),0,'Preparar no abre ninguna partida');
  clock+=14999;game=process();
  assert.equal((await call('preparar-practica')).body.watch,true,'Reanuda la preparación tras reinicio');
  assert.equal((await call('practica')).body.code,'ad','El reloj del servidor impide saltar los 15 segundos');
  clock++;
  assert.equal((await call('practica')).body.code,'ad','El tiempo por sí solo no sustituye al recibo completado');
  await Promise.all([1,2,3].map(()=>game.continuation('guest',{action:'completar',mode:'ascension',date,ticket:prepare[0].body.ticket})));
  const opened=await Promise.all([call('practica'),call('practica')]);
  assert(opened.every(result=>result.body.game===1));assert(opened.every(result=>result.body.ranking===null));
  assert.equal((await call('estado')).body.continuation.resume,true);
  const resumed=await call('preparar-practica');assert.equal(resumed.body.game,1);assert(!resumed.body.watch,'Retomar no consume otro anuncio');
  for(let round=0;round<7;round++){
    if(round)await call('siguiente',{game:1,round:round-1});
    await call('empezar',{game:1,round});await call('responder',{game:1,round,answer:''});
  }
  assert.equal((await call('practica',{game:1})).body.code,'ad','El anuncio de la primera práctica no sirve para la segunda');
  assert.equal((await call('estado')).body.continuation.fromGame,1,'Desde la diaria se puede abrir la siguiente práctica sin pasar por un resumen antiguo');
  assert.equal((await call('practica')).body.game,1,'Un reintento antiguo no crea otra práctica');
  const second=await call('preparar-practica',{game:1});
  assert.equal(second.body.seconds,60,'Los siguientes anuncios duran 60 segundos');
  clock+=15000;
  await assert.rejects(game.continuation('guest',{action:'completar',mode:'ascension',date,ticket:second.body.ticket}),{status:409});
  clock+=45000;await game.continuation('guest',{action:'completar',mode:'ascension',date,ticket:second.body.ticket});
  assert.equal((await call('practica',{game:1,ticket:second.body.ticket})).body.game,2);
  for(let round=0;round<7;round++){
    if(round)await call('siguiente',{game:2,round:round-1});
    await call('empezar',{game:2,round});await call('responder',{game:2,round,answer:''});
  }
  paid=true;
  assert.equal((await call('practica',{game:2})).body.code,'ad','Sin sesión no se concede Plus');
  const premium=await call('preparar-practica',{game:2},true);
  assert.equal(premium.body.game,3);assert.equal(premium.body.continuation.plus,true);assert(!premium.body.watch);
  assert.equal((await game.continuation('guest',{action:'estado',mode:'ascension'},true)).watched,2,'Plus no cuenta como anuncio');
  assert.equal((await call('estado')).body.ranking.total,1,'Las prácticas siguen fuera de clasificación');

  // El ajuste usa los valores exactos de los otros jugadores, sin agrupar ni incluir al propio.
  const store=fileAscension(file),row=await store.get('publico',date,'guest',0);
  const peers=[100,200,300,400,500];
  for(const [i,score] of peers.entries())await store.put({...row,player_hash:`peer-${i}`,score},null);
  const ranking=createAscension({store,bank,now:()=>clock});
  const normal=(await ranking('guest',{action:'estado'})).body.ranking.normal;
  assert.deepEqual(normal,{mean:300,deviation:Math.sqrt(20000)});
  for(let i=0;i<peers.length;i++){const one=await store.get('publico',date,`peer-${i}`,0);await store.put({...one,score:300,version:one.version+1},one.version)}
  assert.equal((await ranking('guest',{action:'estado'})).body.ranking.normal,null,'Sin dispersión no genera valores infinitos');
}finally{rmSync(directory,{recursive:true,force:true})}
console.log('Ascensión: anuncios de 15/60 s, reinicio, concurrencia, Plus, reanudación y ajuste normal: OK');

// El componente de anuncios tampoco acepta clics prematuros aunque otra regla CSS
// hiciese visible por error un botón que todavía tiene el atributo hidden.
{
  let time=0,tick;const handlers=new Map(),done={hidden:true,focus(){}},status={};
  const elements={'.ad-progress i':{style:{setProperty(){}}},'.ad-status':status,'.ad-done':done};
  const dialog={open:false,querySelector:s=>elements[s],setAttribute(){},addEventListener:(e,fn)=>handlers.set(e,fn),showModal(){this.open=true},close(){this.open=false}};
  const page={window:{},document:{createElement:()=>dialog,body:{append(){}}},Date:{now:()=>time},setInterval:fn=>{tick=fn;return 1},clearInterval(){}};
  vm.createContext(page);vm.runInContext(readFileSync(new URL('../dist/ads.js',import.meta.url),'utf8'),page);
  const watched=page.window.Ads.rewarded({kind:'continuation'});
  const clickDone=()=>handlers.get('click')({target:{closest:selector=>selector==='.ad-done'?done:null}});
  clickDone();assert.equal(dialog.open,true);assert.equal(done.hidden,true);
  time=14999;tick();clickDone();assert.equal(dialog.open,true,'No termina antes de los 15 segundos');
  time=15000;tick();assert.equal(done.hidden,false);clickDone();assert.equal(await watched,true);
  const cancelled=page.window.Ads.rewarded({kind:'continuation'});
  handlers.get('click')({target:{closest:selector=>selector==='[data-ad-close]'?{}:null}});
  assert.equal(await cancelled,false,'Cancelar no da recompensa');
}
