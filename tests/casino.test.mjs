// Prueba las reglas del Salón (dist/casino-rules.js): pagos de la ruleta y la tragaperras, el Texas Hold'em y el
// monedero de prueba con su apuesta máxima y su límite diario de pérdidas.
import assert from 'node:assert/strict';
import '../dist/casino-rules.js';

const R=globalThis.CasinoRules;

// Ruleta: 18 rojos, 18 negros y un cero; la rueda tiene los 37 números una vez.
assert.equal(R.RED.size,18);
assert.deepEqual([...R.WHEEL].sort((a,b)=>a-b),Array.from({length:37},(_,n)=>n));
assert.equal(R.color(0),'green');assert.equal(R.color(32),'red');assert.equal(R.color(15),'black');
assert.equal(R.roulette('n7',7),36);
assert.equal(R.roulette('n7',8),0);
assert.equal(R.roulette('red',32),2);
assert.equal(R.roulette('red',0),0);
assert.equal(R.roulette('even',0),0);
assert.equal(R.roulette('dozen2',24),3);
assert.equal(R.roulette('col1',34),3);assert.equal(R.roulette('col3',36),3);
assert.equal(R.roulette('s17-20',20),18);   // caballo
assert.equal(R.roulette('s0-2',0),18);
assert.equal(R.roulette('t13',15),12);      // transversal
assert.equal(R.roulette('c25',29),9);       // cuadro
assert.equal(R.roulette('l31',36),6);       // seisena
assert.equal(R.roulette('s3-4',3),0);       // el 3 y el 4 no se tocan en el tapete
assert.equal(R.roulette('inventada',5),0);
assert.equal(R.roulette('toString',5),0);
// 37 plenos, 60 caballos, 14 transversales, 23 cuadros, 11 seisenas, 3 columnas, 3 docenas y 6 suertes sencillas.
assert.equal(Object.keys(R.SPOTS).length,37+60+14+23+11+3+3+6);
// Todas las casillas devuelven 36/37 de media: la casa se queda 1/37.
for(const id of Object.keys(R.SPOTS)){
  let back=0;for(let n=0;n<=36;n++)back+=R.roulette(id,n);
  assert.equal(back,36,`la apuesta ${id} devuelve 36 de 37`);
}
// Las apuestas anunciadas usan casillas que existen; vecinos, tercio y huérfanos se reparten la rueda entera.
const covered=id=>[...new Set(R.CALLS[id].chips.flatMap(([place])=>R.SPOTS[place].numbers))];
assert.deepEqual([...covered('voisins'),...covered('tiers'),...covered('orphans')].sort((x,y)=>x-y),Array.from({length:37},(_,n)=>n));
assert.equal(R.CALLS.voisins.chips.reduce((sum,[,chips])=>sum+chips,0),9);
assert.ok(covered('zero').every(n=>covered('voisins').includes(n)));
// Varias fichas en un giro: total apostado y lo que vuelve.
const bets={n17:5,'s17-20':10,black:25};
assert.equal(R.rouletteStake(bets),40);
assert.equal(R.rouletteReturn(bets,17),5*36+10*18+25*2);
assert.equal(R.rouletteReturn(bets,20),10*18+25*2);
assert.equal(R.rouletteReturn(bets,0),0);
assert.ok(Number.isNaN(R.rouletteStake({n17:0})));assert.ok(Number.isNaN(R.rouletteStake({n99:5})));assert.ok(Number.isNaN(R.rouletteStake({red:2.5})));
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

// Baraja.
const cards=text=>text.split(' ').map(t=>({r:{J:11,Q:12,K:13,A:14}[t.slice(0,-1)]||Number(t.slice(0,-1)),s:R.SUITS.indexOf(t.slice(-1))}));
assert.equal(new Set(R.deck().map(R.label)).size,52);

// Hold'em: la mejor jugada de cinco entre siete cartas.
const H=R.HOLDEM,best=text=>H.best(cards(text));
const cases={
  'Escalera real':'10♠ J♠ Q♠ K♠ A♠ 2♥ 2♦','Escalera de color':'5♥ 6♥ 7♥ 8♥ 9♥ A♥ 9♠','Póker':'9♠ 9♥ 9♦ 9♣ 2♠ 2♥ K♦',
  'Full':'K♠ K♥ K♦ 4♣ 4♠ 4♥ 2♦','Color':'2♦ 6♦ 9♦ J♦ K♦ K♠ K♥','Escalera':'A♠ 2♥ 3♦ 4♣ 5♠ 9♦ 9♣',
  'Trío':'7♠ 7♥ 7♦ 2♣ K♠ 9♦ 4♣','Doble pareja':'8♠ 8♥ 3♦ 3♣ K♠ K♦ 2♥','Pareja':'J♠ J♥ 3♦ 6♣ K♠ 9♦ 2♥','Carta alta':'10♠ 8♥ 3♦ 6♣ K♠ 2♦ J♥'
};
for(const [name,text] of Object.entries(cases))assert.equal(best(text).name,name,text);
assert.deepEqual(best(cases.Escalera).score,[4,5]);                 // el as vale de uno
assert.deepEqual(best(cases.Full).score,[6,13,4]);                  // con dos tríos, el menor hace de pareja
assert.deepEqual(best(cases['Doble pareja']).score,[2,13,8,3]);     // tres parejas: las dos mejores y la carta más alta
assert.deepEqual(best(cases.Color).score,[5,13,11,9,6,2]);
assert.deepEqual(best('2♠ 2♥ 4♦ 10♣ A♠').score,[1,2,14,10,4]);
assert.ok(H.compare(best('A♠ A♥ 3♦ 6♣ K♠ 9♦ 2♥').score,best('A♦ A♣ 3♦ 6♣ Q♠ 9♦ 2♥').score)>0,'desempata la carta alta');
assert.equal(H.compare(best('A♠ K♥ 3♦ 6♣ 7♠ 9♦ 2♥').score,best('A♦ K♣ 3♦ 6♣ 7♠ 9♦ 2♥').score),0);

// Una mano entera. La baraja se reparte desde el final: primero las dos cartas de cada asiento y luego las comunes.
const pack=(holes,board)=>cards([...board.split(' ').reverse(),...holes.flatMap(hole=>hole.split(' ')).reverse()].join(' '));
const chips=s=>s.seats.reduce((sum,p)=>sum+p.stack,0)+(s.stage==='done'?0:H.pot(s));
let s=H.start({stacks:[100,100,100],button:0,small:1,big:2,deck:pack(['A♠ A♥','K♠ K♥','7♦ 2♣'],'3♠ 8♦ 9♣ J♥ 4♠')});
assert.deepEqual(s.seats.map(p=>p.bet),[0,1,2]);                    // ciegas a la izquierda del botón
assert.deepEqual(s.seats[0].cards.map(R.label),['A♠','A♥']);
assert.equal(s.turn,0);
assert.deepEqual(H.legal(s),{seat:0,toCall:2,canCheck:false,canRaise:true,minTo:4,maxTo:100});
assert.equal(H.act(s,1,{type:'call'}),false,'no es su turno');
assert.equal(H.act(s,0,{type:'check'}),false);
assert.equal(H.act(s,0,{type:'raise',to:3}),false,'por debajo de la subida mínima');
assert.equal(H.act(s,0,{type:'raise',to:6}),true);
assert.equal(H.legal(s).minTo,10);
assert.equal(H.act(s,1,{type:'call'}),true);
assert.equal(H.act(s,2,{type:'fold'}),true);
assert.equal(s.stage,'flop');assert.equal(s.board.length,3);assert.equal(s.turn,1);assert.equal(H.pot(s),14);
assert.equal(H.act(s,1,{type:'check'}),true);
assert.equal(H.act(s,0,{type:'raise',to:10}),true);
assert.equal(H.act(s,1,{type:'call'}),true);
for(const seat of [1,0,1,0])assert.equal(H.act(s,seat,{type:'check'}),true);
assert.equal(s.stage,'done');assert.equal(s.turn,null);
assert.deepEqual(s.board.map(R.label),['3♠','8♦','9♣','J♥','4♠']);
assert.deepEqual(s.result.won,[34,0,0]);assert.deepEqual(s.result.hands,['Pareja','Pareja',null]);assert.deepEqual(s.result.winners,[0]);
assert.deepEqual(s.seats.map(p=>p.stack),[118,84,98]);
// Si todos se retiran, gana quien queda sin enseñar las cartas.
s=H.start({stacks:[100,100,100],button:2,small:1,big:2,deck:R.deck()});
assert.equal(s.turn,2);
H.act(s,2,{type:'fold'});H.act(s,0,{type:'fold'});
assert.equal(s.stage,'done');assert.equal(s.result.showdown,false);assert.deepEqual(s.seats.map(p=>p.stack),[99,101,100]);
// Botes laterales: el que va corto solo opta a lo que cubrió y la apuesta que nadie iguala vuelve a su dueño.
s=H.start({stacks:[20,100,60,0],button:0,small:1,big:2,deck:pack(['A♠ A♥','K♠ K♥','7♦ 2♣'],'3♠ 8♦ 9♣ J♥ 4♠')});
assert.equal(s.seats[3].cards,null);
assert.equal(H.act(s,0,{type:'raise',to:20}),true);
assert.equal(H.act(s,1,{type:'raise',to:100}),true);
assert.equal(H.act(s,2,{type:'call'}),true);
assert.equal(s.stage,'done');assert.equal(s.board.length,5);
assert.deepEqual(s.result.won,[60,120,0,0]);assert.deepEqual(s.seats.map(p=>p.stack),[60,120,0,0]);
// Mano a mano el botón es la ciega pequeña; empate: el bote se parte.
s=H.start({stacks:[50,50],button:1,small:1,big:2,deck:pack(['A♠ K♥','A♦ K♣'],'3♠ 8♦ 9♣ J♥ 4♠')});
assert.deepEqual(s.seats.map(p=>p.bet),[2,1]);assert.equal(s.turn,1);
H.act(s,1,{type:'call'});assert.equal(s.turn,0);H.act(s,0,{type:'check'});
assert.equal(s.turn,0,'tras el flop habla primero quien no tiene el botón');
while(s.turn!==null)H.act(s,s.turn,{type:'check'});
assert.deepEqual(s.seats.map(p=>p.stack),[50,50]);
// Levantarse fuera de turno retira al jugador sin saltarse a quien le toca.
s=H.start({stacks:[100,100,100],button:0,small:1,big:2,deck:R.deck()});
H.leave(s,2);assert.equal(s.turn,0);H.leave(s,0);
assert.equal(s.stage,'done');assert.deepEqual(s.seats.map(p=>p.stack),[100,102,98]);
// Mil manos jugadas al azar: nunca se crean ni se pierden fichas y siempre terminan.
let seed=7;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;
for(let game=0;game<1000;game++){
  const stacks=Array.from({length:2+Math.floor(rand()*5)},()=>Math.floor(rand()*4)?1+Math.floor(rand()*200):0);
  const total=stacks.reduce((a,b)=>a+b,0);
  s=H.start({stacks,button:Math.floor(rand()*stacks.length),small:1,big:2,deck:R.deck(rand)});
  if(stacks.filter(Boolean).length<2){assert.equal(s,null);continue}
  for(let step=0;s.turn!==null;step++){
    assert.ok(step<400,'la mano termina');
    const rules=H.legal(s),pick=rand();
    if(pick<.12)H.leave(s,Math.floor(rand()*stacks.length));
    else assert.ok(H.act(s,s.turn,pick<.25?{type:'fold'}:pick<.5&&rules.canRaise?{type:'raise',to:rules.minTo+Math.floor(rand()*(rules.maxTo-rules.minTo+1))}:rules.canCheck?{type:'check'}:{type:'call'}));
    assert.equal(chips(s),total);
  }
  assert.equal(s.stage,'done');assert.equal(chips(s),total);
  assert.ok(s.seats.every(p=>p.stack>=0)&&s.result.won.reduce((a,b)=>a+b,0)===H.pot(s));
}

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

// Crash: nunca revienta por debajo de 1 ni por encima del máximo, y llegar a m tiene probabilidad (1 − ventaja)/m.
{
  const C=R.CRASH;
  assert.equal(C.point(()=>0),1,'con la peor suerte revienta nada más salir');
  assert.equal(C.point(()=>.5),1.94);
  assert.equal(C.point(()=>.999999),C.MAX);
  for(const m of [1.5,2,5,20]){
    const edge=1-C.EDGE/1,reach=u=>C.point(()=>u)>=m;
    // El u más pequeño que llega a m es 1 − (1 − ventaja)/m.
    const limit=1-(1-C.EDGE)/m;
    assert.ok(reach(limit+1e-9)&&!reach(limit-1e-6),`llegar a ${m} depende solo del corte`);
    assert.ok(Math.abs((1-limit)*m-edge)<1e-9,'retirarse en m devuelve 1 − ventaja');
  }
  assert.equal(C.at(0),1);assert.ok(Math.abs(C.at(C.time(7.25))-7.25)<1e-9);
  assert.equal(C.cash(2.349999),2.34);assert.equal(R.EDGE.crash,C.EDGE);
}

console.log('casino: todo correcto');
