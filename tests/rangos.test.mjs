// Prueba las clasificatorias (lib/rangos.mjs): cálculo de PR, divisiones, ascensos, colchón, límites y el emparejamiento
// a través de la API de duelos, con un reloj controlado. No usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {RANKED_MIN_LEVEL,RANKS,RULES,TOP,rankOf,applyResult,publicRank,expected,fresh,memoryRanks} from '../lib/rangos.mjs';
import {RULES as DUEL} from '../lib/duelos.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-rangos-'));
let clock=Date.parse('2026-11-12T10:00:00Z'),seed=11;
const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
function build(store){
  const api=createApi({store,persistDays:false,now:()=>clock,random,log:()=>{}});
  return async(action,player,extra={})=>{
    const response=await api.handle(new Request('http://casi.test/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,player,...extra})}));
    return {status:response.status,data:await response.json()};
  };
}
const placed=(rating,extra={})=>({...fresh(),rating,games:RULES.placement,peak:rating,...extra});

try{
  // Rangos: 8, de Bronce a Científico, con nombres y colores distintos.
  assert.equal(RANKS.length,8);assert.equal(RANKS[0].name,'Bronce');assert.equal(RANKS.at(-1).name,'Científico');
  assert.equal(new Set(RANKS.map(r=>r.color)).size,RANKS.length,'Cada rango tiene su color');
  assert.equal(TOP,2100);

  // Divisiones: III → II → I, 100 PR cada una.
  assert.deepEqual(rankOf(0),{...rankOf(0),name:'Bronce',division:'III',pr:0,label:'Bronce III'});
  assert.equal(rankOf(99).label,'Bronce III');assert.equal(rankOf(100).label,'Bronce II');assert.equal(rankOf(250).label,'Bronce I');assert.equal(rankOf(250).pr,50);
  assert.equal(rankOf(300).label,'Plata III');assert.equal(rankOf(899).label,'Oro I');assert.equal(rankOf(900).label,'Calculista III');
  assert.equal(rankOf(2099).label,'Eminencia I');
  // Científico: sin divisiones, con los PR por encima del umbral.
  assert.equal(rankOf(2100).label,'Científico');assert.equal(rankOf(2100).division,'');assert.equal(rankOf(2345).pr,245);assert.equal(rankOf(2345).top,true);
  assert.equal(rankOf(-50).label,'Bronce III','Nunca por debajo de 0');

  // Elo: igualados, 50 %; 400 por encima, 10 a 1.
  assert.equal(expected(1000,1000),.5);assert.ok(Math.abs(expected(1400,1000)-10/11)<1e-9);

  // PR: ganar a un igual da +18; perder, −18; empate neutro.
  let r=applyResult(placed(1050),{score:1,mine:1050,rival:1050});assert.equal(r.outcome.delta,18);assert.equal(r.record.wins,1);assert.equal(r.record.games,RULES.placement+1);
  r=applyResult(placed(1050),{score:0,mine:1050,rival:1050});assert.equal(r.outcome.delta,-18);assert.equal(r.record.losses,1);
  r=applyResult(placed(1050),{score:.5,mine:1050,rival:1050});assert.equal(r.outcome.delta,0);assert.equal(r.record.draws,1);assert.equal(r.outcome.change,'same');
  // Ajuste por diferencia: ganar a alguien mucho mejor da más; perder contra él quita menos.
  const upset=applyResult(placed(1050),{score:1,mine:1050,rival:1450}).outcome.delta,easy=applyResult(placed(1050),{score:1,mine:1050,rival:650}).outcome.delta;
  assert.ok(upset>18&&easy<18,`${upset} > 18 > ${easy}`);
  assert.ok(applyResult(placed(1050),{score:0,mine:1050,rival:1450}).outcome.delta>-18);
  // Límites: ganar siempre suma algo y nada mueve más de maxChange.
  assert.equal(applyResult(placed(2000),{score:1,mine:2000,rival:0}).outcome.delta,RULES.minWin);
  assert.ok(applyResult(placed(0),{score:1,mine:0,rival:3000}).outcome.delta<=RULES.maxChange);
  assert.equal(applyResult(placed(5),{score:0,mine:5,rival:5}).record.rating,0,'Nunca por debajo de 0');

  // Ascenso de división y de rango, con colchón.
  r=applyResult(placed(390),{score:1,mine:390,rival:390});assert.equal(r.outcome.change,'division-up');assert.equal(rankOf(r.record.rating).label,'Plata II');assert.equal(r.record.shield,RULES.shield);
  r=applyResult(placed(590),{score:1,mine:590,rival:590});assert.equal(r.outcome.change,'rank-up');assert.equal(rankOf(r.record.rating).label,'Oro III');
  // Con colchón, perder justo después de subir no te devuelve a la división anterior.
  let after=applyResult(r.record,{score:0,mine:r.record.rating,rival:r.record.rating});
  assert.equal(after.record.rating,600);assert.equal(after.outcome.shielded,true);assert.equal(after.outcome.change,'same');assert.equal(after.record.shield,RULES.shield-1);
  // Se gasta con las partidas: tras el colchón, sí se baja.
  let rec=after.record;for(let i=0;i<RULES.shield;i++)rec=applyResult(rec,{score:0,mine:rec.rating,rival:rec.rating}).record;
  assert.equal(rec.shield,0);
  const down=applyResult(placed(605),{score:0,mine:605,rival:605});assert.equal(down.outcome.change,'rank-down');assert.equal(rankOf(down.record.rating).label,'Plata I');
  assert.equal(applyResult(placed(405),{score:0,mine:405,rival:405}).outcome.change,'division-down');
  // A Científico.
  r=applyResult(placed(2090),{score:1,mine:2090,rival:2090});assert.equal(r.outcome.change,'rank-up');assert.equal(rankOf(r.record.rating).label,'Científico');

  // Posicionamiento: 5 partidas que mueven el doble, sin rango a la vista hasta terminarlas.
  assert.equal(publicRank(null).placing,true);assert.equal(publicRank(null).label,'Sin clasificar');assert.equal(publicRank(null).placementLeft,RULES.placement);assert.equal(publicRank(null).rating,null);
  rec=fresh();for(let i=0;i<RULES.placement;i++){const step=applyResult(rec,{score:1,mine:rec.rating,rival:rec.rating});assert.equal(step.outcome.change,i<RULES.placement-1?'placement':'placed');rec=step.record}
  assert.ok(rec.rating>=RULES.start+RULES.placement*RULES.k,'Cinco victorias de posicionamiento suben más que cinco normales');assert.equal(publicRank(rec).placing,false);assert.equal(rec.shield,0);

  // Almacén: un duelo solo se apunta una vez.
  const memory=memoryRanks();let calls=0;const update=record=>{calls++;return applyResult(record,{score:1,mine:300,rival:300})};
  const first=await memory.settle('a'.repeat(64),'duelo-1',update,{name:'Ana',avatar:{}}),again=await memory.settle('a'.repeat(64),'duelo-1',update,{name:'Ana',avatar:{}});
  assert.deepEqual(first,again);assert.equal(calls,1);assert.equal((await memory.get('a'.repeat(64))).games,1);

  // Por la API: dos jugadores en clasificatoria se emparejan; uno en normal no se mezcla con ellos.
  const duel=build(fileStore(path.join(directory,'answers.json')));
  const ana=randomUUID(),luis=randomUUID(),eva=randomUUID();
  let mine=await duel('rango',ana);assert.equal(mine.status,200);assert.equal(mine.data.rank.placing,true);assert.deepEqual(mine.data.top,[]);
  // Bloqueo por nivel: por debajo del 10 solo se juega en normal.
  assert.equal(RANKED_MIN_LEVEL,10);
  let locked=await duel('buscar',ana,{name:'Ana',mode:'ranked',level:9});assert.equal(locked.status,403);assert.match(locked.data.error,/nivel 10/);
  assert.equal((await duel('buscar',ana,{name:'Ana',mode:'ranked'})).status,403,'Sin nivel, cuenta como nivel 1');
  let a=await duel('buscar',ana,{name:'Ana',mode:'ranked',level:12});
  assert.equal(a.data.status,'waiting');assert.equal(a.data.mode,'ranked');assert.equal(a.data.players[0].rank.label,'Sin clasificar');assert.equal(a.data.players[0].rank.rating,null,'La valoración de posicionamiento no se enseña');
  let e=await duel('buscar',eva,{name:'Eva'});
  assert.notEqual(e.data.id,a.data.id,'Una partida normal no entra en una clasificatoria');assert.equal(e.data.mode,undefined);
  // Por código tampoco se entra en una clasificatoria.
  assert.equal((await duel('unirse',eva,{code:a.data.code})).status,409);
  let b=await duel('buscar',luis,{name:'Luis',mode:'ranked',level:12});
  assert.equal(b.data.id,a.data.id,'Se emparejan los dos de clasificatoria');assert.equal(b.data.phase,'intro');assert.equal(b.data.rankResult,null);
  const id=a.data.id;
  // Luis abandona: gana Ana. Los PR se apuntan una sola vez aunque los dos consulten varias veces.
  b=await duel('salir',luis,{id});assert.equal(b.data.status,'finished');
  assert.equal(b.data.rankResult.delta,-RULES.placementK/2);assert.equal(b.data.rankResult.change,'placement');
  a=await duel('estado',ana,{id});assert.equal(a.data.rankResult.delta,RULES.placementK/2);
  a=await duel('estado',ana,{id});b=await duel('estado',luis,{id});
  mine=await duel('rango',ana);assert.equal(mine.data.rank.games,1);assert.equal(mine.data.rank.wins,1);assert.equal(mine.data.rank.placementLeft,RULES.placement-1);
  assert.equal((await duel('rango',luis)).data.rank.losses,1);
  // La revancha es un duelo normal.
  const rematch=await duel('revancha',ana,{id});assert.equal(rematch.data.mode,undefined);

  // El bot nunca cuenta para clasificatoria.
  a=await duel('buscar',ana,{name:'Ana',mode:'ranked',level:12});
  a=await duel('bot',ana,{id:a.data.id});assert.equal(a.data.mode,undefined);
  await duel('salir',ana,{id:a.data.id});
  assert.equal((await duel('rango',ana)).data.rank.games,1,'Abandonar contra el bot no resta PR');

  // Con varios esperando, se prefiere al de valoración más parecida.
  const ranks=memoryRanks(),players=[randomUUID(),randomUUID(),randomUUID()];
  const store={...fileStore(path.join(directory,'b','answers.json')),ranks};
  const duel2=build(store),hashOf=async player=>(await import('node:crypto')).createHash('sha256').update(player).digest('hex');
  for(const [player,rating] of [[players[0],2200],[players[1],600],[players[2],650]])await ranks.settle(await hashOf(player),'semilla',()=>({record:placed(rating),outcome:{}}),{name:'X',avatar:{}});
  const high=await duel2('buscar',players[0],{name:'Alta',mode:'ranked',level:12});clock+=1000;
  const low=await duel2('buscar',players[1],{name:'Baja',mode:'ranked',level:12});
  assert.equal(low.data.id,high.data.id,'Si solo hay uno esperando, se juega con él aunque esté lejos');
  assert.equal(low.data.players[0].rank.label,'Científico');
  // La cumbre: los Científicos se ordenan por puntos.
  const cumbre=await duel2('rango',players[0]);assert.equal(cumbre.data.position,1);assert.equal(cumbre.data.top[0].pr,100);assert.equal(cumbre.data.top[0].you,true);
  assert.equal((await duel2('rango',players[1])).data.position,null);assert.equal(low.data.players[1].rank.label,'Oro III');

  // Si el almacén de rangos falla (tabla sin crear), las clasificatorias se apagan y los duelos normales siguen.
  const broken={async get(){throw Error('relation "ranks" does not exist')},async settle(){throw Error('no')},async top(){throw Error('no')}};
  const duel3=build({...fileStore(path.join(directory,'c','answers.json')),ranks:broken});
  assert.equal((await duel3('buscar',randomUUID(),{mode:'ranked',level:12})).status,503);
  assert.equal((await duel3('rango',randomUUID())).status,503);
  assert.equal((await duel3('buscar',randomUUID(),{})).status,200,'Los duelos normales siguen funcionando');
  clock+=DUEL.freshMs*2;

  console.log('rangos: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
