// Prueba las reglas del Salón (dist/casino-rules.js): pagos de la ruleta, la tragaperras y el póker, y el monedero de
// prueba con su apuesta máxima y su límite diario de pérdidas.
import assert from 'node:assert/strict';
import '../dist/casino-rules.js';

const R=globalThis.CasinoRules;

// Ruleta: 18 rojos, 18 negros y un cero; la rueda tiene los 37 números una vez.
assert.equal(R.RED.size,18);
assert.deepEqual([...R.WHEEL].sort((a,b)=>a-b),Array.from({length:37},(_,n)=>n));
assert.equal(R.color(0),'green');assert.equal(R.color(32),'red');assert.equal(R.color(15),'black');
assert.equal(R.roulette({type:'number',n:7},7),36);
assert.equal(R.roulette({type:'number',n:7},8),0);
assert.equal(R.roulette({type:'red'},32),2);
assert.equal(R.roulette({type:'red'},0),0);
assert.equal(R.roulette({type:'even'},0),0);
assert.equal(R.roulette({type:'dozen2'},24),3);
assert.equal(R.roulette({type:'inventada'},5),0);
assert.equal(R.roulette({type:'toString'},5),0);
// Todas las apuestas devuelven 36/37 de media: la casa se queda 1/37.
for(const bet of [{type:'number',n:17},...Object.keys(R.ROULETTE).map(type=>({type}))]){
  let back=0;for(let n=0;n<=36;n++)back+=R.roulette(bet,n);
  assert.equal(back,36,`la apuesta ${bet.type} devuelve 36 de 37`);
}
assert.equal(R.spin(()=>0),0);assert.equal(R.spin(()=>.9999),36);

// Tragaperras: trío, pareja en los dos primeros rodillos y nada.
assert.equal(R.slots([0,0,0]),150);
assert.equal(R.slots([5,5,5]),5);
assert.equal(R.slots([2,2,4]),R.PAIR);
assert.equal(R.slots([2,4,4]),0);
assert.equal(R.slots([1,2,1]),0);
const back=R.slotsReturn();
assert.ok(back>.9&&back<.95,`la tragaperras devuelve ${(back*100).toFixed(1)} %`);
assert.deepEqual(R.pull(()=>0),[0,0,0]);
assert.deepEqual(R.pull(()=>.9999),[5,5,5]);

// Póker: cada jugada de la tabla.
const cards=text=>text.split(' ').map(t=>({r:{J:11,Q:12,K:13,A:14}[t.slice(0,-1)]||Number(t.slice(0,-1)),s:R.SUITS.indexOf(t.slice(-1))}));
const cases={
  royal:'10♠ J♠ Q♠ K♠ A♠',straightFlush:'5♥ 6♥ 7♥ 8♥ 9♥',four:'9♠ 9♥ 9♦ 9♣ 2♠',full:'K♠ K♥ K♦ 4♣ 4♠',
  flush:'2♦ 6♦ 9♦ J♦ K♦',straight:'A♠ 2♥ 3♦ 4♣ 5♠',three:'7♠ 7♥ 7♦ 2♣ K♠',twoPair:'8♠ 8♥ 3♦ 3♣ K♠',
  jacks:'J♠ J♥ 3♦ 6♣ K♠',nothing:'10♠ 10♥ 3♦ 6♣ K♠'
};
for(const [name,text] of Object.entries(cases))assert.equal(R.hand(cards(text)),name,text);
assert.equal(R.hand(cards('2♠ 3♥ 4♦ 5♣ 7♠')),'nothing');
assert.equal(R.hand(cards('10♠ J♥ Q♦ K♣ A♠')),'straight');
assert.equal(R.poker(cards(cases.full)),8);assert.equal(R.poker(cards(cases.nothing)),0);
const pack=R.deck();
assert.equal(new Set(pack.map(R.label)).size,52);
const first=pack.slice(0,5),changed=R.draw(first,[true,false,true,false,false],pack.slice(5));
assert.equal(changed[0],first[0]);assert.equal(changed[2],first[2]);
assert.deepEqual([changed[1],changed[3],changed[4]],pack.slice(5,8));

// Monedero: saldo inicial, apuesta mínima y máxima, límite diario y suelo al cambiar de día.
let w=R.wallet(null,'2026-11-21',40);
assert.deepEqual(w,{coins:R.START,day:'2026-11-21',net:0});
assert.equal(R.wallet(null,'2026-11-21',5000).coins,5000);
assert.equal(R.check(w,R.MIN_BET-1).reason,'bet');
assert.equal(R.check(w,R.MAX_BET+1).reason,'bet');
assert.equal(R.check(w,12.5).reason,'bet');
assert.ok(R.check(w,R.MAX_BET).ok);
let result=R.settle(w,100,0);
assert.equal(result.delta,-100);assert.deepEqual(result.wallet,{coins:900,day:'2026-11-21',net:100});
result=R.settle(result.wallet,50,2);
assert.equal(result.delta,50);assert.equal(result.wallet.coins,950);assert.equal(result.wallet.net,50);
w=result.wallet;
while(R.check(w,100).ok)w=R.settle(w,100,0).wallet;
assert.equal(R.check(w,100).reason,'limit');
assert.ok(w.net<=R.DAILY_LOSS,'no se supera el límite');
assert.ok(R.check(w,50).ok);
assert.equal(R.settle(w,50,0).wallet.net,R.DAILY_LOSS);
assert.equal(R.check({coins:3,day:'2026-11-21',net:0},5).reason,'coins');
const next=R.wallet({coins:3,day:'2026-11-21',net:480},'2026-11-22');
assert.deepEqual(next,{coins:R.FLOOR,day:'2026-11-22',net:0});
assert.equal(R.wallet({coins:'x',day:1,net:'y'},'2026-11-22').coins,R.FLOOR);

console.log('casino: todo correcto');
