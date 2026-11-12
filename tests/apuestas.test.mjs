// Prueba las apuestas de los duelos (decisión 0041): las reglas del navegador (dist/bets-rules.js) y lo que guarda el
// servidor (lib/apuestas.mjs a través de la API de duelos): desbloqueo por nivel, saldo, tope diario, cobro una sola vez,
// liquidación de victoria, derrota, empate y abandono, y que no se paga dos veces.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {BET_LEVELS,betTier} from '../lib/apuestas.mjs';

const page={};page.window=page;vm.createContext(page);
vm.runInContext(fs.readFileSync(new URL('../dist/bets-rules.js',import.meta.url),'utf8'),page,{filename:'dist/bets-rules.js'});
const R=page.BetRules,DAY='2026-11-12';

// Tres niveles, de menos a más, con el primero en el nivel 10; el servidor conoce los mismos y con los mismos niveles.
assert.deepEqual(Array.from(R.IDS),['chispazo','calambre','alto-voltaje']);
assert.equal(R.UNLOCK,10);
assert.deepEqual(Object.fromEntries(Array.from(R.IDS,id=>[id,R.TIERS[id].level])),BET_LEVELS,'dist/bets-rules.js y lib/apuestas.mjs coinciden');
const amounts=Array.from(R.IDS,id=>R.TIERS[id].amount);
assert.deepEqual(amounts,[...amounts].sort((a,b)=>a-b));
// Encaja en la economía: la apuesta baja no pasa de dos duelos ganados y lo más que se pierde en un día no llega a un cofre Tormenta (1.100 ≈).
assert.ok(R.TIERS.chispazo.amount<=30);assert.ok(R.DAILY_CAP*amounts.at(-1)<1100);

// Desbloqueo por nivel.
assert.equal(R.unlocked('chispazo',9),false,'Por debajo del nivel 10, bloqueada');
assert.equal(R.unlocked('chispazo',10),true);
assert.equal(R.unlocked('calambre',11),false);assert.equal(R.unlocked('calambre',12),true);
assert.equal(R.unlocked('alto-voltaje',14),false);assert.equal(R.unlocked('alto-voltaje',15),true);
assert.equal(R.unlocked('inventada',99),false);

// Saldo insuficiente y tope diario.
const empty=R.empty();
assert.deepEqual({...R.check('chispazo',{level:9,coins:999,ledger:empty,day:DAY})},{ok:false,reason:'nivel'});
assert.deepEqual({...R.check('chispazo',{level:10,coins:24,ledger:empty,day:DAY})},{ok:false,reason:'saldo'});
assert.deepEqual({...R.check('chispazo',{level:10,coins:25,ledger:empty,day:DAY})},{ok:true,reason:''});
let poor=R.stake(empty,'d0','calambre',{level:20,coins:59,day:DAY});
assert.equal(poor.charged,0,'Sin saldo no se cobra');assert.equal(poor.reason,'saldo');assert.equal(Object.keys(poor.ledger.duels).length,0);

// Cobro: una sola vez por duelo.
let first=R.stake(empty,'d1','calambre',{level:12,coins:500,day:DAY,now:1});
assert.equal(first.charged,60);assert.equal(first.ledger.duels.d1.status,'open');assert.equal(first.ledger.count,1);
const again=R.stake(first.ledger,'d1','calambre',{level:12,coins:440,day:DAY,now:2});
assert.equal(again.charged,0,'No se apuesta dos veces en el mismo duelo');assert.equal(again.ledger,first.ledger);

// Tope diario: cinco apuestas al día; al día siguiente vuelve a haber.
let ledger=empty;
for(let i=0;i<R.DAILY_CAP;i++){const result=R.stake(ledger,'t'+i,'chispazo',{level:10,coins:1000,day:DAY});assert.equal(result.charged,25);ledger=result.ledger}
const capped=R.stake(ledger,'t-extra','chispazo',{level:10,coins:1000,day:DAY});
assert.equal(capped.charged,0);assert.equal(capped.reason,'tope');
assert.equal(R.stake(ledger,'t-next','chispazo',{level:10,coins:1000,day:'2026-11-13'}).charged,25,'El tope se reinicia cada día');

// Liquidación. El resultado sale de la vista del jugador que da el servidor.
const view=(winner,reason='ko')=>({status:'finished',winner,reason});
assert.equal(R.outcome(view('you')),'won');assert.equal(R.outcome(view('rival')),'lost');assert.equal(R.outcome(view('draw','rondas')),'draw');
assert.equal(R.outcome(view('rival','abandono')),'lost','Abandonar cuenta como perder');
assert.equal(R.outcome(view('you','abandono')),'won','Si abandona el rival, ganas');
assert.equal(R.outcome({status:'playing'}),null,'Un duelo en marcha no se liquida');
const settle=(result,amount=60)=>{const staked=R.stake(R.empty(),'x','calambre',{level:12,coins:amount,day:DAY});return R.settle(staked.ledger,'x',result)};
let won=settle('won');assert.equal(won.paid,120,'Gana: recupera la apuesta y otro tanto');assert.equal(won.entry.delta,60);
let lost=settle('lost');assert.equal(lost.paid,0,'Pierde: la pierde');assert.equal(lost.entry.delta,-60);
let draw=settle('draw');assert.equal(draw.paid,60,'Empate: la recupera');assert.equal(draw.entry.delta,0);
let quit=settle(R.outcome(view('rival','abandono')));assert.equal(quit.paid,0);assert.equal(quit.entry.status,'lost');
// No se cobra dos veces el mismo duelo.
const twice=R.settle(won.ledger,'x','won');assert.equal(twice.paid,0,'Un duelo ya liquidado no paga más');assert.equal(twice.ledger,won.ledger);
assert.equal(R.settle(won.ledger,'x','lost').paid,0);
assert.equal(R.settle(R.empty(),'sin-apuesta','won').paid,0,'Sin apunte no hay premio');
assert.equal(R.settle(first.ledger,'d1','raro').paid,0,'Un resultado desconocido no paga');

// Lo guardado se limpia al cargar: niveles inventados o importes cambiados a mano no cuentan.
const loaded=R.normalize({choice:'trampa',count:-3,day:'ayer',duels:{a:{tier:'calambre',amount:9999,status:'open'},b:{tier:'nada',status:'open'},c:{tier:'chispazo',status:'cobrado'}}});
assert.equal(loaded.choice,'');assert.equal(loaded.count,0);assert.equal(loaded.day,'');
assert.deepEqual(Object.keys(loaded.duels),['a']);assert.equal(loaded.duels.a.amount,60,'El importe sale de la tabla, no de lo guardado');
assert.equal(R.normalize(null).choice,'');
// Se guardan los últimos 40 apuntes, pero los abiertos nunca se borran.
ledger=R.empty();
for(let i=0;i<45;i++){const day=`2026-12-${String(1+Math.floor(i/5)).padStart(2,'0')}`;const result=R.stake(ledger,'p'+i,'chispazo',{level:10,coins:1e6,day,now:i});ledger=i===0?result.ledger:R.settle(result.ledger,'p'+i,'lost').ledger}
assert.equal(Object.keys(ledger.duels).length,40);assert.equal(ledger.duels.p0.status,'open');

// Servidor: valida el nivel de apuesta, lo enseña a los dos y lo anula contra el bot.
assert.equal(betTier('calambre',12),'calambre');assert.equal(betTier('calambre',11),null,'Sin nivel, el servidor no la acepta');
assert.equal(betTier('<b>',99),null);assert.equal(betTier('toString',99),null);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-apuestas-'));
try{
  let clock=Date.parse('2026-11-12T10:00:00Z'),seed=11;
  const api=createApi({store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,random:()=>{seed=(seed*16807)%2147483647;return seed/2147483647},log:()=>{}});
  const duel=async(action,player,extra={})=>{const response=await api.handle(new Request('http://casi.test/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,player,...extra})}));return {status:response.status,data:await response.json()}};
  const ana=randomUUID(),luis=randomUUID();
  let a=await duel('buscar',ana,{name:'Ana',level:15,bet:'alto-voltaje'});
  let b=await duel('buscar',luis,{name:'Luis',level:4,bet:'chispazo'});
  assert.equal(b.data.id,a.data.id);
  assert.equal(b.data.players[0].bet,'alto-voltaje','El rival ve la apuesta');assert.equal(b.data.players[1].bet,null,'Con nivel 4 no hay apuesta');
  clock+=1000;a=await duel('estado',ana,{id:a.data.id});
  assert.equal(a.data.players[0].bet,'alto-voltaje');assert.equal(a.data.status,'playing');
  // Abandona Ana: pierde. Luis gana sin haber apostado.
  a=await duel('salir',ana,{id:a.data.id});
  assert.equal(R.outcome(a.data),'lost');b=await duel('estado',luis,{id:a.data.id});assert.equal(R.outcome(b.data),'won');
  // Contra Faraday-bot no se apuesta.
  a=await duel('crear',ana,{name:'Ana',level:15,bet:'calambre'});assert.equal(a.data.players[0].bet,'calambre');
  a=await duel('bot',ana,{id:a.data.id});
  assert.equal(a.data.players[0].bet,null,'Contra el bot, la apuesta desaparece');assert.equal(a.data.players[1].bet,null);
}finally{if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(directory,{recursive:true,force:true})}

console.log('OK: apuestas (niveles, desbloqueo, saldo, tope diario, cobro único, victoria, derrota, empate, abandono, sin doble cobro, bot y servidor).');
