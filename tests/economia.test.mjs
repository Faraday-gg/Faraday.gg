// Prueba el simulador de la economía (scripts/simular-economia.mjs, decisiones 0055 y 0056):
// 1. que las cifras copiadas en el simulador siguen siendo las del juego;
// 2. que las cuentas cuadran (saldo = emitido − gastado + recibido de otros jugadores);
// 3. el diagnóstico de la economía de hoy, y
// 4. que las cifras de la economía propuesta cumplen sus objetivos. Si alguien cambia un premio o un precio y la
//    economía deja de cumplirlos, esta prueba avisa.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {HOY,PROPUESTA,PERFILES,MISSIONS,Chests,simulate,average,catalog,levelOf} from '../scripts/simular-economia.mjs';
import {RULES as COMUNIDAD} from '../lib/comunidad.mjs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const has=(source,text,message)=>assert.ok(source.replace(/\s/g,'').includes(text.replace(/\s/g,'')),message||`Falta «${text}»`);

// 1. Las cifras del simulador son las del juego.
const progress=read('dist/progress.js'),duel=read('dist/duel.js');
has(progress,`welcome:${HOY.welcome},answerXp:${HOY.answerXp},todayXp:${HOY.todayXp},todayCoins:${HOY.todayCoins},archiveXp:${HOY.archiveXp},archiveCoins:${HOY.archiveCoins},streakCoins:${HOY.streakCoins},streakCap:${HOY.streakCap},missionXp:${HOY.missionXp}`,'REWARD de progress.js ha cambiado: actualiza HOY en el simulador');
has(progress,`duel:{win:${HOY.duel.win},draw:8,loss:${HOY.duel.loss}},levelCoins:${HOY.levelCoins}`);
has(progress,`charge:{today:${HOY.charge.today},archive:${HOY.charge.archive},full:${HOY.charge.full}}`);
has(progress,'const accuracy=detail.average<1.5?15:detail.average<2?10:detail.average<3?5:0');
for(const [id,mission] of Object.entries(MISSIONS))assert.match(progress,new RegExp(`'${id}':\\{[^}]*coins:${mission.coins},`),`La misión ${id} ya no da ${mission.coins} ≈`);
has(duel,`DAILY_FULL=${HOY.duel.full},CAPPED_FACTOR=.25`);assert.equal(HOY.duel.capped,.25);
has(duel,`charge:abandoned||(bot&&daily.bot)?0:capped?${HOY.charge.duelCapped}:${HOY.charge.duel}`);
has(read('dist/pistas.js'),`COST=${HOY.hint}`);
// Lo que ya está en el juego de la economía nueva (decisión 0066): faradios por las tres misiones del día y tope diario.
has(progress,`daySet:${PROPUESTA.dailySet.coins},dayCap:${PROPUESTA.cap}}`);assert.equal(PROPUESTA.dailySet.chest,null);assert.equal(PROPUESTA.fallback,1);assert.equal(HOY.fallback,4);assert.equal(PROPUESTA.bets.mode,'bote');
assert.equal(COMUNIDAD.voteCost,HOY.vote);assert.equal(COMUNIDAD.proposeCost,HOY.propose);
{
  const page={};page.window=page;vm.createContext(page);vm.runInContext(read('dist/bets-rules.js'),page);
  assert.equal(page.BetRules.DAILY_CAP,HOY.bets.cap);
  assert.deepEqual(HOY.bets.tiers,Object.values(page.BetRules.TIERS).map(tier=>[tier.level,tier.amount]).sort((a,b)=>b[0]-a[0]));
}
assert.equal(levelOf(99),1);assert.equal(levelOf(100),2);assert.equal(levelOf(4500),10);

// 2. Las cuentas cuadran, y con la misma semilla sale lo mismo.
for(const rules of [HOY,PROPUESTA])for(const profile of Object.values(PERFILES)){
  const run=simulate({rules,profile,days:120,seed:5});
  assert.equal(run.balance,run.emittedTotal-run.spentTotal+run.moved,`${rules.name}/${profile.name}: el saldo no cuadra`);
  assert.deepEqual(simulate({rules,profile,days:120,seed:5}).daily,run.daily);
  assert.ok(run.daily.every(coins=>coins>=0));
}
assert.ok(catalog('hombre').length>100&&catalog('mujer').length>100);

// 3 y 4. Un año de juego, 40 jugadores por perfil.
const year=(rules,profile)=>average({rules,profile,days:365,players:40});
const hoy={diario:year(HOY,PERFILES.diario),intenso:year(HOY,PERFILES.intenso)};
const nueva=Object.fromEntries(Object.entries(PERFILES).map(([id,profile])=>[id,year(PROPUESTA,profile)]));

// Hoy: el jugador diario completa el catálogo en menos de cinco meses y después casi no gasta; al intenso le sobra todo.
assert.equal(hoy.diario.completed,1);
assert.ok(hoy.diario.completeDay<150,`Hoy el catálogo dura ${hoy.diario.completeDay} días`);
assert.ok(hoy.diario.lateRatio<.3,`Hoy, al final, se gasta el ${hoy.diario.lateRatio}`);
assert.ok(hoy.intenso.perDay>2*PROPUESTA.cap,'Hoy el jugador intenso emite más del doble del tope propuesto');

// Propuesta. La moneda pesa al menos la mitad de lo que recibe un jugador diario.
assert.ok(nueva.diario.coinShare>=.5,`Peso de la moneda: ${nueva.diario.coinShare}`);
// Pasado el año, el jugador diario sigue gastando entre el 80 y el 95 % de lo que gana; al intenso no le sobra más del 20 %.
assert.ok(nueva.diario.lateRatio>=.8&&nueva.diario.lateRatio<=.95,`Gasto del jugador diario: ${nueva.diario.lateRatio}`);
assert.ok(nueva.intenso.lateRatio>=.8&&nueva.intenso.lateRatio<=1,`Gasto del jugador intenso: ${nueva.intenso.lateRatio}`);
// El catálogo permanente dura al menos el doble que hoy.
assert.ok(nueva.diario.completeDay==null||nueva.diario.completeDay>2*hoy.diario.completeDay,`El catálogo dura ${nueva.diario.completeDay} días`);
// Jugar más da más, pero el intenso no gana más del doble que el diario, y el ocasional no se queda sin nada que comprar.
assert.ok(nueva.intenso.perDay>nueva.diario.perDay&&nueva.intenso.perDay<2*nueva.diario.perDay);
assert.ok(nueva.ocasional.perDay>=50&&nueva.ocasional.owned<1);
// Las apuestas en bote no crean faradios.
assert.equal(nueva.intenso.emitted.apuestas,undefined);assert.ok(hoy.intenso.emitted.apuestas>0);

console.log('economia.test.mjs: OK');
